import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { catalog } from '../../domain/catalog/catalog'
import { isIntegratedTable } from '../../domain/catalog/families'
import { snapPinHeight } from '../../domain/placement/grid'
import { proposeItemDuplicate, proposeItemMove } from '../../domain/placement/proposals'
import { allowedFaces, hasIntegratedTable, isWallMounted } from '../../domain/plan/system'
import type { Plan, PlanItem } from '../../domain/plan/types'
import type { SupportRunMove } from '../../domain/supports/run'
import { usesHPosts, type SupportTrackPlan } from '../../domain/supports/tracks'
import type { Face } from '../../domain/types'
import { editor } from '../../editor/editor'
import type { DragStatus } from '../../editor/store'
import { bayCentre, pinDepth, systemWidth } from '../models/assembly'
import { mm } from '../models/primitives'
import {
  dragPreviewBounds,
  faceTargetScreen,
  faceUnderPointer,
  makeDragGhost,
  projectedFaceGesture,
} from './drag'

type CaptureTarget = Element & {
  setPointerCapture: (id: number) => void
  releasePointerCapture: (id: number) => void
}

interface Measurements {
  width: number
  depth: number
  bottom: number
  tabletop: boolean
}

/** Where a dragged component would land, in metres within the run. */
export interface ItemPreview extends Measurements {
  x: number
  z: number
  height: number
  face: Face
}

/** Where a dragged support run would sit, in room metres. */
export interface SupportPreview {
  x: number
  z: number
  height: number
}

/** The affordance that shows where to drag a component to reach the other face. */
export interface FaceMarker {
  point: THREE.Vector3
  destination: THREE.Vector3
  face: Face
}

interface ItemDrag {
  id: string
  item: PlanItem
  face: Face
  plane: THREE.Plane
  startPoint: THREE.Vector3
  motionOrigin: THREE.Vector3
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
  measurements: Measurements
  published: DragStatus | null
}

interface SupportDrag {
  plane: THREE.Plane
  startPoint: THREE.Vector3
  originalPosition: THREE.Vector3
  move: SupportRunMove
  pointerId: number
  target: CaptureTarget
  moved: boolean
}

const up = new THREE.Vector3(0, 1, 0)

function sameStatus(a: DragStatus | null, b: DragStatus) {
  return (
    a?.itemId === b.itemId &&
    a.face === b.face &&
    a.valid === b.valid &&
    a.duplicate === b.duplicate
  )
}

function releaseCapture(target: CaptureTarget, pointerId: number) {
  try {
    target.releasePointerCapture(pointerId)
  } catch {
    // Capture may already be lost
  }
}

/**
 * Pointer handling for moving and copying components, and for moving the whole support run.
 * Components snap to bays and the track grid; the side buttons and a depth gesture change face.
 */
export function useAssemblyDrag({
  plan,
  tracks,
  assembly,
  placement,
  showDimensions,
}: {
  plan: Plan
  tracks: SupportTrackPlan[]
  assembly: THREE.Group
  placement: RefObject<THREE.Group | null>
  showDimensions: boolean
}) {
  const { invalidate, camera, gl } = useThree()
  const itemDrag = useRef<ItemDrag | null>(null)
  const supportDrag = useRef<SupportDrag | null>(null)
  const [dragging, setDragging] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [itemPreview, setItemPreview] = useState<ItemPreview | null>(null)
  const [supportPreview, setSupportPreview] = useState<SupportPreview | null>(null)
  const [marker, setMarker] = useState<FaceMarker | null>(null)

  const faces = allowedFaces(plan)
  const width = systemWidth(plan)
  const rotation = THREE.MathUtils.degToRad(plan.system.placement.rotation)

  useEffect(() => {
    document.body.style.cursor = dragging ? 'grabbing' : hovering ? 'grab' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [dragging, hovering])

  function publish(current: ItemDrag) {
    const candidate = {
      ...current.item,
      bayIndex: current.bayIndex,
      height: current.height,
      face: current.face,
    }
    const proposal = current.duplicate
      ? proposeItemDuplicate(plan, catalog, candidate)
      : proposeItemMove(plan, catalog, candidate)
    current.valid = proposal?.valid ?? false
    if (proposal) current.height = proposal.candidate.height

    const x = bayCentre(plan, current.bayIndex)
    current.ghost.position.set(x, mm(current.height), pinDepth(plan, tracks, current.face))
    current.ghost.rotation.y = current.face === 'front' ? 0 : Math.PI
    current.ghost.visible = current.moved
    current.material.color.set(current.valid ? '#0076ad' : '#b53c30')
    current.ghost.updateMatrixWorld(true)

    if (current.moved && showDimensions) {
      const preview = {
        ...current.measurements,
        x,
        z: current.ghost.position.z,
        height: current.ghost.position.y,
        face: current.face,
      }
      setItemPreview((previous) =>
        previous &&
        previous.x === preview.x &&
        previous.z === preview.z &&
        previous.height === preview.height &&
        previous.face === preview.face
          ? previous
          : preview,
      )
    }

    const status = {
      itemId: current.id,
      face: current.face,
      valid: current.valid,
      duplicate: current.duplicate,
    }
    if (!sameStatus(current.published, status)) {
      current.published = status
      editor.trigger.dragChanged({ drag: status })
    }
    invalidate()
  }

  function finish(commit: boolean) {
    const current = itemDrag.current
    const support = supportDrag.current
    itemDrag.current = null
    supportDrag.current = null

    if (current) {
      current.ghost.removeFromParent()
      // Ghost geometry belongs to the live assembly; only its material is owned here
      current.material.dispose()
      releaseCapture(current.target, current.pointerId)
      if (commit && current.moved && current.valid) {
        editor.trigger.dropItem({
          id: current.id,
          bayIndex: current.bayIndex,
          height: current.height,
          face: current.face,
          duplicate: current.duplicate,
        })
      }
    }

    if (support) {
      placement.current?.position.copy(support.originalPosition)
      releaseCapture(support.target, support.pointerId)
      if (commit && support.moved) editor.trigger.moveSupports({ move: support.move })
    }

    setDragging(false)
    setMarker(null)
    setItemPreview(null)
    setSupportPreview(null)
    editor.trigger.dragChanged({ drag: null })
    invalidate()
  }

  const cancel = useEffectEvent(() => finish(false))
  useEffect(() => {
    const subscription = editor.on('cancelDrag', cancel)
    return () => subscription.unsubscribe()
  }, [])

  function startSupportDrag(
    event: ThreeEvent<PointerEvent>,
    supportIndex: number,
    group: THREE.Group,
  ) {
    editor.trigger.selectSupport({ index: supportIndex })

    const normal = isWallMounted(plan.system.mountingType)
      ? new THREE.Vector3(0, 0, 1).applyAxisAngle(up, rotation)
      : up.clone()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, event.point)
    const startPoint = event.ray.intersectPlane(plane, new THREE.Vector3())
    if (!startPoint) return

    const target = event.target as CaptureTarget
    supportDrag.current = {
      plane,
      startPoint,
      originalPosition: group.position.clone(),
      pointerId: event.pointerId,
      target,
      moved: false,
      move: {
        x: plan.system.placement.x,
        z: plan.system.placement.z,
        mountHeight: plan.system.mountHeight,
      },
    }
    target.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function startItemDrag(event: ThreeEvent<PointerEvent>, id: string, group: THREE.Group) {
    editor.trigger.selectItem({ id })

    const item = plan.system.items.find((candidate) => candidate.id === id)
    const object = assembly.children.find((child) => child.userData.itemId === id)
    if (!item || !object) return

    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(up, rotation)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      object.getWorldPosition(new THREE.Vector3()),
    )
    const startPoint = event.ray.intersectPlane(plane, new THREE.Vector3())
    if (!startPoint) return

    const proposal = proposeItemMove(plan, catalog, item)
    if (!proposal) return

    const { ghost, material } = makeDragGhost(assembly, proposal.movedItemIds, object)
    ghost.visible = false
    group.add(ghost)

    const bounds = dragPreviewBounds(ghost, id)
    const variant = catalog.variant(item.productId, item.variantId)
    const measurements = {
      width: variant ? mm(variant.width) : bounds.max.x - bounds.min.x,
      depth:
        item.orientation === 'vertical'
          ? bounds.max.z - bounds.min.z
          : Math.max(mm(variant?.depth ?? 0), bounds.max.z),
      bottom: bounds.min.y,
      tabletop: isIntegratedTable(item.productId),
    }

    // Mirror the grab point through the supports to find the same spot on the other face
    const localHit = group.worldToLocal(event.point.clone())
    const opposite = localHit.clone()
    opposite.z = (usesHPosts(plan, tracks) ? -0.068 : -0.048) - localHit.z

    const rect = gl.domElement.getBoundingClientRect()
    const projected = group.localToWorld(opposite.clone()).project(camera)
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

    const target = event.target as CaptureTarget
    itemDrag.current = {
      id,
      item,
      face: item.face,
      plane,
      startPoint,
      motionOrigin: object.position.clone(),
      ghost,
      material,
      target,
      pointerId: event.pointerId,
      moved: false,
      valid: proposal.valid,
      bayIndex: item.bayIndex,
      height: item.height,
      startScreen,
      oppositeScreen,
      client: startScreen.clone(),
      marker: faces.includes('back') ? group.worldToLocal(markerWorld) : null,
      destinationPoint: opposite,
      duplicate: event.altKey,
      measurements,
      published: null,
    }
    target.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function onPointerDown(event: ThreeEvent<PointerEvent>) {
    const group = placement.current
    if (!group || event.button !== 0 || itemDrag.current || supportDrag.current) return
    // The closest visible surface owns the click, including the rear face
    event.stopPropagation()

    const supportIndex = event.object.userData.supportIndex as number | undefined
    const itemId = event.object.userData.itemId as string | undefined
    if (supportIndex !== undefined) startSupportDrag(event, supportIndex, group)
    else if (itemId) startItemDrag(event, itemId, group)
  }

  function moveSupportRun(
    event: ThreeEvent<PointerEvent>,
    support: SupportDrag,
    group: THREE.Group,
  ) {
    event.stopPropagation()
    const point = event.ray.intersectPlane(support.plane, new THREE.Vector3())
    if (!point) return

    const delta = point.sub(support.startPoint)
    if (delta.length() < 0.012 && !support.moved) return
    support.moved = true

    const { mountingType } = plan.system
    if (isWallMounted(mountingType)) {
      // Wall-bound runs slide along their wall; only wall-mounted runs without table legs rise
      delta.applyAxisAngle(up, -rotation)
      delta.z = 0
      if (mountingType === 'semi-wall' || hasIntegratedTable(plan)) delta.y = 0
      delta.applyAxisAngle(up, rotation)
    } else {
      delta.y = 0
    }

    support.move = {
      x: Math.round(plan.system.placement.x + delta.x * 1000),
      z: Math.round(plan.system.placement.z + delta.z * 1000),
      mountHeight: Math.round(plan.system.mountHeight + delta.y * 1000),
    }
    group.position.copy(support.originalPosition).add(delta)
    group.updateMatrixWorld(true)

    if (showDimensions) {
      const anchor = new THREE.Vector3(-width / 2, 0, 0).applyAxisAngle(up, rotation)
      const preview = {
        x: Math.round((group.position.x + anchor.x) * 1000) / 1000,
        z: Math.round((group.position.z + anchor.z) * 1000) / 1000,
        height: mm(support.move.mountHeight),
      }
      setSupportPreview((previous) =>
        previous &&
        previous.x === preview.x &&
        previous.z === preview.z &&
        previous.height === preview.height
          ? previous
          : preview,
      )
    }
    invalidate()
  }

  function moveItem(event: ThreeEvent<PointerEvent>, current: ItemDrag, group: THREE.Group) {
    event.stopPropagation()
    current.client.set(event.clientX, event.clientY)
    if (!current.moved && current.client.distanceTo(current.startScreen) < 8) return

    if (!current.moved && current.marker) {
      setMarker({
        point: current.marker,
        destination: current.destinationPoint,
        face: current.item.face === 'front' ? 'back' : 'front',
      })
    }
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
    const buttonFace = faceUnderPointer(event.clientX, event.clientY)

    if (buttonFace && faces.includes(buttonFace)) {
      current.face = buttonFace
      current.bayIndex = current.item.bayIndex
      current.height = current.item.height
    } else if (gesture.depthGesture || gesture.face !== current.face) {
      current.face = gesture.face
      current.bayIndex = current.item.bayIndex
      current.height = current.item.height
    } else {
      const point = event.ray.intersectPlane(current.plane, new THREE.Vector3())
      if (!point) return
      const delta = point.sub(current.startPoint).applyAxisAngle(up, -rotation)

      let closest = Number.POSITIVE_INFINITY
      plan.system.bays.forEach((_, index) => {
        const distance = Math.abs(current.motionOrigin.x + delta.x - bayCentre(plan, index))
        if (distance < closest) {
          closest = distance
          current.bayIndex = index
        }
      })
      current.height = snapPinHeight(
        Math.max(
          50,
          Math.min(plan.room.ceilingHeight - 50, (current.motionOrigin.y + delta.y) * 1000),
        ),
        plan,
      )
    }
    publish(current)

    if (current.face !== previousFace) {
      // Re-anchor planar motion after crossing, so the depth gesture cannot also change height
      const worldPoint = group.localToWorld(current.ghost.position.clone())
      current.plane.setFromNormalAndCoplanarPoint(current.plane.normal, worldPoint)
      const anchor = event.ray.intersectPlane(current.plane, new THREE.Vector3())
      if (anchor) current.startPoint.copy(anchor)
      current.motionOrigin.copy(current.ghost.position)
    }
  }

  function onPointerMove(event: ThreeEvent<PointerEvent>) {
    const group = placement.current
    if (!group) return

    const support = supportDrag.current
    const current = itemDrag.current
    if (support) moveSupportRun(event, support, group)
    else if (current && event.pointerId === current.pointerId) moveItem(event, current, group)
  }

  function onPointerUp(event: ThreeEvent<PointerEvent>) {
    if (!itemDrag.current && !supportDrag.current) return
    event.stopPropagation()

    // Resolve the release point too, so a fast drop on a face button still lands on that face
    const current = itemDrag.current
    if (current?.moved && event.type !== 'pointercancel') {
      current.duplicate = event.altKey
      const face = faceUnderPointer(event.clientX, event.clientY)
      if (face && faces.includes(face)) {
        current.face = face
        current.bayIndex = current.item.bayIndex
        current.height = current.item.height
        current.client.set(event.clientX, event.clientY)
      }
      publish(current)
    }
    finish(event.type !== 'pointercancel')
  }

  function onPointerOver(event: ThreeEvent<PointerEvent>) {
    if (event.object.userData.itemId || event.object.userData.supportIndex !== undefined) {
      event.stopPropagation()
      setHovering(true)
    }
  }

  return {
    dragging,
    itemPreview,
    supportPreview,
    marker,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerOver,
      onPointerOut: () => setHovering(false),
    },
  }
}
