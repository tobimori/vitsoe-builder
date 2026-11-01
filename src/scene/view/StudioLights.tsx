import { useThree } from '@react-three/fiber'
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

export function StudioLights({
  assembly,
  x,
  z,
  rotation,
}: {
  assembly: THREE.Group
  /** Centre of the run in metres. */
  x: number
  z: number
  rotation: number
}) {
  const invalidate = useThree((state) => state.invalidate)
  const keyLight = useRef<THREE.DirectionalLight>(null)
  const [target] = useState(() => new THREE.Object3D())

  useEffect(() => {
    target.position.set(x, 1, z)
    if (keyLight.current) fitShadow(keyLight.current, assembly)
    invalidate()
  }, [assembly, target, x, z, rotation, invalidate])

  return (
    <>
      <ambientLight intensity={studioLighting.ambient} />
      <hemisphereLight args={['#fffdf8', '#89867d', studioLighting.hemisphere]} />
      <primitive object={target} />
      <directionalLight
        ref={keyLight}
        name="Studio window key"
        position={[x - 3, 5.5, z + 4]}
        target={target}
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
        target={target}
        intensity={studioLighting.fill}
      />
    </>
  )
}
