import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useAtom } from '@xstate/store-react'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { editor, selectors, useEditor } from '../editor/editor'
import { FaceTarget, ItemGuides, SupportGuides } from './interaction/DragGuides'
import { useAssemblyDrag } from './interaction/useAssemblyDrag'
import { disposeAssembly, systemWidth } from './models/assembly'
import { onDecorTexturesLoaded } from './models/decor'
import { mm } from './models/primitives'
import { SceneRenderer } from './render/SceneRenderer'
import { assemblyAtom } from './view/assembly'
import { CameraRig } from './view/CameraRig'
import { Dimension } from './view/Dimension'
import { Room } from './view/Room'
import { SelectionOutline } from './view/SelectionOutline'
import { StudioEnvironment } from './view/StudioEnvironment'
import { StudioLights } from './view/StudioLights'

function Workspace() {
  const invalidate = useThree((state) => state.invalidate)
  const plan = useAtom(selectors.plan)
  const tracks = useAtom(selectors.tracks)
  const assembly = useAtom(assemblyAtom)
  const selection = useEditor((context) => context.selection)
  const rendering = useEditor((context) => context.rendering)
  const showDimensions = useEditor((context) => context.showDimensions) && !rendering
  const placement = useRef<THREE.Group>(null)
  const [focus, setFocus] = useState<{ itemId: string } | null>(null)

  const drag = useAssemblyDrag({ plan, tracks, assembly, placement, showDimensions })

  useEffect(() => onDecorTexturesLoaded(invalidate), [invalidate])
  useEffect(() => () => disposeAssembly(assembly), [assembly])

  const { room, system } = plan
  const width = systemWidth(plan)
  const x = mm(system.placement.x) + width / 2
  const z = mm(system.placement.z)
  const rotation = THREE.MathUtils.degToRad(system.placement.rotation)
  const runLabelHeight = Math.max(0.15, mm(system.mountHeight)) - 0.06

  return (
    <>
      <color attach="background" args={['#f1f0e9']} />
      <StudioEnvironment />
      <StudioLights assembly={assembly} x={x} z={z} rotation={rotation} />
      <Room room={room} showDimensions={showDimensions} />
      {showDimensions && drag.supportPreview && <SupportGuides preview={drag.supportPreview} />}

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
        {showDimensions && drag.itemPreview && <ItemGuides preview={drag.itemPreview} />}
        {drag.marker && <FaceTarget marker={drag.marker} />}
        {showDimensions && (
          <Dimension
            start={[-width / 2, runLabelHeight, 0.48]}
            end={[width / 2, runLabelHeight, 0.48]}
            label={`${Math.round(width * 1000)} mm · ${system.bays.length} bays`}
          />
        )}
      </group>

      {!rendering && <SelectionOutline assembly={assembly} selection={selection} />}
      <SceneRenderer
        enabled={rendering}
        onStatus={(status) => editor.trigger.renderStatusChanged({ status })}
        assembly={assembly}
        revision={`${x},${z},${rotation},${room.width},${room.depth},${room.ceilingHeight}`}
        dragging={drag.dragging}
      />
      <CameraRig assembly={assembly} dragging={drag.dragging} focus={focus} />
    </>
  )
}

export function BuilderScene() {
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
      onPointerMissed={() => editor.trigger.clearSelection()}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <Workspace />
      </Suspense>
    </Canvas>
  )
}
