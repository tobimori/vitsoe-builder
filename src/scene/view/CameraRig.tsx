import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useEffectEvent, useRef, type ComponentRef } from 'react'
import * as THREE from 'three'
import { editor, selectors } from '../../editor/editor'
import { mm } from '../models/primitives'
import { systemWidth } from '../models/assembly'

const up = new THREE.Vector3(0, 1, 0)

/** Frames the system on load and whenever the editor asks for a fresh view. */
export function CameraRig({
  assembly,
  dragging,
  focus,
}: {
  assembly: THREE.Group
  dragging: boolean
  /** The component to zoom to; a new object each time it is requested. */
  focus: { itemId: string } | null
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, size, invalidate } = useThree()

  const frame = useEffectEvent(() => {
    const { view, activeFace } = editor.getSnapshot().context
    const plan = selectors.plan.get()
    const width = systemWidth(plan)
    const height =
      plan.system.mountingType === 'floor-to-ceiling'
        ? mm(plan.room.ceilingHeight)
        : Math.max(...selectors.tracks.get().map((track) => mm(track.top)))
    const target = new THREE.Vector3(
      mm(plan.system.placement.x) + width / 2,
      Math.max(0.65, height * 0.6),
      mm(plan.system.placement.z) + 0.1,
    )
    const aspect = size.width / Math.max(1, size.height)
    const distance = Math.max(3.5, (width / Math.max(0.5, aspect)) * 1.95, height * 2.05)
    const back = view === 'orbit' ? activeFace === 'back' : view === 'back'
    const rotation = THREE.MathUtils.degToRad(plan.system.placement.rotation) + (back ? Math.PI : 0)
    const offset =
      view === 'orbit'
        ? new THREE.Vector3(distance * 0.25, distance * 0.14, distance)
        : new THREE.Vector3(0, 0.02, distance)
    offset.applyAxisAngle(up, rotation)

    camera.position.copy(target).add(offset)
    camera.lookAt(target)
    controls.current?.target.copy(target)
    controls.current?.update()
    invalidate()
  })

  useEffect(() => {
    frame()
    const subscription = editor.on('fitCamera', frame)
    return () => subscription.unsubscribe()
  }, [])

  const zoomTo = useEffectEvent((itemId: string) => {
    const orbit = controls.current
    const object = assembly.children.find((child) => child.userData.itemId === itemId)
    if (!orbit || !object) return

    const bounds = new THREE.Box3().setFromObject(object)
    const target = bounds.getCenter(new THREE.Vector3())
    const extent = bounds.getSize(new THREE.Vector3())
    const distance = Math.max(
      0.55,
      (extent.x / Math.max(0.5, size.width / size.height)) * 2.1,
      extent.y * 2.5,
      extent.z * 2,
    )
    const direction = camera.position.clone().sub(orbit.target).normalize()
    camera.position.copy(target).addScaledVector(direction, distance)
    orbit.target.copy(target)
    orbit.update()
    invalidate()
  })

  useEffect(() => {
    if (focus) zoomTo(focus.itemId)
  }, [focus])

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
