import * as THREE from 'three'
import type { BuilderDocument, CatalogProduct, PlacedItem } from '../domain/types'
import { carrierPinName, makeComponent } from './components'
import { resolveItemFinish } from '../domain/products'
import { addSupports } from './supports'
import { mm } from './primitives'
import { carrierHeight } from '../domain/rules'
import { makeShelfDecor } from './decor'
import { mountingDepths } from './mounting'

export function systemWidth(document: BuilderDocument) {
  return document.system.bays.reduce((total, bay) => total + mm(bay.centreWidth), 0)
}

export function buildAssembly(document: BuilderDocument, catalog: CatalogProduct[]) {
  const root = new THREE.Group()
  root.name = '606 configured assembly'
  const { system } = document
  const positions = [-systemWidth(document) / 2]
  for (const bay of system.bays)
    positions.push(positions[positions.length - 1] + mm(bay.centreWidth))
  addSupports(root, document, positions, catalog)

  const groups = new Map<string, THREE.Group>()
  const items = new Map(system.items.map((item) => [item.id, item]))
  const variantFor = (item: PlacedItem) =>
    catalog
      .find((product) => product.id === item.productId)
      ?.variants.find((variant) => variant.id === item.variantId)

  for (const item of system.items) {
    const product = catalog.find((candidate) => candidate.id === item.productId)
    const variant = variantFor(item)
    if (!product || !variant || !system.bays[item.bayIndex] || product.id === 'open-back') continue
    const component = new THREE.Group()
    component.name = `${product.name} · ${item.id}`
    component.userData.itemId = item.id
    const hPost = system.mountingType === 'freestanding' || document.room.ceilingHeight > 3500
    const depths = mountingDepths(hPost, system.mountingType === 'wall')
    component.position.set(
      positions[item.bayIndex] + mm(system.bays[item.bayIndex].centreWidth) / 2,
      mm(item.height),
      mm(item.face === 'back' ? depths.backPin : depths.frontPin),
    )
    if (item.face === 'back') component.rotation.y = Math.PI
    component.add(
      makeComponent(
        product,
        { ...item, ...resolveItemFinish(document, item, catalog) },
        variant,
        carrierHeight(item, document),
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
    const hostVariant = variantFor(host)
    const variant = variantFor(item)
    if (!group || !hostVariant || !variant) continue
    group.position.copy(hostGroup.position)
    group.rotation.copy(hostGroup.rotation)
    let elevation = -0.089
    let depth = 0.025
    if (
      host.productId.includes('cabinet') ||
      host.productId === 'cabinet' ||
      host.productId === 'shelf-with-drawer'
    ) {
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
    if (host.productId === 'table') elevation = 0.74 - mm(host.height)
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
