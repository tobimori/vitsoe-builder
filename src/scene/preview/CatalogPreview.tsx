import * as stylex from '@stylexjs/stylex'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import * as THREE from 'three'
import { catalog } from '../../domain/catalog/catalog'
import { fixedMaterialLabel } from '../../domain/catalog/families'
import type { CatalogProduct, ProductVariant } from '../../domain/catalog/types'
import type { Colour, Finish } from '../../domain/types'
import { disposeAssembly } from '../models/assembly'
import { makeComponent, type ModelItem } from '../models/components'
import { createStudioEnvironment } from '../studio/environment'
import { studioLighting } from '../studio/lighting'

export interface CatalogPreviewProps {
  product: CatalogProduct
  variant: ProductVariant
  finish: Finish
  frontFinish?: Colour
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
  // An open back is shown on the cabinet it replaces the back of
  const cabinet = showBack ? catalog.product('retractable-flap-cabinet') : undefined
  if (cabinet) {
    product = cabinet
    variant =
      cabinet.variants.find((entry) => entry.width === props.variant.width) ??
      cabinet.variants[0] ??
      variant
  }
  const item: ModelItem = {
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

const styles = stylex.create({
  frame: (aspectRatio: string) => ({
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    aspectRatio,
  }),
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  failed: {
    color: '#777',
    fontSize: 12,
  },
})

/** A cached still of the real component model, so cards never hold a live WebGL canvas. */
export function CatalogPreview(props: CatalogPreviewProps) {
  const key = JSON.stringify([
    props.product.id,
    props.variant.id,
    props.finish,
    props.frontFinish,
    props.width ?? 320,
    props.height ?? 200,
  ])
  return <PreviewImage key={key} cacheKey={key} {...props} />
}

function PreviewImage({ cacheKey, ...props }: CatalogPreviewProps & { cacheKey: string }) {
  const container = useRef<HTMLDivElement>(null)
  const width = props.width ?? 320
  const height = props.height ?? 200
  const [image, setImage] = useState(() => images.get(cacheKey))
  const [failed, setFailed] = useState(false)
  const materialLabel =
    fixedMaterialLabel(props.product.id)?.toLowerCase() ??
    (props.product.id === 'drawer-divider' ? 'black laminate' : props.finish)

  const render = useEffectEvent(() => imageFor(cacheKey, props))

  useEffect(() => {
    const element = container.current
    if (!element || images.has(cacheKey)) return

    let active = true
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        render().then(
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
  }, [cacheKey])

  return (
    <div ref={container} {...stylex.props(styles.frame(`${width} / ${height}`))}>
      {image ? (
        <img
          src={image}
          alt={`${props.product.name} in ${materialLabel}`}
          draggable={false}
          {...stylex.props(styles.image)}
        />
      ) : failed ? (
        <span {...stylex.props(styles.failed)}>Preview unavailable</span>
      ) : null}
    </div>
  )
}
