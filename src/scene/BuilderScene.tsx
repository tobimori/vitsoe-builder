import { Canvas, events, useThree, type ThreeEvent } from '@react-three/fiber'
import { useAtom } from '@xstate/store-react'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { editor, selectors, useEditor } from '../editor/editor'
import type { Plan } from '../domain/plan/types'
import type { Selection } from '../editor/store'
import { DrawingView } from './drawing/DrawingView'
import { castRay, ObliqueCamera } from './drawing/ObliqueCamera'
import { ItemGuides, RunGuides } from './interaction/DragGuides'
import { PlacementTool } from './interaction/PlacementTool'
import { ownBounds } from './interaction/drag'
import { touchScreen } from '../ui/touch'
import { measureItem, useAssemblyDrag, type ItemPreview } from './interaction/useAssemblyDrag'
import { disposeAssembly } from './models/assembly'
import { studioLighting } from './studio/lighting'
import { assemblyAtom } from './view/assembly'
import { runAxes } from './view/axes'
import { CameraRig } from './view/CameraRig'
import { Room } from './view/Room'
import { SelectionOutline } from './view/SelectionOutline'
import { StudioEnvironment } from './view/StudioEnvironment'
import { StudioLights } from './view/StudioLights'

function part(assembly: THREE.Group, selection: Selection) {
  return assembly.children.find((child) =>
    selection?.type === 'item'
      ? child.userData.itemId === selection.id
      : selection?.type === 'support' && child.userData.supportIndex === selection.index,
  )
}

/** The measurements of a component in the view; accessories have no pin height of their own. */
function measuredItem(plan: Plan, assembly: THREE.Group, id: string): ItemPreview | null {
  const item = plan.system.items.find((entry) => entry.id === id)
  const object = part(assembly, { type: 'item', id })
  if (!item || item.parentItemId || !object) return null
  const { x, y, z } = object.position
  return { ...measureItem(item, ownBounds(object)), x, z, height: y, face: item.face }
}

/** Whether Alt is held, which shows every measurement as Figma's measuring key does. */
function useAltHeld() {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const update = (event: KeyboardEvent) => {
      setHeld(event.altKey)
      // Firefox otherwise opens its menu bar when Alt is released on its own
      if (event.type === 'keyup' && event.key === 'Alt') event.preventDefault()
    }
    const release = () => setHeld(false)
    window.addEventListener('keydown', update)
    window.addEventListener('keyup', update)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', update)
      window.removeEventListener('keyup', update)
      window.removeEventListener('blur', release)
    }
  }, [])

  return held
}

/** R3F sizes only the camera in use, so the other one may be out of date. */
function sizeCamera(camera: THREE.Camera, width: number, height: number) {
  if (camera instanceof ObliqueCamera) {
    camera.setSize(width, height)
  } else if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
  }
}

/**
 * Switches between the studio's perspective camera and the drawing's oblique camera.
 * Returns whether the requested camera is in use, so a rig never binds to the other one.
 */
function useViewCamera(drawing: boolean) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const set = useThree((state) => state.set)
  const [cameras] = useState(() => ({
    studio: camera as THREE.PerspectiveCamera,
    drawing: new ObliqueCamera(),
  }))
  const wanted = drawing ? cameras.drawing : cameras.studio

  useLayoutEffect(() => {
    sizeCamera(wanted, size.width, size.height)
    set({ camera: wanted })
  }, [wanted, size, set])

  return camera === wanted
}

function Workspace() {
  const plan = useAtom(selectors.plan)
  const tracks = useAtom(selectors.tracks)
  const assembly = useAtom(assemblyAtom)
  const selection = useEditor((context) => context.selection)
  const showDimensions = useEditor((context) => context.showDimensions)
  const backFace = useEditor((context) => context.activeFace === 'back')
  const dimensionDepth = backFace ? -0.48 : 0.48
  const drawing = useEditor((context) => context.view === 'drawing')
  const placing = useEditor((context) => context.placing)
  const cameraReady = useViewCamera(drawing)
  const placement = useRef<THREE.Group>(null)
  const [focus, setFocus] = useState<{ itemId: string } | null>(null)

  const altHeld = useAltHeld()
  const drag = useAssemblyDrag({ plan, tracks, assembly, placement })

  useEffect(() => {
    const subscription = editor.on('zoomTo', ({ itemId }) => setFocus({ itemId }))
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => () => disposeAssembly(assembly), [assembly])

  const selected = part(assembly, selection)
  const hover = drag.dragging || placing ? undefined : part(assembly, drag.hover)
  const hovered = hover === selected ? undefined : hover

  const { centre, rotation } = runAxes(plan)
  const { x, z } = centre

  // Measurements stay hidden until something is hovered or dragged, or Alt shows them all
  const revealed = showDimensions || altHeld
  const measuredId =
    drag.hover?.type === 'item'
      ? drag.hover.id
      : selection?.type === 'item' && (revealed || touchScreen)
        ? selection.id
        : undefined
  const itemGuides =
    drag.itemPreview ??
    (measuredId && !drag.dragging && !placing ? measuredItem(plan, assembly, measuredId) : null)
  const runGuides =
    revealed ||
    drag.supportPreview !== null ||
    drag.hover?.type === 'support' ||
    selection?.type === 'support'

  return (
    <>
      <color attach="background" args={[drawing ? '#ffffff' : studioLighting.background]} />
      <StudioEnvironment />
      {!drawing && (
        <StudioLights
          assembly={assembly}
          x={x}
          z={z}
          rotation={rotation + (backFace ? Math.PI : 0)}
          moving={drag.dragging || Boolean(placing)}
        />
      )}
      {!drawing && <Room room={plan.room} />}

      <group ref={placement} position={[x, 0, z]} rotation={[0, rotation, 0]}>
        <primitive
          object={assembly}
          {...drag.handlers}
          onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
            const itemId = event.object.userData.itemId as string | undefined
            if (!itemId) return
            event.stopPropagation()
            setFocus({ itemId })
          }}
        />
        {placing && (
          <PlacementTool placing={placing} plan={plan} tracks={tracks} drawing={drawing} />
        )}
        {itemGuides && <ItemGuides preview={itemGuides} />}
        {runGuides && (
          <RunGuides
            plan={plan}
            preview={drag.supportPreview}
            depth={dimensionDepth}
            room={!drawing}
          />
        )}
      </group>

      {cameraReady &&
        (drawing ? (
          <DrawingView
            assembly={assembly}
            selected={selected}
            hovered={hovered}
            dragging={drag.dragging}
            focus={focus}
          />
        ) : (
          <>
            {selected && (
              <SelectionOutline key={selected.uuid} object={selected} colour="#0073b1" />
            )}
            {hovered && <SelectionOutline key={hovered.uuid} object={hovered} colour="#7ab0d0" />}
            <CameraRig assembly={assembly} dragging={drag.dragging} focus={focus} />
          </>
        ))}
    </>
  )
}

export function BuilderScene() {
  // Lines cost little to draw and look crisper at the screen's full resolution
  const drawing = useEditor((context) => context.view === 'drawing')

  return (
    <Canvas
      frameloop="demand"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={drawing ? [1, 2] : [1, 1.5]}
      camera={{ position: [4, 2.8, 6], fov: 35, near: 0.02, far: 60 }}
      gl={{
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.NeutralToneMapping,
      }}
      events={(store) => ({
        ...events(store),
        compute(event, state) {
          state.pointer.set(
            (event.offsetX / state.size.width) * 2 - 1,
            -(event.offsetY / state.size.height) * 2 + 1,
          )
          castRay(state.raycaster, state.pointer, state.camera)
        },
      })}
      onPointerMissed={() => editor.trigger.clearSelection()}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <Workspace />
      </Suspense>
    </Canvas>
  )
}
