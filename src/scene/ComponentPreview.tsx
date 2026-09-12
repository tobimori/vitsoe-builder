import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createStudioEnvironment } from './environment'
import type {
  CatalogProduct,
  FinishId,
  FrontFinish,
  PlacedItem,
  ProductVariant,
} from '../domain/types'
import { catalog } from '../data/catalog'
import { makeComponent } from './components'
import { disposeAssembly } from './geometry'
import { studioLighting } from './lighting'

export interface CatalogPreviewProps {
  product: CatalogProduct
  variant: ProductVariant
  finish: FinishId
  frontFinish?: FrontFinish
  width?: number
  height?: number
}

type PreviewEngine = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  environment: THREE.WebGLRenderTarget
}

let engine: PreviewEngine | undefined
const images = new Map<string, string>()
const pending = new Map<string, Promise<string>>()
let queue = Promise.resolve()

function previewEngine() {
  if (engine) return engine
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(1)
  renderer.setClearColor('#f2f2ed', 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  const environment = createStudioEnvironment(renderer)
  scene.environment = environment.texture
  scene.environmentIntensity = studioLighting.environment
  scene.add(new THREE.AmbientLight('#ffffff', studioLighting.ambient))
  scene.add(new THREE.HemisphereLight('#fffdf8', '#89867d', studioLighting.hemisphere))
  const key = new THREE.DirectionalLight('#fffdf8', studioLighting.key)
  key.position.set(-3, 4.5, 4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = key.shadow.camera.bottom = -1
  key.shadow.camera.right = key.shadow.camera.top = 1
  key.shadow.camera.near = 0.1
  key.shadow.camera.far = 12
  key.shadow.bias = -0.0001
  key.shadow.normalBias = 0.001
  key.shadow.radius = 1
  const fill = new THREE.DirectionalLight('#ffffff', studioLighting.fill)
  fill.position.set(4, 2, -2)
  scene.add(key, fill)
  engine = {
    renderer,
    scene,
    environment,
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100),
  }
  return engine
}

function buildPreview(props: CatalogPreviewProps) {
  let { product, variant } = props
  const showBack = product.id === 'open-back'
  if (showBack) {
    product = catalog.find((entry) => entry.id === 'retractable-flap-cabinet')!
    variant =
      product.variants.find((entry) => entry.width === props.variant.width) ?? product.variants[0]
  }
  const item: PlacedItem = {
    id: 'catalogue-preview',
    productId: product.id,
    variantId: variant.id,
    bayIndex: 0,
    height: 635,
    face: 'front',
    finish: props.finish,
    frontFinish: props.frontFinish,
    open:
      showBack ||
      [
        'desk-shelf',
        'shelf-with-drawer',
        'retractable-flap-cabinet',
        'drop-front-cabinet',
      ].includes(product.id),
  }
  const model = makeComponent(product, item, variant)
  if (showBack)
    model.traverse((object) => {
      if (object.name === 'Cabinet back') object.visible = false
    })
  return { model, showBack, accessory: props.product.category === 'accessories' && !showBack }
}

function renderPreview(props: CatalogPreviewProps) {
  const { renderer, scene, camera } = previewEngine()
  const width = Math.max(160, Math.min(480, props.width ?? 320))
  const height = Math.max(100, Math.min(360, props.height ?? 200))
  renderer.setSize(width, height, false)
  const { model, showBack, accessory } = buildPreview(props)
  const bounds = new THREE.Box3().setFromObject(model)
  const centre = bounds.getCenter(new THREE.Vector3())
  model.position.sub(centre)
  model.updateMatrixWorld(true)
  scene.add(model)
  camera.position.set(showBack ? -2 : 2, accessory ? 3.5 : 1.8, showBack ? -3.5 : 3.5)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  const viewBounds = new THREE.Box3()
  bounds.translate(centre.negate())
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z])
        viewBounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse))
    }
  }
  const projected = viewBounds.getSize(new THREE.Vector3())
  const halfHeight = Math.max(projected.y / 2, projected.x / 2 / (width / height), 0.025) * 1.14
  camera.left = (-halfHeight * width) / height
  camera.right = (halfHeight * width) / height
  camera.top = halfHeight
  camera.bottom = -halfHeight
  camera.updateProjectionMatrix()
  try {
    renderer.render(scene, camera)
    return renderer.domElement.toDataURL('image/png')
  } finally {
    scene.remove(model)
    disposeAssembly(model)
  }
}

function imageFor(key: string, props: CatalogPreviewProps) {
  const cached = images.get(key)
  if (cached) return Promise.resolve(cached)
  const existing = pending.get(key)
  if (existing) return existing
  const promise = new Promise<string>((resolve, reject) => {
    queue = queue.then(
      () =>
        new Promise<void>((done) => {
          // One still at a time, yielding between cards; no animation loop.
          window.setTimeout(() => {
            try {
              const image = renderPreview(props)
              images.set(key, image)
              resolve(image)
            } catch (error) {
              reject(error)
            } finally {
              pending.delete(key)
              done()
            }
          }, 20)
        }),
    )
  })
  pending.set(key, promise)
  return promise
}

export function CatalogPreview(props: CatalogPreviewProps) {
  const container = useRef<HTMLDivElement>(null)
  const key = JSON.stringify([
    props.product.id,
    props.variant.id,
    props.finish,
    props.frontFinish,
    props.width ?? 320,
    props.height ?? 200,
  ])
  const [image, setImage] = useState<string | undefined>(() => images.get(key))
  const [failed, setFailed] = useState(false)
  const materialLabel =
    props.product.id === 'drawer-liner'
      ? 'grey wool felt'
      : ['aluminium-tray', 'pen-tray'].includes(props.product.id)
        ? 'natural anodized aluminium'
        : props.product.id === 'drawer-divider'
          ? 'black laminate'
          : props.finish

  useEffect(() => {
    let active = true
    setImage(images.get(key))
    setFailed(false)
    const element = container.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        imageFor(key, props).then(
          (image) => {
            if (active) setImage(image)
          },
          () => {
            if (active) setFailed(true)
          },
        )
      },
      { rootMargin: '80px' },
    )
    observer.observe(element)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [
    key,
    props.product,
    props.variant,
    props.finish,
    props.frontFinish,
    props.width,
    props.height,
  ])

  return (
    <div
      ref={container}
      className="catalog-preview"
      style={{
        width: '100%',
        aspectRatio: `${props.width ?? 320} / ${props.height ?? 200}`,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {image ? (
        <img
          src={image}
          alt={`${props.product.name} in ${materialLabel}`}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : failed ? (
        <span style={{ fontSize: 12, color: '#777' }}>Preview unavailable</span>
      ) : null}
    </div>
  )
}

export default CatalogPreview
