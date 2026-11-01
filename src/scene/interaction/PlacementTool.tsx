import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { catalog } from '../../domain/catalog/catalog'
import { hasFront, isIntegratedTable, orientationsFor } from '../../domain/catalog/families'
import { productOption, variantForBay } from '../../domain/catalog/options'
import { nearestFittingHeight, snapPinHeight, TABLETOP_HEIGHT } from '../../domain/placement/grid'
import { canPlaceItem } from '../../domain/placement/proposals'
import type { Plan, PlanItem } from '../../domain/plan/types'
import type { SupportTrackPlan } from '../../domain/supports/tracks'
import { editor } from '../../editor/editor'
import type { Placing } from '../../editor/store'
import { createInk, drawLines } from '../drawing/lines'
import { castRay, lineOfSight } from '../drawing/ObliqueCamera'
import {
  bayCentre,
  buildComponent,
  disposeAssembly,
  pinDepth,
  supportPositions,
} from '../models/assembly'
import { mm } from '../models/primitives'
import { faceDirection } from '../view/axes'
import { showFit } from './drag'

type NewItem = Omit<PlanItem, 'id'>

interface Ghost {
  key: string
  model: THREE.Group
  /** Height of the model's middle above its pin line, so the pointer holds it by the middle. */
  middle: number
  restoreLines?: () => void
}

/** A press that moves less than this, in pixels, is a click rather than a camera drag. */
const CLICK_TOLERANCE = 6

function bayAt(plan: Plan, x: number) {
  const supports = supportPositions(plan)
  const index = supports.findIndex((support) => x < support) - 1
  return index < 0 ? (x < (supports[0] ?? 0) ? 0 : plan.system.bays.length - 1) : index
}

const sameSpot = (a: NewItem | null, b: NewItem | null) =>
  a?.bayIndex === b?.bayIndex && a?.height === b?.height && a?.face === b?.face

/**
 * Places a catalogue component where the pointer points: it snaps to the bay and pin height
 * under the pointer, takes the width of that bay, and lands with a click or at the end of a
 * drag from the catalogue.
 */
export function PlacementTool({
  placing,
  plan,
  tracks,
  drawing,
}: {
  placing: Placing
  plan: Plan
  tracks: SupportTrackPlan[]
  drawing: boolean
}) {
  const get = useThree((state) => state.get)
  const invalidate = useThree((state) => state.invalidate)
  const size = useThree((state) => state.size)
  const root = useRef<THREE.Group>(null)
  const ghost = useRef<Ghost | null>(null)
  const target = useRef<{ item: NewItem; valid: boolean; position: THREE.Vector3 } | null>(null)
  const placed = useRef<NewItem | null>(null)
  const press = useRef<THREE.Vector2 | null>(null)
  const [ink] = useState(() => createInk('#0073b1', 1.2))

  useEffect(() => {
    ink.resolution.set(size.width, size.height)
  }, [ink, size])

  useLayoutEffect(() => {
    if (root.current) root.current.visible = false
  }, [])

  useEffect(
    () => () => {
      ink.dispose()
      const current = ghost.current
      current?.restoreLines?.()
      if (current) disposeAssembly(current.model)
    },
    [ink],
  )

  const showGhost = useEffectEvent((item: NewItem) => {
    const key = `${item.variantId}:${item.face}:${drawing}`
    if (ghost.current?.key === key) return ghost.current

    const previous = ghost.current
    previous?.restoreLines?.()
    if (previous) {
      previous.model.removeFromParent()
      disposeAssembly(previous.model)
    }

    const model = buildComponent(plan, catalog, tracks, { ...item, id: 'placing' })
    if (!model) return null
    model.position.set(0, 0, 0)
    model.traverse((object) => {
      object.raycast = () => {}
    })
    const bounds = new THREE.Box3().setFromObject(model)
    root.current?.add(model)
    const restoreLines = drawing
      ? drawLines(model, lineOfSight(faceDirection(plan, item.face)), ink)
      : undefined
    ghost.current = { key, model, middle: (bounds.min.y + bounds.max.y) / 2, restoreLines }
    return ghost.current
  })

  const hide = useEffectEvent(() => {
    target.current = null
    if (root.current) root.current.visible = false
    invalidate()
  })

  /** Finds the bay and pin height under the pointer and moves the ghost there. */
  const aim = useEffectEvent((clientX: number, clientY: number) => {
    const group = root.current
    const product = catalog.product(placing.productId)
    const option = product && productOption(product, placing.option)
    const { camera, gl, raycaster } = get()
    const rect = gl.domElement.getBoundingClientRect()
    const inside =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    if (!group?.parent || !product || !option || !inside) return hide()

    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    castRay(raycaster, pointer, camera)
    group.parent.updateWorldMatrix(true, false)
    const ray = raycaster.ray.clone().applyMatrix4(group.parent.matrixWorld.clone().invert())

    const face = editor.getSnapshot().context.activeFace
    const pinLine = new THREE.Plane(new THREE.Vector3(0, 0, 1), -pinDepth(plan, tracks, face))
    const point = ray.intersectPlane(pinLine, new THREE.Vector3())
    if (!point) return hide()

    const bayIndex = bayAt(plan, point.x)
    const bay = plan.system.bays[bayIndex]
    const variant = bay && variantForBay(option, bay.centreWidth)
    if (!variant) return hide()

    const draft: NewItem = {
      productId: product.id,
      variantId: variant.id,
      bayIndex,
      height: 0,
      face,
      finish: 'system',
      orientation: orientationsFor(product.id)[0],
      open: hasFront(product.id) ? false : undefined,
    }
    const current = showGhost(draft)
    if (!current) return hide()

    const pointerHeight = THREE.MathUtils.clamp(
      (point.y - current.middle) * 1000,
      50,
      plan.room.ceilingHeight - 50,
    )
    const fits = (height: number) =>
      canPlaceItem(plan, catalog, { ...draft, height, id: 'placing' })
    const fitting = isIntegratedTable(product.id)
      ? TABLETOP_HEIGHT
      : nearestFittingHeight(pointerHeight, plan, fits)
    const item = { ...draft, height: fitting ?? snapPinHeight(pointerHeight, plan) }
    const valid = fitting !== undefined && fits(item.height)
    const position = new THREE.Vector3(bayCentre(plan, bayIndex), mm(item.height), point.z)

    // A ghost glides between spots, but appears at the first one without flying in
    const appearing = !group.visible || !target.current
    target.current = { item, valid, position }
    if (appearing) group.position.copy(position)
    current.model.rotation.y = face === 'back' ? Math.PI : 0
    showFit(current.model, valid)
    // The component just placed fills the spot, until the pointer moves on
    group.visible = !sameSpot(placed.current, item)
    if (!group.visible) return invalidate()
    placed.current = null
    invalidate()
  })

  const place = useEffectEvent(() => {
    const spot = target.current
    if (!spot || !root.current?.visible) return
    if (!spot.valid) {
      editor.trigger.notify({ notice: 'It does not fit here.' })
      return
    }
    editor.trigger.placeItem({ item: spot.item })
    placed.current = spot.item
    if (root.current) root.current.visible = false
    invalidate()
  })

  useEffect(() => {
    const canvas = get().gl.domElement

    const onMove = (event: PointerEvent) => aim(event.clientX, event.clientY)
    const onDown = (event: PointerEvent) => {
      if (event.button === 0) press.current = new THREE.Vector2(event.clientX, event.clientY)
    }
    const onUp = (event: PointerEvent) => {
      const { placing: current } = editor.getSnapshot().context
      if (current?.fromCatalogue) {
        aim(event.clientX, event.clientY)
        if (target.current) place()
        editor.trigger.stopPlacing()
        return
      }
      const start = press.current
      press.current = null
      if (
        start &&
        start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) < CLICK_TOLERANCE
      ) {
        aim(event.clientX, event.clientY)
        place()
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [get])

  useFrame((_, delta) => {
    const group = root.current
    const spot = target.current
    if (!group || !spot || !group.visible) return
    const distance = group.position.distanceTo(spot.position)
    if (distance < 0.0002) {
      group.position.copy(spot.position)
      return
    }
    group.position.lerp(spot.position, 1 - Math.exp(-delta * 28))
    invalidate()
  })

  return <group ref={root} />
}
