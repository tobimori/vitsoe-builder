import * as THREE from 'three'
import type { FinishId } from '../domain/types'

type Microfinish = 'satin' | 'powder' | 'lacquer'
const microtextures = new Map<Microfinish, THREE.CanvasTexture>()

function microtexture(finish: Microfinish) {
  const existing = microtextures.get(finish)
  if (existing) return existing
  if (typeof window === 'undefined') return null

  const canvas = window.document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return null

  const pixels = context.createImageData(256, 256)
  let seed = 606
  const contrast = finish === 'satin' ? 28 : finish === 'powder' ? 18 : 7

  for (let index = 0; index < pixels.data.length; index += 4) {
    seed = (1664525 * seed + 1013904223) >>> 0
    const roughness = 255 - Math.round((seed / 4294967296) * contrast)
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = roughness
    pixels.data[index + 3] = 255
  }

  context.putImageData(pixels, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.name = `606 ${finish} micro-roughness`
  texture.colorSpace = THREE.NoColorSpace
  // Coated and metal surfaces use metre-scale UVs: a 32 mm tile gives ~0.125 mm grain, filtered away at distance.
  texture.repeat.set(31.25, 31.25)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.anisotropy = 8

  microtextures.set(finish, texture)
  return texture
}

export const aluminium = new THREE.MeshStandardMaterial({
  color: '#eceeed',
  metalness: 0.82,
  roughness: 0.48,
  roughnessMap: microtexture('satin'),
})
export const polishedMetal = new THREE.MeshStandardMaterial({
  color: '#d0d2d0',
  metalness: 0.93,
  roughness: 0.18,
})
export const rubber = new THREE.MeshStandardMaterial({ color: '#282927', roughness: 0.88 })
export const recess = new THREE.MeshStandardMaterial({ color: '#30322f', roughness: 0.65 })
// The interior substrate is undocumented; this restrained dark surface follows photos.
export const drawerInterior = new THREE.MeshStandardMaterial({ color: '#353732', roughness: 0.57 })

type Surface = 'steel' | 'panel'
const materials = new Map<string, THREE.MeshStandardMaterial>()

function grainTexture(felt = false) {
  if (typeof window === 'undefined') return null
  const canvas = window.document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) return null
  const pixels = context.createImageData(512, 512)
  let randomSeed = 607
  const random = () => {
    randomSeed = (1664525 * randomSeed + 1013904223) >>> 0
    return randomSeed / 4294967296
  }

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const index = (y * 512 + x) * 4
      // Continuous veneer fibres. Their drift is coherent along the panel,
      // unlike independent pixel noise, which reads as a speckled coating.
      const wave = y + 3.5 * Math.sin(x / 150) + 0.8 * Math.sin(x / 59 + y / 180)
      const fine = Math.sin(wave * 0.95 + Math.sin(wave * 0.12) * 2)
      const broad = Math.sin(wave * 0.045 + x / 750)
      const tone = felt
        ? (random() - 0.5) * 27
        : fine * 2.2 + broad * 4 + Math.sin(wave * 0.37 + x / 360) * 1.6
      const base = felt ? [122, 124, 119] : [211, 177, 132]
      pixels.data[index] = base[0] + tone
      pixels.data[index + 1] = base[1] + tone
      pixels.data[index + 2] = base[2] + tone
      pixels.data[index + 3] = 255
    }
  }

  context.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

export function finishMaterial(finish: FinishId, surface: Surface = 'steel') {
  const key = `${finish}-${surface}`
  const existing = materials.get(key)
  if (existing) return existing

  const material = new THREE.MeshStandardMaterial({
    color:
      finish === 'black'
        ? '#20211f'
        : finish === 'silver'
          ? '#a3a6a7'
          : finish === 'beech'
            ? '#cdab7f'
            : '#deded3',
    metalness: finish === 'silver' && surface === 'steel' ? 0.38 : 0,
    roughness: finish === 'beech' ? 0.43 : surface === 'panel' ? 0.3 : 0.42,
    roughnessMap:
      finish === 'beech' ? null : microtexture(surface === 'panel' ? 'lacquer' : 'powder'),
  })

  if (finish === 'beech') {
    const texture = grainTexture()
    if (texture) {
      material.map = texture
      material.color.set('#ffffff')
    }
  }

  materials.set(key, material)
  return material
}

export function feltMaterial() {
  const key = 'felt'
  const existing = materials.get(key)
  if (existing) return existing
  const texture = grainTexture(true)
  const material = new THREE.MeshStandardMaterial({
    color: texture ? '#ffffff' : '#7a7c77',
    map: texture,
    roughness: 1,
  })
  materials.set(key, material)
  return material
}
