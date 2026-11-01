import * as THREE from 'three'
import type { Catalog } from '../../domain/catalog/catalog'
import { hasFront, isIntegratedTable } from '../../domain/catalog/families'
import { carrierHeight } from '../../domain/placement/grid'
import { resolveItemFinish } from '../../domain/plan/finish'
import type { Plan } from '../../domain/plan/types'
import {
  deriveSupportTrackPlans,
  usesHPosts,
  type SupportTrackPlan,
} from '../../domain/supports/tracks'
import type { Face } from '../../domain/types'
import { carrierPinName, makeComponent } from './components'
import { makeShelfDecor } from './decor'
import { mountingDepths } from './mounting'
import { mm } from './primitives'
import { addSupports } from './supports'

export function systemWidth(plan: Plan) {
  return plan.system.bays.reduce((total, bay) => total + mm(bay.centreWidth), 0)
}

/** Support centres in metres, with the run centred on the origin. */
export function supportPositions(plan: Plan) {
  const positions = [-systemWidth(plan) / 2]
  for (const bay of plan.system.bays) positions.push((positions.at(-1) ?? 0) + mm(bay.centreWidth))
  return positions
}

export function bayCentre(plan: Plan, bayIndex: number) {
  const bay = plan.system.bays[bayIndex]
  return (supportPositions(plan)[bayIndex] ?? 0) + mm(bay?.centreWidth ?? 0) / 2
}

/** Depth of a face's pin line from the support centre plane, in metres. */
export function pinDepth(plan: Plan, tracks: SupportTrackPlan[], face: Face) {
  const depths = mountingDepths(usesHPosts(plan, tracks), plan.system.mountingType === 'wall')
  return mm(face === 'back' ? depths.backPin : depths.frontPin)
}

export function buildAssembly(plan: Plan, catalog: Catalog) {
  const root = new THREE.Group()
  root.name = '606 configured assembly'
  const { system } = plan
  const tracks = deriveSupportTrackPlans(plan, catalog)
  const positions = supportPositions(plan)
  addSupports(root, plan, tracks, positions)

  const groups = new Map<string, THREE.Group>()
  const items = new Map(system.items.map((item) => [item.id, item]))

  for (const item of system.items) {
    const product = catalog.product(item.productId)
    const variant = catalog.variant(item.productId, item.variantId)
    if (!product || !variant || !system.bays[item.bayIndex] || product.id === 'open-back') continue

    const component = new THREE.Group()
    component.name = `${product.name} · ${item.id}`
    component.userData.itemId = item.id
    component.position.set(
      bayCentre(plan, item.bayIndex),
      mm(item.height),
      pinDepth(plan, tracks, item.face),
    )
    if (item.face === 'back') component.rotation.y = Math.PI
    component.add(
      makeComponent(
        product,
        { ...item, ...resolveItemFinish(system.finish, item, catalog) },
        variant,
        carrierHeight(item, plan),
      ),
    )
    const decor = makeShelfDecor(item, variant, component)
    if (decor) component.add(decor)
    component.traverse((object) => {
      object.userData.itemId = item.id
    })
    groups.set(item.id, component)
    root.add(component)
  }

  for (const item of system.items) {
    if (!item.parentItemId) continue
    const host = items.get(item.parentItemId)
    const hostGroup = groups.get(item.parentItemId)
    if (!host || !hostGroup) continue
    if (item.productId === 'open-back') {
      hostGroup.traverse((object) => {
        if (object.name === 'Cabinet back') object.visible = false
      })
      continue
    }
    const group = groups.get(item.id)
    const hostVariant = catalog.variant(host.productId, host.variantId)
    const variant = catalog.variant(item.productId, item.variantId)
    if (!group || !hostVariant || !variant) continue
    group.position.copy(hostGroup.position)
    group.rotation.copy(hostGroup.rotation)
    let elevation = -0.089
    let depth = 0.025
    if (hasFront(host.productId)) {
      elevation = 0.01 - mm(hostVariant.height) + 0.03
      if (item.productId === 'cabinet-internal-shelf') elevation += mm(hostVariant.height) * 0.45
      const drawerCount =
        host.productId === 'three-drawer-cabinet'
          ? 3
          : host.productId === 'two-drawer-cabinet'
            ? 2
            : 1
      const drawer = hostGroup.getObjectByName(
        host.productId === 'shelf-with-drawer' ? 'Shallow drawer' : `Drawer ${drawerCount}`,
      )
      if (drawer && item.productId !== 'cabinet-internal-shelf') {
        elevation = drawer.position.y + 0.012
        depth = drawer.position.z - mm(hostVariant.innerDepth ?? 305) + 0.005
      }
    } else if (host.productId === 'desk-shelf' || host.productId === 'double-shelf')
      elevation = -0.084
    if (host.productId === 'drawer-divider') {
      elevation = mm(hostVariant.height)
      depth = 0
    }
    if (isIntegratedTable(host.productId)) elevation = 0.74 - mm(host.height)
    if (item.productId === 'bookend' && host.orientation !== 'vertical') {
      // Sample the actual deck after its orientation transform. Its bounding box
      // includes raised lips, so it cannot tell us where a standing accessory rests.
      hostGroup.updateWorldMatrix(true, true)
      const surfaces: THREE.Object3D[] = []
      hostGroup.traverse((object) => {
        if (object.userData.accessorySurface) surfaces.push(object)
      })
      const origin = hostGroup.localToWorld(new THREE.Vector3(0, 1, mm(hostVariant.depth) / 2))
      const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObjects(
        surfaces,
        false,
      )
      if (hits[0]) elevation = hostGroup.worldToLocal(hits[0].point.clone()).y
    }
    const siblings = system.items.filter(
      (candidate) =>
        candidate.parentItemId === item.parentItemId && candidate.productId === item.productId,
    )
    const siblingIndex = siblings.findIndex((candidate) => candidate.id === item.id)
    const x =
      item.productId === 'bookend'
        ? (variant.id.includes('right') ? 1 : -1) *
          (mm(hostVariant.width) / 2 - mm(variant.width) / 2 - 0.015)
        : siblings.length > 1
          ? (siblingIndex - (siblings.length - 1) / 2) * (mm(variant.width) + 0.008)
          : 0
    const offset = new THREE.Vector3(x, elevation, depth).applyEuler(group.rotation)
    group.position.add(offset)
  }
  root.updateMatrixWorld(true)
  const pins: THREE.Mesh[] = []
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.name === carrierPinName) pins.push(object)
  })
  const connections = new Set<string>()
  for (const pin of pins) {
    const position = pin.getWorldPosition(new THREE.Vector3())
    const key = position
      .toArray()
      .map((value) => Math.round(value * 100000))
      .join(':')
    if (connections.has(key)) {
      pin.removeFromParent()
      pin.geometry.dispose()
      continue
    }
    connections.add(key)
    const supportIndex = positions.findIndex((x) => Math.abs(x - position.x) < 0.0001)
    const support = root.children.find((child) => child.userData.supportIndex === supportIndex)
    if (support) {
      // The connection belongs to the support, including when a neighbouring
      // shelf is removed or moved. It is not two coincident per-shelf pins.
      support.attach(pin)
      pin.userData = { supportIndex }
    }
  }
  root.updateMatrixWorld(true)
  return root
}

/** Materials and textures are cached; only assembly-specific geometry is released. */
export function disposeAssembly(root: THREE.Group) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose()
  })
}
