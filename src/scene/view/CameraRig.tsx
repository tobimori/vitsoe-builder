import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useEffectEvent, useRef, type ComponentRef } from 'react'
import * as THREE from 'three'
import { allowedFaces } from '../../domain/plan/system'
import { editor, selectors } from '../../editor/editor'
import { systemWidth } from '../models/assembly'
import { mm } from '../models/primitives'
import { runAxes, up } from './axes'

const FLIGHT_DURATION = 600

interface Flight {
  start: number
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  from: THREE.Spherical
  to: THREE.Spherical
}

const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Frames the system and flies the camera between views. The face the camera looks at
 * becomes the active face, so orbiting round a two-sided system switches the face too.
 */
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
  const flight = useRef<Flight | null>(null)
  const { camera, size, invalidate } = useThree()

  const fly = useEffectEvent((position: THREE.Vector3, target: THREE.Vector3, instant = false) => {
    const orbit = controls.current
    if (!orbit) return

    if (instant || reducedMotion()) {
      flight.current = null
      camera.position.copy(position)
      orbit.target.copy(target)
      orbit.update()
      invalidate()
      return
    }

    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target))
    const to = new THREE.Spherical().setFromVector3(position.clone().sub(target))
    // Take the shorter way round the system
    to.theta =
      from.theta +
      THREE.MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, Math.PI * 2) -
      Math.PI
    flight.current = {
      start: performance.now(),
      fromTarget: orbit.target.clone(),
      toTarget: target.clone(),
      from,
      to,
    }
    invalidate()
  })

  const frame = useEffectEvent((instant = false) => {
    const { view, activeFace } = editor.getSnapshot().context
    const plan = selectors.plan.get()
    const { centre, rotation } = runAxes(plan)
    const width = systemWidth(plan)
    const height =
      plan.system.mountingType === 'floor-to-ceiling'
        ? mm(plan.room.ceilingHeight)
        : Math.max(...selectors.tracks.get().map((track) => mm(track.top)))
    const target = centre.clone().setY(Math.max(0.6, height * 0.47))
    target.add(new THREE.Vector3(0, 0, 0.1).applyAxisAngle(up, rotation))

    const aspect = size.width / Math.max(1, size.height)
    const distance = Math.max(3.5, (width / Math.max(0.5, aspect)) * 2.2, height * 2.3)
    const offset =
      view === 'orbit'
        ? new THREE.Vector3(distance * 0.25, distance * 0.14, distance)
        : new THREE.Vector3(0, 0.02, distance)
    offset.applyAxisAngle(up, rotation + (activeFace === 'back' ? Math.PI : 0))

    fly(target.clone().add(offset), target, instant)
  })

  /** Mirrors the camera through the run, so the same spot is seen from the other face. */
  const turn = useEffectEvent(() => {
    const { view, activeFace } = editor.getSnapshot().context
    const orbit = controls.current
    if (view === 'elevation' || !orbit) {
      frame()
      return
    }

    const normal = runAxes(selectors.plan.get()).front
    if (activeFace === 'back') normal.negate()
    const offset = camera.position.clone().sub(orbit.target)
    const along = offset.dot(normal)
    if (along > 0) return

    fly(orbit.target.clone().add(offset.addScaledVector(normal, -2 * along)), orbit.target)
  })

  useEffect(() => {
    frame(true)
    const fit = editor.on('fitCamera', () => frame())
    const turned = editor.on('turnCamera', turn)
    return () => {
      fit.unsubscribe()
      turned.unsubscribe()
    }
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
    fly(target.clone().addScaledVector(direction, distance), target)
  })

  useEffect(() => {
    if (focus) zoomTo(focus.itemId)
  }, [focus])

  useFrame(() => {
    const orbit = controls.current
    if (!orbit) return

    const current = flight.current
    if (current) {
      const t = Math.min(1, (performance.now() - current.start) / FLIGHT_DURATION)
      const e = ease(t)
      const lerp = (a: number, b: number) => a + (b - a) * e
      orbit.target.lerpVectors(current.fromTarget, current.toTarget, e)
      camera.position
        .setFromSpherical(
          new THREE.Spherical(
            lerp(current.from.radius, current.to.radius),
            lerp(current.from.phi, current.to.phi),
            lerp(current.from.theta, current.to.theta),
          ),
        )
        .add(orbit.target)
      orbit.update()
      if (t < 1) invalidate()
      else flight.current = null
      return
    }

    const plan = selectors.plan.get()
    if (!allowedFaces(plan).includes('back')) return

    const { centre, front } = runAxes(plan)
    const offset = camera.position.clone().sub(centre).setY(0)
    const along = offset.dot(front)
    // A margin either side of the run's plane stops the face flickering when seen edge-on
    if (Math.abs(along) < offset.length() * 0.08) return
    const face = along > 0 ? 'front' : 'back'
    if (editor.getSnapshot().context.activeFace !== face) editor.trigger.faceInView({ face })
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!dragging}
      enableRotate
      minDistance={0.35}
      maxDistance={20}
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI / 2}
      screenSpacePanning
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      enableDamping
      dampingFactor={0.12}
      onStart={() => {
        flight.current = null
      }}
    />
  )
}
