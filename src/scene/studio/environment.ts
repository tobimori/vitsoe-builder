import * as THREE from 'three'

let source: THREE.DataTexture | undefined

/** One linear HDR source for window reflections and both rendering modes. */
export function studioEnvironmentTexture() {
  if (source) return source

  const width = 512
  const height = 256
  const pixels = new Float32Array(width * height * 4)
  const windowDirection = new THREE.Vector3(-3, 4.5, 4).normalize()
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), windowDirection)
    .normalize()
  const up = new THREE.Vector3().crossVectors(windowDirection, right)
  const direction = new THREE.Vector3()

  for (let y = 0; y < height; y++) {
    const theta = Math.PI * (1 - (y + 0.5) / height)

    for (let x = 0; x < width; x++) {
      const phi = ((x + 0.5) / width - 0.5) * Math.PI * 2
      direction.set(
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi),
      )
      const facing = direction.dot(windowDirection)
      const u = direction.dot(right) / Math.max(facing, 0.001)
      const v = direction.dot(up) / Math.max(facing, 0.001)
      const edge = Math.max(Math.abs(u) / 0.32, Math.abs(v) / 0.45)
      const window = facing > 0 ? 1 - THREE.MathUtils.smoothstep(edge, 0.9, 1) : 0
      const room = 0.4 + 0.55 * THREE.MathUtils.smoothstep(direction.y, -0.5, 0.9)
      const value = room + window * 5
      const index = (y * width + x) * 4
      pixels[index] = value
      pixels[index + 1] = value * 0.99
      pixels[index + 2] = value * 0.96
      pixels[index + 3] = 1
    }
  }

  source = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType)
  source.name = '606 studio window HDR'
  source.mapping = THREE.EquirectangularReflectionMapping
  source.colorSpace = THREE.LinearSRGBColorSpace
  source.needsUpdate = true
  return source
}

export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const generator = new THREE.PMREMGenerator(renderer)
  const environment = generator.fromEquirectangular(studioEnvironmentTexture())
  generator.dispose()
  return environment
}
