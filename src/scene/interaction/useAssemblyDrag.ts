import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { catalog } from '../../domain/catalog/catalog'
import { sizedForBay } from '../../domain/catalog/options'
import { isIntegratedTable } from '../../domain/catalog/families'
import { nearestFittingHeight, snapPinHeight } from '../../domain/placement/grid'
import { proposeItemDuplicate, proposeItemMove } from '../../domain/placement/proposals'
import {
  allowedFaces,
  hasIntegratedTable,
  isWallMounted,
  setPlacement,
} from '../../domain/plan/system'
import type { Plan, PlanItem } from '../../domain/plan/types'
import { fitPlacement } from '../../domain/supports/footprint'
import type { SupportRunMove } from '../../domain/supports/run'
import type { SupportTrackPlan } from '../../domain/supports/tracks'
import type { Face } from '../../domain/types'
import { editor } from '../../editor/editor'
import type { DragStatus, Selection } from '../../editor/store'
import { bayCentre, pinDepth } from '../models/assembly'
import { mm } from '../models/primitives'
import { runAxes } from '../view/axes'
import { dragPreviewBounds, faceUnderPointer, makeDragGhost, setVisible, showFit } from './drag'

type CaptureTarget = Element & {
  setPointerCapture: (id: number) => void
  releasePointerCapture: (id: number) => void
}

interface Measurements {
  width: number
  depth: number
  bottom: number
  tabletop: boolean
}

/** Width, depth and lowest point of a component, from its catalogue size where it has one. */
export function measureItem(item: PlanItem, bounds: THREE.Box3): Measurements {
  const variant = catalog.variant(item.productId, item.variantId)
  return {
    width: variant ? mm(variant.width) : bounds.max.x - bounds.min.x,
    depth:
      item.orientation === 'vertical'
        ? bounds.max.z - bounds.min.z
        : Math.max(mm(variant?.depth ?? 0), bounds.max.z),
    bottom: bounds.min.y,
    tabletop: isIntegratedTable(item.productId),
  }
}

/** Where a dragged or measured component is, in metres within the run. */
export interface ItemPreview extends Measurements {
  x: number
  z: number
  height: number
  face: Face
}

/** Where a dragged support run would sit along its wall, from the wall and above the floor. */
export interface SupportPreview {
  offset: number
  distance: number
  height: number
}

interface ItemDrag {
  id: string
  item: PlanItem
  /** The variant for the target bay, which can differ in width from the original. */
  variantId: string
  /** The face it would land on, which a face button under the pointer decides. */
  face: Face
  /** The face it moves on in the view; resting on the other face's button turns to it. */
  side: Face
  turnTimer: number | undefined
  /** The drag plane changed with the side, so the next move takes a new start point. */
  rebase: boolean
  plane: THREE.Plane
  startPoint: THREE.Vector3
  motionOrigin: THREE.Vector3
  /** Where the pointer holds the component, from its pin point within the run. */
  grab: THREE.Vector2
  ghost: THREE.Group
  /** Where the ghost glides to: the snapped position the component would land on. */
  landing: THREE.Vector3
  /** The components being moved, hidden while their ghost stands in for them. */
  originals: THREE.Object3D[]
  /** Horizontal scale of the ghost, for a bay of another width. */
  stretch: number
  target: CaptureTarget
  pointerId: number
  moved: boolean
  valid: boolean
  bayIndex: number
  height: number
  startScreen: THREE.Vector2
  duplicate: boolean
  measurements: Measurements
  published: DragStatus | null
}

interface SupportDrag {
  plane: THREE.Plane
  startPoint: THREE.Vector3
  originalPosition: THREE.Vector3
  move: SupportRunMove
  pointerId: number
  target: CaptureTarget
  moved: boolean
}

const up = new THREE.Vector3(0, 1, 0)

/** How long a dragged component rests on the other face's button before the view turns. */
const TURN_DELAY = 450

function sameStatus(a: DragStatus | null, b: DragStatus) {
  return (
    a?.itemId === b.itemId &&
    a.face === b.face &&
    a.valid === b.valid &&
    a.duplicate === b.duplicate
  )
}

function stopTurn(current: ItemDrag) {
  window.clearTimeout(current.turnTimer)
  current.turnTimer = undefined
}

function releaseCapture(target: CaptureTarget, pointerId: number) {
  try {
    target.releasePointerCapture(pointerId)
  } catch {
    // Capture may already be lost
  }
}

/**
 * Pointer handling for moving and copying components, and for moving the whole support run.
 * Components snap to bays and the track grid. Dropping on the other face's button moves a
 * component there; resting on it turns the view, and the drag goes on at that face.
 */
export function useAssemblyDrag({
  plan,
  tracks,
  assembly,
  placement,
}: {
  plan: Plan
  tracks: SupportTrackPlan[]
  assembly: THREE.Group
  placement: RefObject<THREE.Group | null>
}) {
  const invalidate = useThree((state) => state.invalidate)
  const itemDrag = useRef<ItemDrag | null>(null)
  const supportDrag = useRef<SupportDrag | null>(null)
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState<Selection>(null)
  const [itemPreview, setItemPreview] = useState<ItemPreview | null>(null)
  const [supportPreview, setSupportPreview] = useState<SupportPreview | null>(null)

  const faces = allowedFaces(plan)
  const { rotation } = runAxes(plan)

  useEffect(() => {
    document.body.style.cursor = dragging ? 'grabbing' : hover ? 'grab' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [dragging, hover])

  // Glides the ghost between snapped positions instead of jumping
  useFrame((_, delta) => {
    const current = itemDrag.current
    if (!current?.ghost.visible) return
    const { ghost, landing, stretch } = current
    if (ghost.position.distanceTo(landing) < 0.0002 && Math.abs(ghost.scale.x - stretch) < 0.001) {
      ghost.position.copy(landing)
      ghost.scale.x = stretch
      return
    }
    const ease = 1 - Math.exp(-delta * 28)
    ghost.position.lerp(landing, ease)
    ghost.scale.x += (stretch - ghost.scale.x) * ease
    invalidate()
  })

  function publish(current: ItemDrag) {
    const candidate = {
      ...current.item,
      variantId: current.variantId,
      bayIndex: current.bayIndex,
      height: current.height,
      face: current.face,
    }
    const proposal = current.duplicate
      ? proposeItemDuplicate(plan, catalog, candidate)
      : proposeItemMove(plan, catalog, candidate)
    current.valid = proposal?.valid ?? false
    if (proposal) current.height = proposal.candidate.height

    const x = bayCentre(plan, current.bayIndex)
    current.landing.set(x, mm(current.height), pinDepth(plan, tracks, current.face))
    // Turning to the other face is not a glide, so the ghost jumps there
    const angle = current.face === 'front' ? 0 : Math.PI
    if (current.ghost.rotation.y !== angle) current.ghost.position.copy(current.landing)
    current.ghost.rotation.set(0, angle, 0)
    current.ghost.visible = current.moved
    showFit(current.ghost, current.valid)
    // The ghost stretches to the width of the target bay until the drop builds the real one
    const width = catalog.variant(current.item.productId, current.variantId)?.width
    const original = catalog.variant(current.item.productId, current.item.variantId)?.width
    current.stretch = width && original ? width / original : 1
    setVisible(current.originals, !current.moved || current.duplicate)

    if (current.moved) {
      const preview = {
        ...current.measurements,
        width: current.measurements.width * current.stretch,
        x,
        z: current.landing.z,
        height: current.landing.y,
        face: current.face,
      }
      setItemPreview((previous) =>
        previous &&
        previous.x === preview.x &&
        previous.z === preview.z &&
        previous.height === preview.height &&
        previous.width === preview.width &&
        previous.face === preview.face
          ? previous
          : preview,
      )
    }

    const status = {
      itemId: current.id,
      face: current.face,
      valid: current.valid,
      duplicate: current.duplicate,
    }
    if (!sameStatus(current.published, status)) {
      current.published = status
      editor.trigger.dragChanged({ drag: status })
    }
    invalidate()
  }

  function finish(commit: boolean) {
    const current = itemDrag.current
    const support = supportDrag.current
    itemDrag.current = null
    supportDrag.current = null

    if (current) {
      stopTurn(current)
      // Ghost geometry and materials belong to the live assembly
      current.ghost.removeFromParent()
      setVisible(current.originals, true)
      releaseCapture(current.target, current.pointerId)
      if (commit && current.moved && current.valid) {
        editor.trigger.dropItem({
          id: current.id,
          variantId: current.variantId,
          bayIndex: current.bayIndex,
          height: current.height,
          face: current.face,
          duplicate: current.duplicate,
        })
      }
    }

    if (support) {
      placement.current?.position.copy(support.originalPosition)
      releaseCapture(support.target, support.pointerId)
      if (commit && support.moved) editor.trigger.moveSupports({ move: support.move })
    }

    setDragging(false)
    setItemPreview(null)
    setSupportPreview(null)
    editor.trigger.dragChanged({ drag: null })
    invalidate()
  }

  const cancel = useEffectEvent(() => finish(false))
  useEffect(() => {
    const subscription = editor.on('cancelDrag', cancel)
    return () => subscription.unsubscribe()
  }, [])

  function startSupportDrag(
    event: ThreeEvent<PointerEvent>,
    supportIndex: number,
    group: THREE.Group,
  ) {
    editor.trigger.selectSupport({ index: supportIndex })

    const normal = isWallMounted(plan.system.mountingType)
      ? new THREE.Vector3(0, 0, 1).applyAxisAngle(up, rotation)
      : up.clone()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, event.point)
    const startPoint = event.ray.intersectPlane(plane, new THREE.Vector3())
    if (!startPoint) return

    const target = event.target as CaptureTarget
    supportDrag.current = {
      plane,
      startPoint,
      originalPosition: group.position.clone(),
      pointerId: event.pointerId,
      target,
      moved: false,
      move: {
        offset: plan.system.placement.offset,
        distance: plan.system.placement.distance,
        mountHeight: plan.system.mountHeight,
      },
    }
    target.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function startItemDrag(event: ThreeEvent<PointerEvent>, id: string, group: THREE.Group) {
    editor.trigger.selectItem({ id })

    const item = plan.system.items.find((candidate) => candidate.id === id)
    const object = assembly.children.find((child) => child.userData.itemId === id)
    if (!item || !object) return

    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(up, rotation)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      object.getWorldPosition(new THREE.Vector3()),
    )
    const startPoint = event.ray.intersectPlane(plane, new THREE.Vector3())
    if (!startPoint) return
    const grabbed = group.worldToLocal(startPoint.clone())

    const proposal = proposeItemMove(plan, catalog, item)
    if (!proposal) return

    const ghost = makeDragGhost(assembly, proposal.movedItemIds, object)
    ghost.visible = false
    group.add(ghost)
    const originals = assembly.children.filter((child) =>
      proposal.movedItemIds.includes(child.userData.itemId as string),
    )

    const measurements = measureItem(item, dragPreviewBounds(ghost, id))

    const target = event.target as CaptureTarget
    itemDrag.current = {
      id,
      item,
      variantId: item.variantId,
      face: item.face,
      side: item.face,
      turnTimer: undefined,
      rebase: false,
      plane,
      startPoint,
      motionOrigin: object.position.clone(),
      grab: new THREE.Vector2(grabbed.x - object.position.x, grabbed.y - object.position.y),
      ghost,
      landing: ghost.position.clone(),
      originals,
      stretch: 1,
      target,
      pointerId: event.pointerId,
      moved: false,
      valid: proposal.valid,
      bayIndex: item.bayIndex,
      height: item.height,
      startScreen: new THREE.Vector2(event.clientX, event.clientY),
      duplicate: event.altKey,
      measurements,
      published: null,
    }
    target.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function onPointerDown(event: ThreeEvent<PointerEvent>) {
    const group = placement.current
    if (!group || event.button !== 0 || itemDrag.current || supportDrag.current) return
    if (editor.getSnapshot().context.placing) return
    // The closest visible surface owns the click, including the rear face
    event.stopPropagation()

    const supportIndex = event.object.userData.supportIndex as number | undefined
    const itemId = event.object.userData.itemId as string | undefined
    if (supportIndex !== undefined) startSupportDrag(event, supportIndex, group)
    else if (itemId) startItemDrag(event, itemId, group)
  }

  function moveSupportRun(
    event: ThreeEvent<PointerEvent>,
    support: SupportDrag,
    group: THREE.Group,
  ) {
    event.stopPropagation()
    const point = event.ray.intersectPlane(support.plane, new THREE.Vector3())
    if (!point) return

    const delta = point.sub(support.startPoint)
    if (delta.length() < 0.012 && !support.moved) return
    support.moved = true

    // In the run's axes: x along the wall, y up, z away from the wall
    const { mountingType, placement, mountHeight } = plan.system
    const local = delta.applyAxisAngle(up, -rotation)
    // Wall-bound runs slide along their wall; only wall-mounted runs without table legs rise
    const { offset, distance } = fitPlacement(
      setPlacement(plan, {
        offset: placement.offset + local.x * 1000,
        distance: placement.distance + local.z * 1000,
      }),
      catalog,
    ).system.placement
    const height =
      mountingType === 'wall' && !hasIntegratedTable(plan)
        ? Math.max(0, Math.round(mountHeight + local.y * 1000))
        : mountHeight

    support.move = { offset, distance, mountHeight: height }
    local.set(offset - placement.offset, height - mountHeight, distance - placement.distance)
    group.position
      .copy(support.originalPosition)
      .add(local.divideScalar(1000).applyAxisAngle(up, rotation))
    group.updateMatrixWorld(true)

    setSupportPreview((previous) =>
      previous?.offset === offset && previous.distance === distance && previous.height === height
        ? previous
        : { offset, distance, height },
    )
    invalidate()
  }

  /** Turns the view to the other face, where the drag goes on, after a short rest on its button. */
  function holdToTurn(current: ItemDrag, face: Face) {
    if (current.turnTimer !== undefined) return
    current.turnTimer = window.setTimeout(() => {
      current.turnTimer = undefined
      const group = placement.current
      if (itemDrag.current !== current || !group) return
      current.side = face
      current.rebase = true
      current.plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1).applyAxisAngle(up, rotation),
        group.localToWorld(new THREE.Vector3(0, 0, pinDepth(plan, tracks, face))),
      )
      editor.trigger.selectFace({ face })
    }, TURN_DELAY)
  }

  function moveItem(event: ThreeEvent<PointerEvent>, current: ItemDrag) {
    event.stopPropagation()
    const client = new THREE.Vector2(event.clientX, event.clientY)
    if (!current.moved && client.distanceTo(current.startScreen) < 8) return

    current.moved = true
    current.duplicate = event.altKey

    const buttonFace = faceUnderPointer(event.clientX, event.clientY)
    const onButton = buttonFace !== undefined && faces.includes(buttonFace)
    if (onButton && buttonFace !== current.side) holdToTurn(current, buttonFace)
    else stopTurn(current)

    if (onButton) {
      current.face = buttonFace
      current.bayIndex = current.item.bayIndex
      current.variantId = current.item.variantId
      current.height = current.item.height
    } else {
      current.face = current.side
      const point = event.ray.intersectPlane(current.plane, new THREE.Vector3())
      if (!point) return
      const group = placement.current
      if (current.rebase && group) {
        current.rebase = false
        current.startPoint.copy(point)
        // The component turned round with the view, so the spot held under the pointer mirrors
        const held = group.worldToLocal(point.clone())
        current.motionOrigin.set(held.x + current.grab.x, held.y - current.grab.y, 0)
      }
      const delta = point.sub(current.startPoint).applyAxisAngle(up, -rotation)

      let closest = Number.POSITIVE_INFINITY
      plan.system.bays.forEach((_, index) => {
        const distance = Math.abs(current.motionOrigin.x + delta.x - bayCentre(plan, index))
        if (distance < closest) {
          closest = distance
          current.bayIndex = index
        }
      })
      const height = THREE.MathUtils.clamp(
        (current.motionOrigin.y + delta.y) * 1000,
        50,
        plan.room.ceilingHeight - 50,
      )
      const candidate = sizedForBay(
        { ...current.item, bayIndex: current.bayIndex, face: current.face },
        plan.system.bays,
        catalog,
      )
      current.variantId = candidate.variantId
      const propose = current.duplicate ? proposeItemDuplicate : proposeItemMove
      current.height =
        nearestFittingHeight(
          height,
          plan,
          (fitting) => propose(plan, catalog, { ...candidate, height: fitting })?.valid ?? false,
        ) ?? snapPinHeight(height, plan)
    }
    publish(current)
  }

  function onPointerMove(event: ThreeEvent<PointerEvent>) {
    const group = placement.current
    if (!group) return

    const support = supportDrag.current
    const current = itemDrag.current
    if (support) moveSupportRun(event, support, group)
    else if (current && event.pointerId === current.pointerId) moveItem(event, current)
  }

  function onPointerUp(event: ThreeEvent<PointerEvent>) {
    if (!itemDrag.current && !supportDrag.current) return
    event.stopPropagation()

    // Resolve the release point too, so a fast drop on a face button still lands on that face
    const current = itemDrag.current
    if (current?.moved && event.type !== 'pointercancel') {
      current.duplicate = event.altKey
      const face = faceUnderPointer(event.clientX, event.clientY)
      if (face && faces.includes(face)) {
        current.face = face
        current.bayIndex = current.item.bayIndex
        current.variantId = current.item.variantId
        current.height = current.item.height
      }
      publish(current)
    }
    finish(event.type !== 'pointercancel')
  }

  function onPointerOver(event: ThreeEvent<PointerEvent>) {
    const itemId = event.object.userData.itemId as string | undefined
    const supportIndex = event.object.userData.supportIndex as number | undefined
    if (!itemId && supportIndex === undefined) return

    event.stopPropagation()
    setHover(itemId ? { type: 'item', id: itemId } : { type: 'support', index: supportIndex ?? 0 })
  }

  return {
    dragging,
    hover,
    itemPreview,
    supportPreview,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerOver,
      onPointerOut: () => setHover(null),
    },
  }
}
