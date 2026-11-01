import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { studioLighting } from '../studio/lighting'

/** Fits the key light's shadow camera to the furniture, so the shadow map keeps its detail. */
function fitShadow(light: THREE.DirectionalLight, assembly: THREE.Group) {
  light.target.updateMatrixWorld(true)
  light.updateMatrixWorld(true)
  light.shadow.updateMatrices(light)
  assembly.updateWorldMatrix(true, true)

  const bounds = new THREE.Box3().setFromObject(assembly)
  bounds.min.y = 0
  bounds.expandByScalar(0.3)

  const lightBounds = new THREE.Box3()
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        lightBounds.expandByPoint(
          new THREE.Vector3(x, y, z).applyMatrix4(light.shadow.camera.matrixWorldInverse),
        )
      }
    }
  }

  const camera = light.shadow.camera
  camera.left = lightBounds.min.x - 0.35
  camera.right = lightBounds.max.x + 0.35
  camera.bottom = lightBounds.min.y - 0.35
  camera.top = lightBounds.max.y + 0.35
  camera.updateProjectionMatrix()
}

const up = new THREE.Vector3(0, 1, 0)

/**
 * The window light comes from the front left of the face in view, high and frontal enough
 * that shelves cast short shadows behind them, as in Vitsœ's studio photographs.
 */
const keyOffset = new THREE.Vector3(-2, 5, 5)
const fillOffset = new THREE.Vector3(4, 3, 1.5)

export function StudioLights({
  assembly,
  x,
  z,
  rotation,
  moving,
}: {
  assembly: THREE.Group
  /** Centre of the run in metres. */
  x: number
  z: number
  /** The angle the face in view looks towards. */
  rotation: number
  /** Whether something that casts a shadow moves on its own, like a dragged component. */
  moving: boolean
}) {
  const get = useThree((state) => state.get)
  const invalidate = useThree((state) => state.invalidate)
  const keyLight = useRef<THREE.DirectionalLight>(null)
  const [target] = useState(() => new THREE.Object3D())
  const centre = new THREE.Vector3(x, 0, z)
  const key = keyOffset.clone().applyAxisAngle(up, rotation).add(centre)
  const fill = fillOffset.clone().applyAxisAngle(up, rotation).add(centre)

  // The shadow map is drawn again only when the furniture or the light moves, not the camera
  useEffect(() => {
    const { shadowMap } = get().gl
    shadowMap.autoUpdate = false
    shadowMap.needsUpdate = true
    target.position.set(x, 1, z)
    if (keyLight.current) fitShadow(keyLight.current, assembly)
    invalidate()
  }, [assembly, target, x, z, rotation, moving, get, invalidate])

  useFrame(({ gl }) => {
    if (moving) gl.shadowMap.needsUpdate = true
  })

  return (
    <>
      <ambientLight intensity={studioLighting.ambient} />
      <hemisphereLight args={['#ffffff', '#a8a8a4', studioLighting.hemisphere]} />
      <primitive object={target} />
      <directionalLight
        ref={keyLight}
        name="Studio window key"
        position={key}
        target={target}
        color="#fffdfa"
        intensity={studioLighting.key}
        castShadow
        shadow-intensity={studioLighting.shadow}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.001}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        shadow-radius={5}
      />
      <directionalLight position={fill} target={target} intensity={studioLighting.fill} />
    </>
  )
}
