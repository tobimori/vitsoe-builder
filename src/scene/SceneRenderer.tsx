import { useEffect, useEffectEvent, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { WebGLPathTracer } from 'three-gpu-pathtracer'
import type { GenerateMeshBVHWorker } from 'three-mesh-bvh/worker'
import type { RenderStatus } from '../domain/types'
import { studioEnvironmentTexture } from './environment'

const sampleLimit = 128
const timeLimit = 20_000

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), 30_000)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

/** Flatten visible physical objects only; guides and transient previews are excluded. */
export function presentationScene(source: THREE.Scene) {
  source.updateMatrixWorld(true)
  const scene = new THREE.Scene()
  scene.background = source.background
  scene.environment = studioEnvironmentTexture()
  scene.environmentIntensity = source.environmentIntensity

  source.traverseVisible((object) => {
    if (object instanceof THREE.Mesh) {
      let parent: THREE.Object3D | null = object
      while (parent) {
        if (parent.userData.dragPreview) return
        parent = parent.parent
      }

      const copy = new THREE.Mesh(object.geometry, object.material)
      object.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale)
      scene.add(copy)
    } else if (object instanceof THREE.DirectionalLight) {
      // The traced key is a finite window, giving actual soft shadows and bounce.
      const key = object.name === 'Studio window key'
      const light = new THREE.RectAreaLight(
        object.color,
        key ? 6 : 0.8,
        key ? 2.4 : 3,
        key ? 2.4 : 3,
      )
      light.position.copy(object.getWorldPosition(new THREE.Vector3()))
      light.lookAt(object.target.getWorldPosition(new THREE.Vector3()))
      scene.add(light)
    }
  })

  scene.updateMatrixWorld(true)
  return scene
}

type Session = {
  tracer: WebGLPathTracer
  worker: GenerateMeshBVHWorker
  denoise: FullScreenQuad
  ready: boolean
  building: boolean
  started: number
  complete: boolean
  prepared: number
}

export function SceneRenderer({
  enabled,
  onStatus,
  assembly,
  revision,
  dragging,
}: {
  enabled: boolean
  onStatus?: (status: RenderStatus) => void
  assembly: THREE.Group
  revision: string
  dragging: boolean
}) {
  const { gl, scene, camera, size, invalidate } = useThree()
  const composer = useRef<EffectComposer | null>(null)
  const session = useRef<Session | null>(null)
  const loading = useRef<Promise<Session> | null>(null)
  const mounted = useRef(true)
  const generation = useRef(0)
  const failed = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCamera = useRef(new THREE.Matrix4())
  const lastProjection = useRef(new THREE.Matrix4())
  const lastMotion = useRef(0)
  const lastProgress = useRef(0)
  const desired = useRef({ enabled, dragging })
  desired.current = { enabled, dragging }
  const status = useEffectEvent((value: RenderStatus) => onStatus?.(value))

  useEffect(() => {
    if (!gl.extensions.has('EXT_color_buffer_float')) return

    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, gl.capabilities.maxSamples),
    })
    const pipeline = new EffectComposer(gl, target)
    const ao = new GTAOPass(scene, camera)
    ao.updateGtaoMaterial({
      radius: 0.12,
      thickness: 0.04,
      distanceFallOff: 1,
      samples: 8,
      screenSpaceRadius: false,
    })
    ao.updatePdMaterial({ radius: 3, samples: 8 })
    ao.blendIntensity = 0.18
    pipeline.addPass(new RenderPass(scene, camera))
    pipeline.addPass(ao)
    pipeline.addPass(new OutputPass())
    pipeline.setSize(size.width, size.height)
    // Contact shading is denoised at half resolution; the main colour stays sharp.
    ao.setSize(
      Math.max(1, Math.round((size.width * gl.getPixelRatio()) / 2)),
      Math.max(1, Math.round((size.height * gl.getPixelRatio()) / 2)),
    )
    composer.current = pipeline
    invalidate()

    return () => {
      composer.current = null
      for (const pass of pipeline.passes) pass.dispose()
      pipeline.dispose()
    }
  }, [gl, scene, camera, size.width, size.height, invalidate])

  const fail = useEffectEvent((error: unknown) => {
    failed.current = true
    if (session.current) session.current.tracer.pausePathTracing = true
    status({
      phase: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Presentation rendering is unavailable on this device.',
    })
    invalidate()
  })

  const prepare = useEffectEvent(async () => {
    if (!desired.current.enabled || desired.current.dragging || !mounted.current || failed.current)
      return
    const token = generation.current

    try {
      if (!loading.current) {
        if (!gl.extensions.has('EXT_color_buffer_float'))
          throw new Error(
            'This device does not support the GPU features needed for presentation rendering.',
          )
        loading.current = withTimeout(
          Promise.all([import('three-gpu-pathtracer'), import('three-mesh-bvh/worker')]),
          'The renderer took too long to load. Return to editing and try again.',
        ).then(([pathtracing, workers]) => {
          if (!mounted.current || !desired.current.enabled) throw new Error('Rendering cancelled.')

          const tracer = new pathtracing.WebGLPathTracer(gl)
          const worker = new workers.GenerateMeshBVHWorker()
          tracer.setBVHWorker(worker)
          tracer.bounces = 5
          // v0.0.24 also sizes its random-sample texture from this value.
          // Keep the default: reducing it leaves BSDF dimensions out of bounds.
          tracer.transmissiveBounces = 10
          tracer.filterGlossyFactor = 0.35
          tracer.tiles.set(2, 2)
          tracer.textureSize.set(512, 512)
          tracer.renderScale = Math.min(
            1,
            1200 / Math.max(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio()),
          )
          tracer.renderDelay = 0
          tracer.minSamples = 1
          tracer.fadeDuration = 0
          tracer.rasterizeSceneCallback = () => gl.render(scene, camera)

          const denoiseMaterial = new pathtracing.DenoiseMaterial({
            sigma: 2,
            kSigma: 1.5,
            threshold: 0.1,
          })
          const denoise = new FullScreenQuad(denoiseMaterial)
          tracer.renderToCanvasCallback = (target, renderer, quad) => {
            const autoClear = renderer.autoClear
            renderer.autoClear = false
            try {
              if (tracer.samples >= 16) {
                denoiseMaterial.map = target.texture
                denoise.render(renderer)
              } else quad.render(renderer)
            } finally {
              renderer.autoClear = autoClear
            }
          }

          const value = {
            tracer,
            worker,
            denoise,
            ready: false,
            building: false,
            started: 0,
            complete: false,
            prepared: 0,
          }
          session.current = value
          return value
        })
      }

      const current = await loading.current
      if (!mounted.current || !desired.current.enabled || token !== generation.current) return
      if (current.building) {
        timer.current = setTimeout(() => void prepare(), 150)
        return
      }

      current.building = true
      current.ready = false
      status({ phase: 'loading', message: 'Preparing geometry and lighting…' })
      const build = current.tracer.setSceneAsync(presentationScene(scene), camera).finally(() => {
        current.building = false
      })
      await withTimeout(
        build,
        'Scene preparation took too long. Return to editing and try a smaller configuration.',
      )

      if (!mounted.current || !desired.current.enabled || token !== generation.current) return
      current.ready = true
      current.prepared = performance.now()
      current.complete = false
      current.started = 0
      current.tracer.pausePathTracing = false
      lastMotion.current = performance.now()
      lastCamera.current.copy(camera.matrixWorld)
      lastProjection.current.copy(camera.projectionMatrix)
      status({ phase: 'rendering', progress: 0, message: 'Refining light and reflections…' })
      invalidate()
    } catch (error) {
      if (!session.current) loading.current = null
      if (mounted.current && desired.current.enabled && token === generation.current) fail(error)
    }
  })

  useEffect(() => {
    generation.current++
    failed.current = false
    if (timer.current) clearTimeout(timer.current)
    if (session.current) {
      session.current.ready = false
      session.current.tracer.pausePathTracing = true
    }

    if (!enabled) status({ phase: 'idle' })
    else if (!dragging) {
      status({ phase: 'loading', message: 'Preparing presentation…' })
      timer.current = setTimeout(() => void prepare(), 350)
    }
    invalidate()

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [enabled, assembly, revision, dragging, invalidate])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current++
      if (timer.current) clearTimeout(timer.current)
      if (session.current) {
        session.current.worker.dispose()
        session.current.tracer.dispose()
        session.current.denoise.material.dispose()
        session.current.denoise.dispose()
      }
    }
  }, [])

  useFrame(() => {
    const current = session.current
    const moving =
      !lastCamera.current.equals(camera.matrixWorld) ||
      !lastProjection.current.equals(camera.projectionMatrix)
    const now = performance.now()

    if (moving) {
      lastCamera.current.copy(camera.matrixWorld)
      lastProjection.current.copy(camera.projectionMatrix)
      lastMotion.current = now
      if (current?.ready) {
        current.tracer.updateCamera()
        current.complete = false
        current.started = 0
        current.prepared = now
      }
    }

    if (
      !enabled ||
      dragging ||
      failed.current ||
      !current?.ready ||
      now - lastMotion.current < 250
    ) {
      if (dragging || moving || !composer.current) gl.render(scene, camera)
      else composer.current.render()
      if (enabled && current?.ready && !failed.current && !dragging) invalidate()
      return
    }

    try {
      current.tracer.renderScale = Math.min(
        1,
        1200 / Math.max(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio()),
      )
      if (!current.started && now - current.prepared > 30_000)
        throw new Error('GPU shader preparation took too long. Return to editing and try again.')
      current.tracer.pausePathTracing = current.complete
      current.tracer.renderSample()
      if (!current.complete) {
        if (current.tracer.samples > 0 && !current.started) current.started = now
        const elapsed = current.started ? now - current.started : 0
        const progress = Math.min(
          1,
          Math.max(current.tracer.samples / sampleLimit, elapsed / timeLimit),
        )
        if (progress >= 1) {
          current.complete = true
          current.tracer.pausePathTracing = true
          status({
            phase: 'complete',
            progress: 1,
            message: 'Ready. Move the view to refine another angle.',
          })
        } else {
          if (now - lastProgress.current > 250) {
            lastProgress.current = now
            status({ phase: 'rendering', progress, message: 'Refining light and reflections…' })
          }
          invalidate()
        }
      }
    } catch (error) {
      fail(error)
    }
  }, 1)

  return null
}
