import {
  Suspense,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { createStudioEnvironment } from './environment'
import { SceneRenderer } from './SceneRenderer'
import type { BuilderSceneProps, ConnectedSupportMove, Face, PlacedItem } from '../domain/types'
import {
  allowedFaces,
  deriveSupportTrackPlans,
  proposeItemDuplicate,
  proposeItemMove,
  snapItemHeight,
  variantFor,
} from '../domain/rules'
import { buildAssembly, disposeAssembly, systemWidth } from './geometry'
import { exportAssemblyUsdz } from './ar'
import { studioLighting } from './lighting'
import { mountingDepths } from './mounting'
import { dragPreviewBounds, faceTargetScreen, makeDragGhost, projectedFaceGesture } from './drag'

type Point = [number, number, number]
const toMetres = (value: number) => value / 1000

function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree()

  useEffect(() => {
    const environment = createStudioEnvironment(gl)
    scene.environment = environment.texture
    scene.environmentIntensity = studioLighting.environment
    invalidate()

    return () => {
      scene.environment = null
      environment.dispose()
    }
  }, [gl, scene, invalidate])

  return null
}

function Dimension({
  start,
  end,
  label,
  labelPosition,
}: {
  start: Point
  end: Point
  label: string
  labelPosition?: Point
}) {
  const midpoint: Point = labelPosition ?? [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ]
  const horizontal = Math.hypot(end[0] - start[0], end[2] - start[2]) > Math.abs(end[1] - start[1])
  const tick: Point = horizontal ? [0, 0.026, 0] : [0.026, 0, 0]
  return (
    <group raycast={() => {}}>
      <Line raycast={() => {}} points={[start, end]} color="#96968c" lineWidth={0.75} />
      {[start, end].map((point, index) => (
        <Line
          raycast={() => {}}
          key={index}
          points={[
            [point[0] - tick[0], point[1] - tick[1], point[2] - tick[2]],
            [point[0] + tick[0], point[1] + tick[1], point[2] + tick[2]],
          ]}
          color="#96968c"
          lineWidth={0.75}
        />
      ))}
      <Html
        position={midpoint}
        center
        zIndexRange={[2, 0]}
        style={{
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
          color: '#77776f',
          fontSize: 10,
          background: 'rgba(246,245,240,.88)',
          padding: '3px 6px',
          borderRadius: 2,
        }}
      >
        {label}
      </Html>
    </group>
  )
}

function Room({
  document,
  presentation = false,
}: Pick<BuilderSceneProps, 'document'> & { presentation?: boolean }) {
  const w = toMetres(document.room.width)
  const d = toMetres(document.room.depth)
  const h = toMetres(document.room.ceilingHeight)
  return (
    <group>
      <mesh position={[w / 2, -0.026, d / 2]} receiveShadow>
        <boxGeometry args={[w + 0.15, 0.05, d + 0.15]} />
        <meshStandardMaterial color="#cbc7bd" roughness={0.9} />
      </mesh>
      <mesh position={[w / 2, h / 2, -0.004]} receiveShadow>
        <planeGeometry args={[w + 0.15, h]} />
        <meshStandardMaterial color="#d8d6cf" roughness={0.95} />
      </mesh>
      <mesh position={[-0.004, h / 2, d / 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color="#d1cec5" roughness={0.95} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[w / 2, 0.042, 0.009]} receiveShadow>
        <boxGeometry args={[w, 0.084, 0.018]} />
        <meshStandardMaterial color="#e4e2d9" roughness={0.6} />
      </mesh>
      <Line
        points={[
          [0, h, 0],
          [w, h, 0],
          [w, h, d],
        ]}
        color="#d1cfc5"
        lineWidth={0.7}
      />
      <Line
        points={[
          [w, 0, 0],
          [w, 0, d],
          [0, 0, d],
        ]}
        color="#cbc8bd"
        lineWidth={0.8}
      />
      {document.room.showDimensions && !presentation && (
        <>
          <Dimension
            start={[0, 0.01, Math.min(d - 0.12, 1.25)]}
            end={[w, 0.01, Math.min(d - 0.12, 1.25)]}
            label={`${(document.room.width / 1000).toFixed(2)} m room width`}
          />
          <Dimension
            start={[w - 0.07, 0, 0.035]}
            end={[w - 0.07, h, 0.035]}
            label={`${(document.room.ceilingHeight / 1000).toFixed(2)} m`}
          />
          <Dimension
            start={[w - 0.03, 0.012, 0]}
            end={[w - 0.03, 0.012, d]}
            label={`${(document.room.depth / 1000).toFixed(2)} m depth`}
          />
        </>
      )}
    </group>
  )
}

function CameraRig({
  document,
  catalog,
  viewMode,
  dragging,
  assembly,
  focusRequest,
  cameraFitRevision = 0,
}: Pick<BuilderSceneProps, 'document' | 'catalog' | 'viewMode' | 'cameraFitRevision'> & {
  dragging: boolean
  assembly: THREE.Group
  focusRequest: { id: string; revision: number } | null
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, size, invalidate } = useThree()
  const width = systemWidth(document)
  const x = toMetres(document.system.placement.x) + width / 2
  const z = toMetres(document.system.placement.z)
  const systemHeight =
    document.system.mountingType === 'floor-to-ceiling'
      ? toMetres(document.room.ceilingHeight)
      : Math.max(...deriveSupportTrackPlans(document, catalog).map((plan) => toMetres(plan.top)))
  const previousFraming = useRef<{ mode: typeof viewMode; revision: number } | null>(null)
  useEffect(() => {
    const previous = previousFraming.current
    const reset = !previous || previous.mode !== viewMode || previous.revision !== cameraFitRevision
    previousFraming.current = { mode: viewMode, revision: cameraFitRevision }
    // Furniture edits, selection and viewport resizing preserve the user's view.
    if (!reset) return
    const target = new THREE.Vector3(x, Math.max(0.65, systemHeight * 0.6), z + 0.1)
    const aspect = size.width / Math.max(1, size.height)
    const distance = Math.max(3.5, (width / Math.max(0.5, aspect)) * 1.95, systemHeight * 2.05)
    const rotation =
      THREE.MathUtils.degToRad(document.system.placement.rotation) +
      ((viewMode === 'orbit' ? document.system.activeFace === 'back' : viewMode === 'back')
        ? Math.PI
        : 0)
    const offset =
      viewMode !== 'orbit'
        ? new THREE.Vector3(0, 0.02, distance)
        : new THREE.Vector3(distance * 0.25, distance * 0.14, distance)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
    camera.position.copy(target).add(offset)
    camera.lookAt(target)
    controls.current?.target.copy(target)
    controls.current?.update()
    invalidate()
  }, [
    camera,
    cameraFitRevision,
    invalidate,
    width,
    x,
    z,
    systemHeight,
    viewMode,
    document.system.activeFace,
    document.system.placement.rotation,
    size.width,
    size.height,
  ])

  const previousFocus = useRef<NonNullable<typeof focusRequest> | null>(null)
  useEffect(() => {
    if (!focusRequest || focusRequest === previousFocus.current || !controls.current) return
    previousFocus.current = focusRequest
    const object = assembly.children.find((child) => child.userData.itemId === focusRequest.id)
    if (!object) return
    const bounds = new THREE.Box3().setFromObject(object)
    const target = bounds.getCenter(new THREE.Vector3())
    const extent = bounds.getSize(new THREE.Vector3())
    const distance = Math.max(
      0.55,
      (extent.x / Math.max(0.5, size.width / size.height)) * 2.1,
      extent.y * 2.5,
      extent.z * 2,
    )
    const direction = camera.position.clone().sub(controls.current.target).normalize()
    camera.position.copy(target).addScaledVector(direction, distance)
    controls.current.target.copy(target)
    controls.current.update()
    invalidate()
  }, [focusRequest, assembly, camera, size.width, size.height, invalidate])
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!dragging}
      enableRotate
      minDistance={0.35}
      maxDistance={20}
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI - 0.01}
      screenSpacePanning
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      enableDamping
      dampingFactor={0.12}
    />
  )
}

function Selection({
  assembly,
  selectedItemId,
  selectedSupportIndex,
}: {
  assembly: THREE.Group
  selectedItemId: string | null
  selectedSupportIndex: number | null
}) {
  const helper = useMemo(() => {
    const object = assembly.children.find((child) =>
      selectedItemId !== null
        ? child.userData.itemId === selectedItemId
        : selectedSupportIndex !== null && child.userData.supportIndex === selectedSupportIndex,
    )
    if (!object) return null
    const box = new THREE.BoxHelper(object, '#888b69')
    box.material.depthTest = false
    box.material.transparent = true
    box.material.opacity = 0.65
    box.renderOrder = 20
    return box
  }, [assembly, selectedItemId, selectedSupportIndex])
  useFrame(() => helper?.update())
  useEffect(
    () => () => {
      helper?.geometry.dispose()
      helper?.material.dispose()
    },
    [helper],
  )
  return helper ? <primitive object={helper} /> : null
}

type CaptureTarget = Element & {
  setPointerCapture: (id: number) => void
  releasePointerCapture: (id: number) => void
}

type DragMeasurements = {
  width: number
  depth: number
  bottom: number
  tabletop: boolean
}

type DragDimensionPreview = DragMeasurements & {
  x: number
  z: number
  height: number
  face: Face
}

function DragDimensions({ preview }: { preview: DragDimensionPreview }) {
  const { width, depth, height, x, z, face, tabletop } = preview
  const baseline = Math.max(0.08, height + preview.bottom - 0.08)
  return (
    <group position={[x, 0, z]} rotation={[0, face === 'back' ? Math.PI : 0, 0]}>
      <Dimension
        start={[-width / 2 - 0.14, 0, depth + 0.08]}
        end={[-width / 2 - 0.14, height, depth + 0.08]}
        label={`${tabletop ? 'Tabletop' : 'Pin'} ${Math.round(height * 1000)} mm`}
      />
      <Dimension
        start={[-width / 2, baseline, depth + 0.08]}
        end={[width / 2, baseline, depth + 0.08]}
        label={`${Math.round(width * 1000)} mm wide`}
      />
      <Dimension
        start={[width / 2 + 0.12, baseline, 0]}
        end={[width / 2 + 0.12, baseline, depth]}
        label={`${Math.round(depth * 1000)} mm deep`}
      />
    </group>
  )
}

type DragState = {
  id: string
  item: PlacedItem
  face: Face
  plane: THREE.Plane
  startPoint: THREE.Vector3
  motionOrigin: THREE.Vector3
  originalPosition: THREE.Vector3
  ghost: THREE.Group
  material: THREE.MeshBasicMaterial
  target: CaptureTarget
  pointerId: number
  moved: boolean
  valid: boolean
  bayIndex: number
  height: number
  startScreen: THREE.Vector2
  oppositeScreen: THREE.Vector2
  client: THREE.Vector2
  marker: THREE.Vector3 | null
  destinationPoint: THREE.Vector3
  duplicate: boolean
  measurements: DragMeasurements
}

type SupportDragState = {
  plane: THREE.Plane
  startPoint: THREE.Vector3
  originalPosition: THREE.Vector3
  move: ConnectedSupportMove
  pointerId: number
  target: CaptureTarget
  moved: boolean
}

function AssemblyScene(props: BuilderSceneProps) {
  const { invalidate, camera, gl } = useThree()
  const {
    document,
    catalog,
    selectedItemId,
    selectedSupportIndex,
    viewMode,
    onSelectItem,
    onSelectSupport,
    onMoveConnectedSupports,
    onMoveItem,
    onExportUsdzReady,
    onItemDragStatusChange,
    dragFaceOverride,
    cancelDragRevision,
  } = props
  const {
    mountingType,
    bays,
    items,
    railHeight,
    mountHeight,
    trackMode,
    finish,
    structureOptions,
  } = document.system
  const assembly = useMemo(
    () => buildAssembly(document, catalog),
    [
      mountingType,
      bays,
      items,
      railHeight,
      mountHeight,
      trackMode,
      finish,
      structureOptions,
      document.room.ceilingHeight,
      catalog,
    ],
  )
  const placement = useRef<THREE.Group>(null)
  const drag = useRef<DragState | null>(null)
  const supportDrag = useRef<SupportDragState | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dragDimensions, setDragDimensions] = useState<DragDimensionPreview | null>(null)
  const [supportDimensions, setSupportDimensions] = useState<{
    x: number
    z: number
    height: number
  } | null>(null)
  const [dragMarker, setDragMarker] = useState<{
    point: THREE.Vector3
    destination: THREE.Vector3
    face: Face
  } | null>(null)
  const [hovering, setHovering] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ id: string; revision: number } | null>(null)
  const width = systemWidth(document)
  const x = toMetres(document.system.placement.x) + width / 2
  const z = toMetres(document.system.placement.z)
  const rotation = THREE.MathUtils.degToRad(document.system.placement.rotation)
  const keyLight = useRef<THREE.DirectionalLight>(null)
  const lightTarget = useMemo(() => {
    const target = new THREE.Object3D()
    target.position.set(x, 1, z)
    return target
  }, [x, z])
  useEffect(() => {
    if (!keyLight.current) return

    const light = keyLight.current
    light.target.updateMatrixWorld(true)
    light.updateMatrixWorld(true)
    light.shadow.updateMatrices(light)
    assembly.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(assembly)
    bounds.min.y = 0
    bounds.expandByScalar(0.3)
    const lightBounds = new THREE.Box3()

    for (const bx of [bounds.min.x, bounds.max.x]) {
      for (const by of [bounds.min.y, bounds.max.y]) {
        for (const bz of [bounds.min.z, bounds.max.z]) {
          const point = new THREE.Vector3(bx, by, bz).applyMatrix4(
            light.shadow.camera.matrixWorldInverse,
          )
          lightBounds.expandByPoint(point)
        }
      }
    }

    const shadowCamera = light.shadow.camera
    shadowCamera.left = lightBounds.min.x - 0.35
    shadowCamera.right = lightBounds.max.x + 0.35
    shadowCamera.bottom = lightBounds.min.y - 0.35
    shadowCamera.top = lightBounds.max.y + 0.35
    shadowCamera.updateProjectionMatrix()
    invalidate()
  }, [assembly, x, z, rotation, invalidate])
  useEffect(() => () => disposeAssembly(assembly), [assembly])
  useEffect(() => {
    onExportUsdzReady?.(() => exportAssemblyUsdz(assembly, document.system.mountingType))
  }, [assembly, document.system.mountingType, onExportUsdzReady])
  useEffect(() => {
    window.document.body.style.cursor = dragging ? 'grabbing' : hovering ? 'grab' : ''
    return () => {
      window.document.body.style.cursor = ''
    }
  }, [dragging, hovering])

  function publishDrag(current: DragState) {
    const candidate = {
      ...current.item,
      bayIndex: current.bayIndex,
      height: current.height,
      face: current.face,
    }
    const proposal = current.duplicate
      ? proposeItemDuplicate(document, catalog, candidate)
      : proposeItemMove(document, catalog, candidate)
    current.valid = proposal?.valid ?? false
    if (proposal) current.height = proposal.candidate.height
    let bayStart = -width / 2
    for (let index = 0; index < current.bayIndex; index++)
      bayStart += toMetres(document.system.bays[index].centreWidth)
    const centre = bayStart + toMetres(document.system.bays[current.bayIndex].centreWidth) / 2
    const hPost =
      document.system.mountingType === 'freestanding' || document.room.ceilingHeight > 3500
    const depths = mountingDepths(hPost, document.system.mountingType === 'wall')
    current.ghost.position.set(
      centre,
      toMetres(current.height),
      toMetres(current.face === 'front' ? depths.frontPin : depths.backPin),
    )
    current.ghost.rotation.y = current.face === 'front' ? 0 : Math.PI
    current.ghost.visible = current.moved
    current.material.color.set(current.valid ? '#0076ad' : '#b53c30')
    current.ghost.updateMatrixWorld(true)
    if (current.moved && document.room.showDimensions) {
      const preview = {
        ...current.measurements,
        x: centre,
        z: current.ghost.position.z,
        height: current.ghost.position.y,
        face: current.face,
      }
      setDragDimensions((previous) =>
        previous &&
        previous.x === preview.x &&
        previous.z === preview.z &&
        previous.height === preview.height &&
        previous.face === preview.face
          ? previous
          : preview,
      )
    }
    onItemDragStatusChange?.({
      itemId: current.id,
      face: current.face,
      valid: current.valid,
      duplicate: current.duplicate,
      clientX: current.client.x,
      clientY: current.client.y,
    })
    invalidate()
  }

  function finishDrag(commit: boolean) {
    const current = drag.current
    const support = supportDrag.current
    drag.current = null
    supportDrag.current = null
    if (current) {
      current.ghost.removeFromParent()
      // Ghost geometry belongs to the live assembly; only its material is owned here.
      current.material.dispose()
      try {
        current.target.releasePointerCapture(current.pointerId)
      } catch {
        /* Capture may already be lost. */
      }
      if (commit && current.moved && current.valid)
        onMoveItem(current.id, current.bayIndex, current.height, current.face, current.duplicate)
    }
    if (support) {
      placement.current?.position.copy(support.originalPosition)
      try {
        support.target.releasePointerCapture(support.pointerId)
      } catch {
        /* Capture may already be lost. */
      }
      if (commit && support.moved) onMoveConnectedSupports(support.move)
    }
    setDragging(false)
    setDragMarker(null)
    setDragDimensions(null)
    setSupportDimensions(null)
    onItemDragStatusChange?.(null)
    invalidate()
  }

  const cancelCurrentDrag = useEffectEvent(() => finishDrag(false))
  useEffect(() => {
    cancelCurrentDrag()
  }, [cancelDragRevision])

  const applyFaceOverride = useEffectEvent(() => {
    const current = drag.current
    if (!current?.moved || !dragFaceOverride || !allowedFaces(document).includes(dragFaceOverride))
      return
    current.face = dragFaceOverride
    current.bayIndex = current.item.bayIndex
    current.height = current.item.height
    publishDrag(current)
  })
  useEffect(() => {
    applyFaceOverride()
  }, [dragFaceOverride])

  function pointerDown(event: ThreeEvent<PointerEvent>) {
    if (!placement.current || event.button !== 0 || drag.current || supportDrag.current) return
    // The closest visible surface owns the click, including the rear face.
    event.stopPropagation()
    const id = event.object.userData.itemId as string | undefined
    const supportIndex = event.object.userData.supportIndex as number | undefined
    if (supportIndex !== undefined) {
      onSelectItem(null)
      onSelectSupport(supportIndex)
      const wallBound = ['wall', 'semi-wall'].includes(document.system.mountingType)
      const normal = wallBound
        ? new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
        : new THREE.Vector3(0, 1, 0)
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, event.point)
      const startPoint = event.ray.intersectPlane(plane, new THREE.Vector3())
      if (!startPoint) return
      supportDrag.current = {
        plane,
        startPoint,
        originalPosition: placement.current.position.clone(),
        pointerId: event.pointerId,
        target: event.target as CaptureTarget,
        moved: false,
        move: {
          x: document.system.placement.x,
          z: document.system.placement.z,
          mountHeight: document.system.mountHeight,
        },
      }
      ;(event.target as Element & { setPointerCapture: (id: number) => void }).setPointerCapture(
        event.pointerId,
      )
      setDragging(true)
      return
    }
    if (!id) return
    onSelectSupport(null)
    onSelectItem(id)
    const item = document.system.items.find((candidate) => candidate.id === id)
    const object = assembly.children.find((child) => child.userData.itemId === id)
    if (!item || !object) return
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
    const worldPoint = object.getWorldPosition(new THREE.Vector3())
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPoint)
    const startPoint = event.ray.intersectPlane(plane, new THREE.Vector3())
    if (!startPoint) return
    const proposal = proposeItemMove(document, catalog, item)
    if (!proposal) return
    const { ghost, material } = makeDragGhost(assembly, proposal.movedItemIds, object)
    ghost.visible = false
    placement.current.add(ghost)
    const bounds = dragPreviewBounds(ghost, id)
    const variant = variantFor(item, catalog)
    const measurements = {
      width: variant ? toMetres(variant.width) : bounds.max.x - bounds.min.x,
      depth:
        item.orientation === 'vertical'
          ? bounds.max.z - bounds.min.z
          : Math.max(toMetres(variant?.depth ?? 0), bounds.max.z),
      bottom: bounds.min.y,
      tabletop: item.productId === 'table',
    }
    const localHit = placement.current.worldToLocal(event.point.clone())
    const hPost =
      document.system.mountingType === 'freestanding' || document.room.ceilingHeight > 3500
    const opposite = localHit.clone()
    opposite.z = (hPost ? -0.068 : -0.048) - localHit.z
    const rect = gl.domElement.getBoundingClientRect()
    const projected = placement.current.localToWorld(opposite.clone()).project(camera)
    const startScreen = new THREE.Vector2(event.clientX, event.clientY)
    const projectedScreen = new THREE.Vector2(
      rect.left + ((projected.x + 1) * rect.width) / 2,
      rect.top + ((1 - projected.y) * rect.height) / 2,
    )
    const oppositeScreen = faceTargetScreen(startScreen, projectedScreen, rect.left, rect.width)
    const markerWorld = new THREE.Vector3(
      ((oppositeScreen.x - rect.left) / rect.width) * 2 - 1,
      1 - ((oppositeScreen.y - rect.top) / rect.height) * 2,
      projected.z,
    ).unproject(camera)
    const marker = allowedFaces(document).includes('back')
      ? placement.current.worldToLocal(markerWorld)
      : null
    drag.current = {
      id,
      item,
      face: item.face,
      plane,
      startPoint,
      motionOrigin: object.position.clone(),
      originalPosition: object.position.clone(),
      ghost,
      material,
      target: event.target as CaptureTarget,
      pointerId: event.pointerId,
      moved: false,
      valid: proposal.valid,
      bayIndex: item.bayIndex,
      height: item.height,
      startScreen,
      oppositeScreen,
      client: startScreen.clone(),
      marker,
      destinationPoint: opposite,
      duplicate: event.altKey,
      measurements,
    }
    ;(event.target as CaptureTarget).setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function pointerMove(event: ThreeEvent<PointerEvent>) {
    const support = supportDrag.current
    if (support && placement.current) {
      event.stopPropagation()
      const point = event.ray.intersectPlane(support.plane, new THREE.Vector3())
      if (!point) return
      const delta = point.sub(support.startPoint)
      if (delta.length() < 0.012 && !support.moved) return
      support.moved = true
      const mode = document.system.mountingType
      if (mode === 'wall' || mode === 'semi-wall') {
        delta.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotation)
        delta.z = 0
        const hasFloorTable = document.system.items.some((item) => item.productId === 'table')
        if (mode === 'semi-wall' || hasFloorTable) delta.y = 0
        delta.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
      } else delta.y = 0
      support.move = {
        x: Math.round(document.system.placement.x + delta.x * 1000),
        z: Math.round(document.system.placement.z + delta.z * 1000),
        mountHeight: Math.round(document.system.mountHeight + delta.y * 1000),
      }
      placement.current.position.copy(support.originalPosition).add(delta)
      placement.current.updateMatrixWorld(true)
      if (document.room.showDimensions) {
        const anchor = new THREE.Vector3(-width / 2, 0, 0).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          rotation,
        )
        const preview = {
          x: Math.round((placement.current.position.x + anchor.x) * 1000) / 1000,
          z: Math.round((placement.current.position.z + anchor.z) * 1000) / 1000,
          height: toMetres(support.move.mountHeight),
        }
        setSupportDimensions((previous) =>
          previous &&
          previous.x === preview.x &&
          previous.z === preview.z &&
          previous.height === preview.height
            ? previous
            : preview,
        )
      }
      invalidate()
      return
    }
    const current = drag.current
    if (!current || !placement.current || event.pointerId !== current.pointerId) return
    event.stopPropagation()
    current.client.set(event.clientX, event.clientY)
    if (!current.moved && current.client.distanceTo(current.startScreen) < 8) return
    if (!current.moved && current.marker)
      setDragMarker({
        point: current.marker,
        destination: current.destinationPoint,
        face: current.item.face === 'front' ? 'back' : 'front',
      })
    current.moved = true
    current.duplicate = event.altKey
    const previousFace = current.face
    const gesture = current.marker
      ? projectedFaceGesture(
          current.startScreen,
          current.oppositeScreen,
          current.client,
          current.item.face,
          current.face,
        )
      : { face: current.face, depthGesture: false }
    if (dragFaceOverride && allowedFaces(document).includes(dragFaceOverride)) {
      current.face = dragFaceOverride
      current.bayIndex = current.item.bayIndex
      current.height = current.item.height
    } else if (gesture.depthGesture || gesture.face !== current.face) {
      current.face = gesture.face
      current.bayIndex = current.item.bayIndex
      current.height = current.item.height
    } else {
      const point = event.ray.intersectPlane(current.plane, new THREE.Vector3())
      if (!point) return
      const delta = point
        .sub(current.startPoint)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotation)
      let bayStart = -width / 2
      let closest = Infinity
      document.system.bays.forEach((bay, index) => {
        const centre = bayStart + toMetres(bay.centreWidth) / 2
        const distance = Math.abs(current.motionOrigin.x + delta.x - centre)
        if (distance < closest) {
          closest = distance
          current.bayIndex = index
        }
        bayStart += toMetres(bay.centreWidth)
      })
      current.height = snapItemHeight(
        Math.max(
          50,
          Math.min(document.room.ceilingHeight - 50, (current.motionOrigin.y + delta.y) * 1000),
        ),
        document,
      )
    }
    publishDrag(current)
    if (current.face !== previousFace) {
      // Re-anchor planar motion after crossing so the depth gesture cannot also change height.
      const worldPoint = placement.current.localToWorld(current.ghost.position.clone())
      current.plane.setFromNormalAndCoplanarPoint(current.plane.normal, worldPoint)
      const anchor = event.ray.intersectPlane(current.plane, new THREE.Vector3())
      if (anchor) current.startPoint.copy(anchor)
      current.motionOrigin.copy(current.ghost.position)
    }
  }

  function pointerUp(event: ThreeEvent<PointerEvent>) {
    if (!drag.current && !supportDrag.current) return
    event.stopPropagation()
    const current = drag.current
    // Resolve the release point as well, including a fast drop before React
    // has delivered the side-button override from the preceding move event.
    if (current?.moved && event.type !== 'pointercancel') {
      current.duplicate = event.altKey
      const target = window.document.elementFromPoint(event.clientX, event.clientY)
      const face = target?.closest<HTMLElement>('[data-drop-face]')?.dataset.dropFace
      if ((face === 'front' || face === 'back') && allowedFaces(document).includes(face)) {
        current.face = face
        current.bayIndex = current.item.bayIndex
        current.height = current.item.height
        current.client.set(event.clientX, event.clientY)
      }
      publishDrag(current)
    }
    finishDrag(event.type !== 'pointercancel')
  }

  return (
    <>
      <color attach="background" args={['#f1f0e9']} />
      <StudioEnvironment />
      <ambientLight intensity={studioLighting.ambient} />
      <hemisphereLight args={['#fffdf8', '#89867d', studioLighting.hemisphere]} />
      <primitive object={lightTarget} />
      <directionalLight
        ref={keyLight}
        name="Studio window key"
        position={[x - 3, 5.5, z + 4]}
        target={lightTarget}
        color="#fffdf8"
        intensity={studioLighting.key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.001}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        shadow-radius={1.5}
      />
      <directionalLight
        position={[x + 4, 3, z - 2]}
        target={lightTarget}
        intensity={studioLighting.fill}
      />
      <Room document={document} presentation={props.renderMode} />
      {document.room.showDimensions && !props.renderMode && supportDimensions && (
        <group>
          <Dimension
            start={[0, 0.12, supportDimensions.z]}
            end={[supportDimensions.x, 0.12, supportDimensions.z]}
            label={`Room X ${Math.round(supportDimensions.x * 1000)} mm`}
          />
          <Dimension
            start={[supportDimensions.x, 0.12, 0]}
            end={[supportDimensions.x, 0.12, supportDimensions.z]}
            label={`Room depth ${Math.round(supportDimensions.z * 1000)} mm`}
          />
          <Dimension
            start={[supportDimensions.x - 0.14, 0, supportDimensions.z]}
            end={[supportDimensions.x - 0.14, supportDimensions.height, supportDimensions.z]}
            label={`Mounting height ${Math.round(supportDimensions.height * 1000)} mm`}
          />
        </group>
      )}
      <group ref={placement} position={[x, 0, z]} rotation={[0, rotation, 0]}>
        <primitive
          object={assembly}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
            const id = event.object.userData.itemId as string | undefined
            if (id) {
              event.stopPropagation()
              setFocusRequest((previous) => ({ id, revision: (previous?.revision ?? 0) + 1 }))
            }
          }}
          onPointerOver={(event: ThreeEvent<PointerEvent>) => {
            if (event.object.userData.itemId || event.object.userData.supportIndex !== undefined) {
              event.stopPropagation()
              setHovering(true)
            }
          }}
          onPointerOut={() => setHovering(false)}
        />
        {document.room.showDimensions && !props.renderMode && dragDimensions && (
          <DragDimensions preview={dragDimensions} />
        )}
        {dragMarker && (
          <group>
            {dragMarker.point.distanceTo(dragMarker.destination) > 0.001 && (
              <Line
                points={[dragMarker.destination, dragMarker.point]}
                color="#0076ad"
                lineWidth={1}
                dashed
                dashSize={0.025}
                gapSize={0.015}
              />
            )}
            <Html position={dragMarker.point.toArray()} center style={{ pointerEvents: 'none' }}>
              <span
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  background: '#0076ad',
                  color: 'white',
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                }}
              >
                Drag here → {dragMarker.face}
              </span>
            </Html>
          </group>
        )}
        {document.room.showDimensions && !props.renderMode && (
          <Dimension
            start={[-width / 2, Math.max(0.15, toMetres(document.system.mountHeight)) - 0.06, 0.48]}
            end={[width / 2, Math.max(0.15, toMetres(document.system.mountHeight)) - 0.06, 0.48]}
            label={`${Math.round(width * 1000)} mm · ${document.system.bays.length} bays`}
          />
        )}
      </group>
      {!props.renderMode && (
        <Selection
          assembly={assembly}
          selectedItemId={selectedItemId}
          selectedSupportIndex={selectedSupportIndex}
        />
      )}
      <SceneRenderer
        enabled={props.renderMode ?? false}
        onStatus={props.onRenderStatusChange}
        assembly={assembly}
        revision={`${x},${z},${rotation},${document.room.width},${document.room.depth},${document.room.ceilingHeight}`}
        dragging={dragging}
      />
      <CameraRig
        document={document}
        catalog={catalog}
        viewMode={viewMode}
        dragging={dragging}
        assembly={assembly}
        focusRequest={focusRequest}
        cameraFitRevision={props.cameraFitRevision}
      />
    </>
  )
}

export function BuilderScene(props: BuilderSceneProps) {
  return (
    <Canvas
      frameloop="demand"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 1.5]}
      camera={{ position: [4, 2.8, 6], fov: 35, near: 0.02, far: 60 }}
      gl={{
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      }}
      onPointerMissed={() => {
        props.onSelectItem(null)
        props.onSelectSupport(null)
      }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <AssemblyScene {...props} />
      </Suspense>
    </Canvas>
  )
}

export default BuilderScene
