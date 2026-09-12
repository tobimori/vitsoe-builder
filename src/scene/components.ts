import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { CatalogProduct, PlacedItem, ProductVariant } from '../domain/types'
import {
  aluminium,
  polishedMetal,
  rubber,
  recess,
  drawerInterior,
  finishMaterial,
  feltMaterial,
} from './materials'
import { box, cylinder, mesh, mm, plate, rodBetween, roundedBox, roundedShape } from './primitives'
import { BAY_USABLE_WIDTH } from '../domain/rules'

// The overall catalogue sizes are exact. Small manufacturing offsets are
// visual estimates from the manufacturer photographs in docs/references.
const steelThickness = 0.0016
const pinTop = 0.01
const shelfDeck = -0.09

export const carrierPinName = 'Shared aluminium carrier pin'

function pins(group: THREE.Group, width: number, y = 0) {
  const bayWidth = Object.entries(BAY_USABLE_WIDTH).find(([, usable]) => mm(usable) === width)?.[0]
  const span = bayWidth ? mm(Number(bayWidth)) : width + 0.012
  // Installation and Beyond, pp26–27: one aluminium pin crosses all three
  // E-track fins, ends flush, and supports both neighbouring components.
  // Turned reliefs follow the diagram; their small diameters are estimates.
  const profile = [
    [0, -10],
    [2.7, -10],
    [2.7, -8.5],
    [3, -8.25],
    [3, -1.1],
    [2.7, -0.85],
    [2.7, 0.85],
    [3, 1.1],
    [3, 8.25],
    [2.7, 8.5],
    [2.7, 10],
    [0, 10],
  ].map(([radius, axis]) => new THREE.Vector2(mm(radius), mm(axis)))
  for (const sign of [-1, 1]) {
    const pin = mesh(new THREE.LatheGeometry(profile, 32), aluminium)
    pin.position.set((sign * span) / 2, y, 0)
    pin.rotation.z = Math.PI / 2
    pin.name = carrierPinName
    pin.castShadow = true
    pin.receiveShadow = true
    group.add(pin)
  }
}

function sidePlate(depth: number, height: number, thickness: number, material: THREE.Material) {
  const bottom = pinTop - height
  const shape = new THREE.Shape()
  shape.moveTo(-0.009, bottom)
  shape.lineTo(depth - 0.005, bottom)
  shape.quadraticCurveTo(depth, bottom, depth, bottom + 0.005)
  shape.lineTo(depth, pinTop - 0.012)
  shape.quadraticCurveTo(depth, pinTop, depth - 0.012, pinTop)
  shape.lineTo(-0.009, pinTop)
  shape.closePath()
  const pinHole = new THREE.Path()
  pinHole.absarc(0, 0, 0.0032, 0, Math.PI * 2, true)
  shape.holes.push(pinHole)
  if (height >= 0.1) {
    const lowerHole = new THREE.Path()
    lowerHole.absarc(0, -0.07, 0.0032, 0, Math.PI * 2, true)
    shape.holes.push(lowerHole)
  }
  const object = plate(shape, thickness, material)
  object.rotation.y = -Math.PI / 2
  return object
}

function metalShelf(group: THREE.Group, w: number, d: number, material: THREE.Material) {
  // A continuous 1.6 mm formed section joins the rear return, deck and front
  // lip. Narrow end wings stop ahead of the E-fins to leave the corner reliefs.
  function section(withRearReturn: boolean) {
    const shape = new THREE.Shape()
    if (withRearReturn) {
      // Rounded, returned rear edge visible in both official mounting closeups.
      // The small fold radii and return length are visual manufacturing estimates.
      shape.moveTo(-0.0032, shelfDeck + 0.004)
      shape.lineTo(-0.0032, shelfDeck + 0.0076)
      shape.absarc(-0.0008, shelfDeck + 0.0076, 0.0024, Math.PI, 0, true)
      shape.lineTo(steelThickness, shelfDeck + 0.003)
      shape.quadraticCurveTo(steelThickness, shelfDeck, 0.0046, shelfDeck)
    } else shape.moveTo(0.01, shelfDeck)
    shape.lineTo(d - 0.003, shelfDeck)
    shape.quadraticCurveTo(d, shelfDeck, d, shelfDeck - 0.003)
    shape.lineTo(d, -0.1)
    shape.lineTo(d - steelThickness, -0.1)
    shape.lineTo(d - steelThickness, shelfDeck - 0.003)
    shape.quadraticCurveTo(
      d - steelThickness,
      shelfDeck - steelThickness,
      d - 0.003,
      shelfDeck - steelThickness,
    )
    shape.lineTo(withRearReturn ? 0.0046 : 0.01, shelfDeck - steelThickness)
    if (withRearReturn) {
      shape.quadraticCurveTo(0, shelfDeck - steelThickness, 0, shelfDeck + 0.003)
      shape.lineTo(0, shelfDeck + 0.0076)
      shape.absarc(-0.0008, shelfDeck + 0.0076, 0.0008, 0, Math.PI, false)
      shape.lineTo(-0.0016, shelfDeck + 0.004)
    }
    shape.closePath()
    return shape
  }

  const centre = plate(section(true), w - 0.012, material)
  centre.rotation.y = -Math.PI / 2
  centre.updateMatrix()
  centre.geometry.applyMatrix4(centre.matrix)
  const position = centre.geometry.getAttribute('position')
  const halfWidth = (w - 0.012) / 2
  for (let index = 0; index < position.count; index++) {
    const y = position.getY(index)
    const z = position.getZ(index)
    if (z > steelThickness + 0.00001 || y <= shelfDeck + 0.006) continue
    const rise = Math.min(0.004, y - shelfDeck - 0.006)
    const edge = halfWidth - 0.004 + Math.sqrt(0.004 ** 2 - rise ** 2)
    position.setX(index, THREE.MathUtils.clamp(position.getX(index), -edge, edge))
  }
  centre.geometry.computeVertexNormals()
  const sections = [centre.geometry]
  for (const sign of [-1, 1]) {
    const wing = plate(section(false), 0.006, material)
    wing.rotation.y = -Math.PI / 2
    wing.position.x = sign * (w / 2 - 0.003)
    wing.updateMatrix()
    wing.geometry.applyMatrix4(wing.matrix)
    sections.push(wing.geometry)
  }
  const geometry = mergeGeometries(sections)!
  sections.forEach((part) => part.dispose())
  const deck = mesh(geometry, material)
  deck.name = 'Folded steel deck'
  deck.userData.accessorySurface = true
  deck.castShadow = true
  deck.receiveShadow = true
  group.add(deck)

  for (const sign of [-1, 1]) {
    const side = sidePlate(d - 0.003, 0.1, steelThickness, material)
    side.position.x = sign * (w / 2 - steelThickness / 2)
    side.name = 'Upward folded steel side'
    group.add(side)
  }
  pins(group, w)
}

function horizontalPanel(
  w: number,
  d: number,
  thickness: number,
  material: THREE.Material,
  y: number,
  mounted = false,
) {
  let panel: THREE.Mesh
  if (mounted) {
    // Keep the full catalogue width in front of the track. Only the rear
    // corners clear its outer fins; no scaled-down furniture is substituted.
    const x = w / 2
    const z = d / 2
    const relief = 0.006
    const shape = new THREE.Shape()
    shape.moveTo(-x + relief, z)
    shape.lineTo(x - relief, z)
    shape.lineTo(x - relief, z - 0.01)
    shape.lineTo(x, z - 0.01)
    shape.lineTo(x, -z + 0.004)
    shape.quadraticCurveTo(x, -z, x - 0.004, -z)
    shape.lineTo(-x + 0.004, -z)
    shape.quadraticCurveTo(-x, -z, -x, -z + 0.004)
    shape.lineTo(-x, z - 0.01)
    shape.lineTo(-x + relief, z - 0.01)
    shape.closePath()
    // A small softened board edge catches light; its radius is a visual estimate.
    panel = plate(shape, thickness, material, thickness >= 0.014 ? 0.00035 : 0)
  } else panel = roundedBox(w, d, thickness, material, Math.min(0.004, thickness / 5))
  if (material instanceof THREE.MeshStandardMaterial && material.map) {
    const position = panel.geometry.getAttribute('position')
    const uv = panel.geometry.getAttribute('uv')
    for (let index = 0; index < position.count; index++) {
      // One metre along the veneer; the same projection continues over edges.
      uv.setXY(
        index,
        position.getX(index) + 0.5,
        (position.getY(index) + position.getZ(index)) * 2 + 0.5,
      )
    }
  }
  panel.rotation.x = -Math.PI / 2
  panel.position.set(0, y, d / 2)
  return panel
}

function woodShelf(
  group: THREE.Group,
  item: PlacedItem,
  variant: ProductVariant,
  double = false,
  desk = false,
) {
  const w = mm(variant.width)
  const d = mm(desk ? 360 : variant.depth)
  const material = finishMaterial(item.finish, 'panel')
  for (const sign of [-1, 1]) {
    const side = sidePlate(d, 0.11, 0.002, aluminium)
    side.position.x = sign * (w / 2 - 0.001)
    group.add(side)
  }
  const upper = horizontalPanel(
    w - 0.004,
    desk ? mm(variant.depth) : d,
    0.017,
    material,
    double || desk ? 0.0015 : -0.0915,
    true,
  )
  upper.userData.accessorySurface = true
  group.add(upper)
  if (double || desk) {
    const lower = horizontalPanel(w - 0.004, d, 0.014, material, -0.093, true)
    lower.name = desk ? 'Short desk surface' : 'Lower double shelf'
    lower.userData.accessorySurface = true
    group.add(lower)
  }
  pins(group, w)
}

function drawerFront(width: number, height: number, material: THREE.Material) {
  const x = width / 2
  const y = height / 2
  const handleHalf = Math.min(0.071, width * 0.105)
  const notch = Math.min(0.021, height * 0.24)
  const r = 0.006
  const shape = new THREE.Shape()
  shape.moveTo(-x, -y)
  shape.lineTo(x, -y)
  shape.lineTo(x, y)
  shape.lineTo(handleHalf, y)
  shape.lineTo(handleHalf, y - notch + r)
  shape.quadraticCurveTo(handleHalf, y - notch, handleHalf - r, y - notch)
  shape.lineTo(-handleHalf + r, y - notch)
  shape.quadraticCurveTo(-handleHalf, y - notch, -handleHalf, y - notch + r)
  shape.lineTo(-handleHalf, y)
  shape.lineTo(-x, y)
  shape.closePath()
  const front = plate(shape, 0.015, material)
  front.name = 'Lacquered front with recessed finger notch'
  return front
}

function drawerBox(width: number, height: number, depth: number) {
  const group = new THREE.Group()
  group.add(box(width - 0.012, 0.005, depth - 0.006, drawerInterior, 0, 0.0025, -depth / 2 + 0.003))
  for (const sign of [-1, 1])
    group.add(
      box(0.006, height, depth, drawerInterior, sign * (width / 2 - 0.003), height / 2, -depth / 2),
    )
  group.add(
    box(
      width - 0.012,
      height - 0.005,
      0.006,
      drawerInterior,
      0,
      (height + 0.005) / 2,
      -depth + 0.003,
    ),
  )
  return group
}

function cabinet(
  group: THREE.Group,
  product: CatalogProduct,
  item: PlacedItem,
  variant: ProductVariant,
) {
  const w = mm(variant.width)
  const h = mm(variant.height)
  const d = mm(variant.depth)
  const top = pinTop
  const bottom = top - h
  const body = finishMaterial(item.finish, 'panel')
  const frontMaterial = finishMaterial(item.frontFinish ?? item.finish, 'panel')
  const open = Boolean((item as PlacedItem & { open?: boolean }).open)
  const shallow = product.id === 'shelf-with-drawer'

  // The visible panel edges span the width; aluminium sides butt against
  // their undersides, as in the beech cabinet close-up (Vitsœ asset 3507).
  const topPanel = horizontalPanel(w, d, 0.016, body, top - 0.008, true)
  topPanel.name = 'Cabinet top panel'
  const bottomPanel = horizontalPanel(w, d, 0.016, body, bottom + 0.008, true)
  bottomPanel.name = 'Cabinet bottom panel'
  group.add(topPanel, bottomPanel)
  const back = box(w - 0.012, h - 0.032, 0.008, frontMaterial, 0, (top + bottom) / 2, 0.008)
  back.name = 'Cabinet back'
  group.add(back)

  for (const sign of [-1, 1]) {
    const side = roundedBox(0.002, h - 0.0324, d, aluminium, 0.0006)
    side.position.set(sign * (w / 2 - 0.001), (top + bottom) / 2, d / 2)
    side.name = 'Anodised aluminium cabinet side'
    group.add(side)
    // The small rear ear occupies the relieved panel corner and joins the
    // side edge. Its pin passes through a real hole, not through the wood top.
    const earShape = new THREE.Shape()
    earShape.moveTo(-0.009, top)
    earShape.lineTo(0.009, top)
    earShape.lineTo(0.009, top - 0.0162)
    earShape.lineTo(0, top - 0.0162)
    earShape.lineTo(0, top - 0.05)
    earShape.lineTo(-0.009, top - 0.05)
    earShape.closePath()
    const carrierHole = new THREE.Path()
    carrierHole.absarc(0, 0, 0.0032, 0, Math.PI * 2, true)
    earShape.holes.push(carrierHole)
    const ear = plate(earShape, 0.002, aluminium)
    ear.rotation.y = -Math.PI / 2
    ear.position.x = sign * (w / 2 - 0.001)
    ear.name = 'Cabinet carrier ear with pin hole'
    group.add(ear)
    for (const y of [top - 0.024, bottom + 0.024]) {
      const screw = cylinder(
        0.003,
        0.0012,
        polishedMetal,
        sign * (w / 2 + 0.0005),
        y,
        d - 0.027,
        12,
      )
      screw.rotation.z = Math.PI / 2
      group.add(screw)
    }
  }

  if (product.id.includes('flap') || product.id.includes('drop-front')) {
    const flapHeight = h - 0.038
    const front = drawerFront(w - 0.01, flapHeight, frontMaterial)
    if (open && product.id.includes('retractable')) {
      front.rotation.x = -Math.PI / 2
      front.position.set(0, top - 0.024, d / 2)
      front.name = 'Flap retracted below cabinet top'
    } else if (open) {
      front.rotation.x = Math.PI / 2
      front.position.set(0, bottom + 0.026, d + flapHeight / 2)
      for (const sign of [-1, 1])
        group.add(
          rodBetween(
            new THREE.Vector3(sign * (w / 2 - 0.025), top - 0.05, d - 0.02),
            new THREE.Vector3(sign * (w / 2 - 0.025), bottom + 0.03, d + flapHeight - 0.04),
            0.0012,
            polishedMetal,
          ),
        )
    } else front.position.set(0, (top + bottom) / 2, d - 0.008)
    group.add(front)
    if (!open) group.add(box(0.15, 0.025, 0.002, recess, 0, top - 0.025, d - 0.018))
  } else {
    const count =
      product.id === 'two-drawer-cabinet' ? 2 : product.id === 'three-drawer-cabinet' ? 3 : 1
    const available = h - 0.035
    const frontHeight = available / count - 0.003
    for (let i = 0; i < count; i++) {
      const rowBottom = bottom + 0.019 + (i * available) / count
      const drawer = new THREE.Group()
      drawer.position.set(0, rowBottom, d - 0.008 + (open && i === count - 1 ? 0.22 : 0))
      const front = drawerFront(w - 0.011, frontHeight, frontMaterial)
      front.position.y = frontHeight / 2
      drawer.add(front)
      const inside = drawerBox(
        mm(variant.innerWidth ?? variant.width - 90),
        Math.min(mm(variant.innerHeight ?? 70), frontHeight - 0.005),
        mm(variant.innerDepth ?? 305),
      )
      inside.position.set(0, 0.005, -0.01)
      drawer.add(inside)
      drawer.add(box(0.146, 0.022, 0.003, recess, 0, frontHeight - 0.01, -0.012))
      if (product.id === 'lockable-drawer-cabinet') {
        const lock = cylinder(0.005, 0.002, polishedMetal, 0.105, frontHeight - 0.03, 0.009)
        lock.rotation.x = Math.PI / 2
        drawer.add(lock)
        drawer.add(box(0.001, 0.004, 0.001, recess, 0.105, frontHeight - 0.03, 0.0105))
        for (const sign of [-1, 1])
          drawer.add(
            box(
              0.004,
              0.005,
              0.27,
              polishedMetal,
              sign * (w / 2 - 0.065),
              frontHeight - 0.035,
              -0.16,
            ),
          )
      }
      drawer.name = shallow ? 'Shallow drawer' : `Drawer ${i + 1}`
      group.add(drawer)
    }
  }
  pins(group, w)
}

function integratedTable(
  group: THREE.Group,
  item: PlacedItem,
  variant: ProductVariant,
  attachmentHeight = 695,
) {
  const w = mm(variant.width)
  const d = mm(variant.depth)
  const top = 0.74 - mm(item.height)
  const pinY = mm(attachmentHeight - item.height)
  const material = finishMaterial(item.finish, 'panel')
  group.add(horizontalPanel(w, d, 0.018, material, top - 0.009, true))
  for (const sign of [-1, 1]) {
    const carrierShape = new THREE.Shape()
    carrierShape.moveTo(-0.009, pinY - 0.01)
    carrierShape.lineTo(0.06, pinY - 0.01)
    carrierShape.lineTo(0.06, top - 0.018)
    carrierShape.lineTo(-0.009, top - 0.018)
    carrierShape.closePath()
    const hole = new THREE.Path()
    hole.absarc(0, pinY, 0.0032, 0, Math.PI * 2, true)
    carrierShape.holes.push(hole)
    const carrier = plate(carrierShape, 0.002, aluminium)
    carrier.rotation.y = -Math.PI / 2
    carrier.position.x = sign * (w / 2 - 0.001)
    carrier.name = 'Integrated table carrier with pin hole'
    group.add(carrier)
    group.add(
      box(
        0.004,
        0.045,
        Math.min(0.48, d * 0.6),
        aluminium,
        sign * (w / 2 - 0.015),
        top - 0.045,
        Math.min(0.48, d * 0.6) / 2,
      ),
    )
  }
  const legXs = d > 1.3 ? [-w / 2 + 0.065, w / 2 - 0.065] : [0]
  for (const x of legXs) {
    const leg = cylinder(0.015, 0.709, aluminium, x, top - 0.018 - 0.709 / 2, d - 0.09)
    leg.name = 'Integrated table leg'
    group.add(leg)
    group.add(cylinder(0.017, 0.013, rubber, x, -mm(item.height) + 0.0065, d - 0.09))
    group.add(cylinder(0.023, 0.004, aluminium, x, top - 0.02, d - 0.09))
  }
  pins(group, w, pinY)
}

function tray(group: THREE.Group, w: number, h: number, d: number, material: THREE.Material) {
  group.add(horizontalPanel(w, d, 0.001, material, 0.0005))
  for (const sign of [-1, 1])
    group.add(box(0.001, h, d, material, sign * (w / 2 - 0.0005), h / 2, d / 2))
  for (const z of [0.0005, d - 0.0005]) group.add(box(w, h, 0.001, material, 0, h / 2, z))
}

function accessory(
  group: THREE.Group,
  product: CatalogProduct,
  item: PlacedItem,
  variant: ProductVariant,
) {
  const w = mm(variant.width)
  const h = mm(variant.height)
  const d = mm(variant.depth)
  if (product.id === 'bookend') {
    const material = finishMaterial(item.finish)
    group.add(horizontalPanel(w, d, steelThickness, material, steelThickness / 2))
    const side = plate(roundedShape(d, h, 0.005), steelThickness, material)
    side.rotation.y = Math.PI / 2
    side.position.set((variant.id.includes('right') ? 1 : -1) * (w / 2 - 0.001), h / 2, d / 2)
    group.add(side)
  } else if (product.id === 'drawer-liner') {
    group.add(horizontalPanel(w, d, 0.002, feltMaterial(), 0.001))
  } else if (product.id === 'drawer-divider') {
    group.add(horizontalPanel(w, d, 0.002, drawerInterior, 0.001))
    for (const x of [-w / 2 + 0.003, -w / 6, w / 6, w / 2 - 0.003])
      group.add(box(0.003, h, d, drawerInterior, x, h / 2, d / 2))
    for (const z of [0.003, d / 2, d - 0.003])
      group.add(box(w, h, 0.003, drawerInterior, 0, h / 2, z))
  } else if (product.id === 'aluminium-tray' || product.id === 'pen-tray') {
    tray(group, w, h, d, aluminium)
  } else if (product.id === 'cabinet-internal-shelf') {
    tray(group, w, Math.max(0.008, h), d, drawerInterior)
  }
}

export function makeComponent(
  product: CatalogProduct,
  item: PlacedItem,
  variant: ProductVariant,
  attachmentHeight?: number,
) {
  const group = new THREE.Group()
  const w = mm(variant.width)
  const d = mm(variant.depth)
  const material = finishMaterial(item.finish)

  switch (product.id) {
    case 'shelf': {
      metalShelf(group, w, d, material)
      break
    }
    case 'shelf-with-clothes-rail': {
      // Vitsœ's wardrobe photograph shows downward side plates enclosing
      // the rail, rather than a rail suspended below a standard shelf.
      const shell = new THREE.Group()
      metalShelf(shell, w, d, material)
      // Reparenting a pin mutates shell.children, so iterate a stable snapshot.
      const shellChildren = shell.children.slice()
      for (const child of shellChildren) {
        if (child.name === carrierPinName) group.add(child)
        else if (child.name === 'Upward folded steel side') {
          shell.remove(child)
          if (child instanceof THREE.Mesh) child.geometry.dispose()
        }
      }
      shell.rotation.z = Math.PI
      shell.position.y = -0.09
      group.add(shell)
      for (const sign of [-1, 1]) {
        const side = sidePlate(d - 0.003, 0.11, steelThickness, material)
        side.position.x = sign * (w / 2 - steelThickness / 2)
        side.name = 'Downward clothes shelf side with carrier hole'
        group.add(side)
      }
      const rail = cylinder(0.009, w - 0.012, polishedMetal, 0, -0.074, d * 0.63)
      rail.rotation.z = Math.PI / 2
      rail.name = 'Clothes rail between inverted side plates'
      group.add(rail)
      for (const sign of [-1, 1])
        group.add(box(0.006, 0.018, 0.018, aluminium, sign * (w / 2 - 0.006), -0.074, d * 0.63))
      break
    }
    case 'sloping-shelf': {
      const bottom = pinTop - mm(variant.height)
      const rear = 0.01
      const lip = 0.016
      // One folded display surface and two joined triangular ends, using the
      // published external dimensions and the official component photographs.
      const section = new THREE.Shape()
      section.moveTo(rear, pinTop - steelThickness)
      section.lineTo(d, bottom)
      section.lineTo(d, bottom + lip)
      section.lineTo(d - steelThickness, bottom + lip)
      section.lineTo(d - steelThickness, bottom + steelThickness)
      section.lineTo(rear, pinTop)
      section.closePath()
      const panel = plate(section, w - 2 * steelThickness, material)
      panel.rotation.y = -Math.PI / 2
      panel.name = 'Continuous sloping deck and retaining lip'
      group.add(panel)
      for (const sign of [-1, 1]) {
        const shape = new THREE.Shape()
        shape.moveTo(-0.009, pinTop)
        shape.lineTo(rear, pinTop)
        shape.lineTo(d, bottom)
        shape.lineTo(-0.009, bottom)
        shape.closePath()
        const hole = new THREE.Path()
        hole.absarc(0, 0, 0.0032, 0, Math.PI * 2, true)
        shape.holes.push(hole)
        const side = plate(shape, steelThickness, material)
        side.rotation.y = -Math.PI / 2
        side.position.x = sign * (w / 2 - steelThickness / 2)
        side.name = 'Triangular sloping shelf end with carrier hole'
        group.add(side)
      }
      pins(group, w)
      break
    }
    case 'vertical-panel': {
      const panel = plate(roundedShape(w, mm(variant.height), 0.005), 0.001, material)
      panel.position.set(0, pinTop - mm(variant.height) / 2, 0.027)
      group.add(panel)
      for (const sign of [-1, 1])
        group.add(
          box(
            0.002,
            mm(variant.height),
            0.025,
            material,
            sign * (w / 2 - 0.002),
            pinTop - mm(variant.height) / 2,
            0.013,
          ),
        )
      pins(group, w)
      break
    }
    case 'wood-shelf':
      woodShelf(group, item, variant)
      break
    case 'double-shelf':
      woodShelf(group, item, variant, true)
      break
    case 'desk-shelf':
      woodShelf(group, item, variant, false, true)
      break
    case 'table':
      integratedTable(group, item, variant, attachmentHeight)
      break
    case 'shelf-with-drawer':
    case 'cabinet':
    case 'lockable-drawer-cabinet':
    case 'two-drawer-cabinet':
    case 'three-drawer-cabinet':
    case 'retractable-flap-cabinet':
    case 'drop-front-cabinet':
      cabinet(group, product, item, variant)
      break
    default:
      accessory(group, product, item, variant)
  }

  group.name = product.name
  if (item.orientation && item.orientation !== 'standard') {
    const carrier = new THREE.Group()
    // Reparenting a pin mutates group.children, so iterate a stable snapshot.
    const componentChildren = group.children.slice()
    for (const child of componentChildren) {
      if (child.name === carrierPinName) carrier.add(child)
    }
    if (item.orientation === 'inverted') {
      // Turning over around the depth axis keeps the rear holes and reliefs
      // at the support. An X turn would swap the front lip and rear edge.
      group.rotation.z = Math.PI
    } else {
      // The official rotating-shelf demonstration inverts first, then turns
      // the same body forward around its carrier axis. No added bracket.
      group.rotation.set(Math.PI / 2, 0, Math.PI)
    }
    carrier.add(group)
    carrier.name = product.name
    return carrier
  }
  return group
}
