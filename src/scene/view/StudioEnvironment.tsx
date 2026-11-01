import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { createStudioEnvironment } from '../studio/environment'
import { studioLighting } from '../studio/lighting'

export function StudioEnvironment() {
  const get = useThree((state) => state.get)

  useEffect(() => {
    const { gl, scene, invalidate } = get()
    const environment = createStudioEnvironment(gl)
    scene.environment = environment.texture
    scene.environmentIntensity = studioLighting.environment
    invalidate()

    return () => {
      scene.environment = null
      environment.dispose()
    }
  }, [get])

  return null
}
