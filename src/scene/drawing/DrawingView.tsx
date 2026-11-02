import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtom } from '@xstate/store-react'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react'
import * as THREE from 'three'
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { editor, selectors, useEditor } from '../../editor/editor'
import { faceDirection, runAxes } from '../view/axes'
import { createInk, drawLines, isInkLine } from './lines'
import { lineOfSight, ObliqueCamera, PIVOT } from './ObliqueCamera'

/**
 * Line width in pixels per pixel of scale, so the lines thin out as the drawing gets
 * smaller, like a printed illustration. Vitsœ's drawings use about 1.3 px at 0.47 px/mm.
 */
const LINE_WEIGHT = 1.3 / 470
const lineWidth = (zoom: number) => THREE.MathUtils.clamp(zoom * LINE_WEIGHT, 0.5, 1.4)

/** Keeps the framed system clear of the view toolbar at the bottom of the stage, in pixels. */
const TOOLBAR_CLEARANCE = 40

function paint(object: THREE.Object3D | undefined, ink: LineMaterial) {
  object?.traverse((child) => {
    if (isInkLine(child)) child.material = ink
  })
}

/**
 * The active face drawn in lines like Vitsœ's system illustrations, always from the same
 * oblique angle. The view pans and zooms but does not turn.
 */
export function DrawingView({
  assembly,
  selected,
  hovered,
  dragging,
  focus,
}: {
  assembly: THREE.Group
  selected: THREE.Object3D[]
  hovered: THREE.Object3D | undefined
  dragging: boolean
  /** The component to zoom to; a new object each time it is requested. */
  focus: { itemId: string } | null
}) {
  const size = useThree((state) => state.size)
  const get = useThree((state) => state.get)
  const invalidate = useThree((state) => state.invalidate)
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const plan = useAtom(selectors.plan)
  const face = useEditor((context) => context.activeFace)
  const wall = plan.system.placement.wall
  const [inks] = useState(() => ({
    plain: createInk('#1c1c1c', 1),
    selected: createInk('#0073b1', 1),
    hovered: createInk('#7ab0d0', 1),
  }))

  const scaleLines = () => {
    const width = lineWidth(get().camera.zoom)
    for (const ink of Object.values(inks)) ink.linewidth = width
  }

  // Tone mapping also applies to the background, which would turn the paper grey
  useLayoutEffect(() => {
    const { gl } = get()
    const toneMapping = gl.toneMapping
    gl.toneMapping = THREE.NoToneMapping
    return () => {
      gl.toneMapping = toneMapping
    }
  }, [get])

  useLayoutEffect(() => {
    for (const ink of Object.values(inks)) ink.resolution.set(size.width, size.height)
  }, [inks, size])

  useEffect(
    () => () => {
      for (const ink of Object.values(inks)) ink.dispose()
    },
    [inks],
  )

  useLayoutEffect(() => {
    const facing = faceDirection(selectors.plan.get(), face)
    const restore = drawLines(assembly, lineOfSight(facing), inks.plain)
    invalidate()
    return () => {
      restore()
      invalidate()
    }
  }, [assembly, face, wall, inks, invalidate])

  useLayoutEffect(() => {
    paint(assembly, inks.plain)
    paint(hovered, inks.hovered)
    for (const object of selected) paint(object, inks.selected)
    invalidate()
  }, [assembly, face, wall, selected, hovered, inks, invalidate])

  const fit = useEffectEvent((bounds: THREE.Box3, fill = { x: 0.85, y: 0.74 }) => {
    const orbit = controls.current
    const { camera } = get()
    if (!orbit || !(camera instanceof ObliqueCamera) || bounds.isEmpty()) return
    const facing = faceDirection(selectors.plan.get(), editor.getSnapshot().context.activeFace)
    orbit.target.copy(camera.frame(bounds, facing, fill))
    const lift = TOOLBAR_CLEARANCE / camera.zoom
    orbit.target.y -= lift
    camera.position.y -= lift
    orbit.update()
    scaleLines()
    invalidate()
  })

  const fitSystem = useEffectEvent(() => {
    // The placement may have moved since the last render
    assembly.updateWorldMatrix(true, false)
    fit(new THREE.Box3().setFromObject(assembly))
  })

  // A plan change rebuilds the assembly after the request, so fit before the next frame
  const fitPending = useRef(false)
  useFrame(() => {
    if (!fitPending.current) return
    fitPending.current = false
    fitSystem()
  })

  /**
   * Looks at the same spot from the other face, at the same scale: the spot in the middle
   * of the view, where the line of sight crosses the run.
   */
  const turn = useEffectEvent(() => {
    const orbit = controls.current
    if (!orbit) return
    const { camera } = get()
    const plan = selectors.plan.get()
    const { centre, front } = runAxes(plan)
    const facing = faceDirection(plan, editor.getSnapshot().context.activeFace)
    const sight = lineOfSight(facing.clone().negate())
    const across = centre.sub(orbit.target).dot(front) / sight.dot(front)
    orbit.target.addScaledVector(sight, across)
    camera.position.copy(orbit.target).addScaledVector(facing, PIVOT)
    orbit.update()
    invalidate()
  })

  useEffect(() => {
    fitSystem()
    const fitted = editor.on('fitCamera', () => {
      fitPending.current = true
      invalidate()
    })
    const turned = editor.on('turnCamera', turn)
    return () => {
      fitted.unsubscribe()
      turned.unsubscribe()
    }
  }, [invalidate])

  const zoomTo = useEffectEvent((itemId: string) => {
    const object = assembly.children.find((child) => child.userData.itemId === itemId)
    if (object) fit(new THREE.Box3().setFromObject(object), { x: 0.5, y: 0.5 })
  })

  useEffect(() => {
    if (focus) zoomTo(focus.itemId)
  }, [focus])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!dragging}
      enableRotate={false}
      screenSpacePanning
      zoomToCursor
      minZoom={20}
      maxZoom={8000}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
      onChange={scaleLines}
    />
  )
}
