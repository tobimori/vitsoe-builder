import * as THREE from 'three'
import type { BuilderDocument, CatalogProduct } from '../domain/types'
import { deriveSupportTrackPlans, trackHoleHeights } from '../domain/rules'
import { aluminium, polishedMetal, rubber, finishMaterial } from './materials'
import { box, cylinder, mm, plate, roundedBox } from './primitives'
import { mountingDepths, mountingProfile } from './mounting'

function screw(x: number, y: number, z: number, shaftLength = 0) {
  const group = new THREE.Group()
  group.position.set(x, y, z)
  const head = cylinder(0.0036, 0.0016, polishedMetal)
  head.rotation.x = Math.PI / 2
  group.add(head)
  if (shaftLength > 0) {
    const shaft = cylinder(0.0018, shaftLength, polishedMetal, 0, 0, -shaftLength / 2)
    shaft.rotation.x = Math.PI / 2
    shaft.name = 'E-track fixing screw shank'
    group.add(shaft)
  }
  group.add(box(0.004, 0.0007, 0.0003, rubber, 0, 0, 0.0009))
  group.add(box(0.0007, 0.004, 0.0003, rubber, 0, 0, 0.0009))
  return group
}

function trackSegment(height: number, holes: number[]) {
  const segment = new THREE.Group()
  segment.name = `${Math.round(height * 1000)} mm E-track segment`
  segment.add(box(0.02, height, 0.0015, aluminium, 0, height / 2, 0.00075))
  const side = new THREE.Shape()
  side.moveTo(0, 0)
  side.lineTo(0.02, 0)
  side.lineTo(0.02, height)
  side.lineTo(0, height)
  side.closePath()
  for (const y of holes) {
    const hole = new THREE.Path()
    hole.absarc(mm(mountingProfile.pinDepth), y, 0.0032, 0, Math.PI * 2, true)
    side.holes.push(hole)
  }
  // Circular holes go through the side fins; they are actual geometry.
  for (const x of [-0.00925, 0, 0.00925]) {
    const fin = plate(side, 0.0015, aluminium)
    fin.rotation.y = -Math.PI / 2
    fin.position.x = x
    fin.name = 'Perforated anodised E-profile fin'
    segment.add(fin)
  }
  for (const y of [Math.min(0.025, height / 3), height - Math.min(0.025, height / 3)])
    segment.add(screw(0.0045, y, 0.004, 0.008))
  return segment
}

function eTrack(
  parent: THREE.Group,
  x: number,
  bottom: number,
  lengths: number[],
  z: number,
  holes: number[],
  face = 1,
) {
  const group = new THREE.Group()
  group.position.set(x, bottom, z)
  group.rotation.y = face < 0 ? Math.PI : 0
  group.name = 'E-track assembly'
  let offset = 0
  for (const length of lengths) {
    const segmentHeight = mm(length)
    const segmentHoles = holes
      .map((hole) => mm(hole) - bottom - offset)
      .filter((hole) => hole > 0 && hole < segmentHeight)
    const segment = trackSegment(segmentHeight - 0.0007, segmentHoles)
    segment.position.y = offset
    group.add(segment)
    offset += segmentHeight
  }
  parent.add(group)
}

function postSection(hPost: boolean, hollow = true) {
  // Installation and Beyond p25: hollow extrusion, concave corners and
  // four T-slotted mounting faces. Internal dimensions are visual estimates.
  const shape = new THREE.Shape()
  const stretch = (y: number) => (hPost && Math.abs(y) >= 8 ? y + Math.sign(y) * 10 : y)
  const point = (x: number, y: number, quarter: number) => {
    const angle = (-quarter * Math.PI) / 2
    const px = x * Math.cos(angle) - y * Math.sin(angle)
    const py = x * Math.sin(angle) + y * Math.cos(angle)
    return new THREE.Vector2(mm(px), mm(stretch(py)))
  }
  const start = point(2, 22.5, 0)
  shape.moveTo(start.x, start.y)
  for (let quarter = 0; quarter < 4; quarter++) {
    const land = point(9, 22.5, quarter)
    shape.lineTo(land.x, land.y)
    const bend = point(10.5, 10.5, quarter)
    const corner = point(22.5, 9, quarter)
    shape.quadraticCurveTo(bend.x, bend.y, corner.x, corner.y)
    for (const [x, y] of [
      [22.5, 2],
      [20.5, 2],
      [20.5, 6],
      [15, 6],
      [15, 3],
      [8, 3],
      [8, -3],
      [15, -3],
      [15, -6],
      [20.5, -6],
      [20.5, -2],
      [22.5, -2],
    ]) {
      const next = point(x, y, quarter)
      shape.lineTo(next.x, next.y)
    }
  }
  shape.closePath()
  if (!hollow) return shape

  const hole = (points: number[][]) => {
    const path = new THREE.Path()
    points.forEach(([x, y], index) =>
      index ? path.lineTo(mm(x), mm(y)) : path.moveTo(mm(x), mm(y)),
    )
    path.closePath()
    shape.holes.push(path)
  }
  if (hPost) {
    hole([
      [-6, -5.5],
      [6, -5.5],
      [6, 5.5],
      [-6, 5.5],
    ])
    for (const sign of [-1, 1])
      hole(
        [
          [-11, 7],
          [11, 7],
          [11, 21],
          [4.5, 21],
          [4.5, 16],
          [-4.5, 16],
          [-4.5, 21],
          [-11, 21],
        ].map(([x, y]) => [x, y * sign]),
      )
  } else {
    hole([
      [-11, 11],
      [-4.5, 11],
      [-4.5, 6],
      [4.5, 6],
      [4.5, 11],
      [11, 11],
      [11, 4.5],
      [6, 4.5],
      [6, -4.5],
      [11, -4.5],
      [11, -11],
      [4.5, -11],
      [4.5, -6],
      [-4.5, -6],
      [-4.5, -11],
      [-11, -11],
      [-11, -4.5],
      [-6, -4.5],
      [-6, 4.5],
      [-11, 4.5],
    ])
  }
  return shape
}

function post(parent: THREE.Group, x: number, height: number, hPost: boolean, compressed: boolean) {
  const z = hPost ? -0.034 : -0.024
  const section = postSection(hPost)
  const bottom = 0.045
  const top = height - (compressed ? 0.014 : 0.002)
  const body = plate(section, top - bottom, aluminium)
  body.rotation.x = Math.PI / 2
  body.position.set(x, (top + bottom) / 2, z)
  body.name = hPost ? 'H-post extrusion' : 'Concave X-post extrusion'
  parent.add(body)
  if (!compressed) {
    const cap = plate(postSection(hPost, false), 0.002, rubber)
    cap.rotation.x = Math.PI / 2
    cap.position.set(x, height - 0.001, z)
    cap.name = 'Open post end cap'
    parent.add(cap)
  }
  for (const sign of [-1, 1])
    parent.add(
      box(
        0.0015,
        top - bottom,
        0.0015,
        rubber,
        x + sign * 0.015,
        (top + bottom) / 2,
        z + (hPost ? 0.031 : 0.021),
      ),
    )
}

function foot(parent: THREE.Group, x: number, z: number, single = false) {
  const armLength = single ? 0.34 : 0.365
  const padPosition = single ? 0.3375 : 0.3625
  for (const sign of single ? [1] : [-1, 1]) {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0.045)
    shape.lineTo(0, 0.145)
    shape.lineTo(0.02, 0.145)
    shape.lineTo(0.02, 0.067)
    shape.lineTo(armLength, 0.067)
    shape.lineTo(armLength, 0.029)
    shape.lineTo(0.04, 0.029)
    shape.closePath()
    const arm = plate(shape, 0.02, aluminium)
    arm.rotation.y = (-sign * Math.PI) / 2
    arm.position.set(x, 0, z)
    arm.name = 'Stabilising outrigger foot'
    parent.add(arm)
    parent.add(cylinder(0.0625, 0.006, aluminium, x, 0.003, z + sign * padPosition, 32))
    parent.add(cylinder(0.015, 0.004, aluminium, x, 0.008, z + sign * padPosition))
    parent.add(cylinder(0.0075, 0.024, polishedMetal, x, 0.018, z + sign * padPosition))
  }
}

function wallTie(parent: THREE.Group, x: number, y: number, depth: number, extension: boolean) {
  const extensionLength = extension ? 0.065 : 0
  const wallZ = -0.024 - depth - extensionLength
  const material = finishMaterial('silver')
  const base = cylinder(0.0625, 0.005, material, x, y, wallZ + 0.004, 48)
  base.rotation.x = Math.PI / 2
  parent.add(base)
  const boss = cylinder(0.024, 0.008, material, x, y, wallZ + 0.011)
  boss.rotation.x = Math.PI / 2
  parent.add(boss)
  const length = depth - 0.015
  const barrel = cylinder(0.0075, length, aluminium, x, y, wallZ + 0.015 + length / 2)
  barrel.rotation.x = Math.PI / 2
  barrel.name = depth > 0.08 ? 'Long wall bracket barrel' : 'Short wall bracket barrel'
  parent.add(barrel)
  if (extension) {
    const bolt = cylinder(
      0.0075,
      extensionLength,
      polishedMetal,
      x,
      y,
      -0.024 - extensionLength / 2,
    )
    bolt.rotation.x = Math.PI / 2
    bolt.name = '65 mm extension bolt'
    parent.add(bolt)
  }
  for (const sign of [-1, 1]) parent.add(screw(x + sign * 0.043, y, wallZ + 0.007))
}

export function addSupports(
  root: THREE.Group,
  document: BuilderDocument,
  positions: number[],
  catalog: CatalogProduct[],
) {
  const { system, room } = document
  const options = system.structureOptions
  const floorMounted = system.mountingType !== 'wall'
  const doubleSided =
    system.mountingType === 'freestanding' || system.mountingType === 'floor-to-ceiling'
  const plans = deriveSupportTrackPlans(document, catalog)
  const highestTrack = Math.max(...plans.map((plan) => mm(plan.top)))
  const postHeight =
    system.mountingType === 'floor-to-ceiling'
      ? mm(room.ceilingHeight)
      : system.mountingType === 'freestanding'
        ? Math.min(1.915, highestTrack)
        : highestTrack + 0.055
  const hPost = system.mountingType === 'freestanding' || postHeight > 3.5
  const postZ = hPost ? -0.034 : -0.024
  for (const [index, x] of positions.entries()) {
    const support = new THREE.Group()
    support.name = `Support ${index + 1}`
    if (floorMounted) {
      post(support, x, postHeight, hPost, system.mountingType === 'floor-to-ceiling')
      if (system.mountingType === 'freestanding' || options?.stabilisingFeet)
        foot(support, x, postZ, system.mountingType === 'semi-wall')
      support.add(cylinder(0.065, 0.006, aluminium, x, 0.003, postZ, 40))
      support.add(cylinder(0.022, 0.004, aluminium, x, 0.008, postZ))
      support.add(cylinder(0.0075, 0.038, polishedMetal, x, 0.027, postZ))
      if (system.mountingType === 'floor-to-ceiling') {
        const adjuster = cylinder(0.009, 0.008, polishedMetal, x, postHeight - 0.01, postZ)
        adjuster.name = 'Compression adjuster'
        const ceilingPlate = cylinder(0.026, 0.006, aluminium, x, postHeight - 0.003, postZ)
        ceilingPlate.name = 'Compression ceiling plate'
        support.add(adjuster, ceilingPlate)
      }
      if (system.mountingType === 'semi-wall') {
        const heights =
          postHeight >= 3 ? [0.3, postHeight / 2, postHeight - 0.06] : [0.3, postHeight - 0.06]
        heights.forEach((y) =>
          wallTie(
            support,
            x,
            y,
            options?.wallBracket === 'long' ? 0.11 : 0.07,
            options?.extensionBolts ?? false,
          ),
        )
      }
    }
    const depths = mountingDepths(hPost, !floorMounted)
    for (const plan of plans.filter((entry) => entry.supportIndex === index)) {
      const lengths = plan.segments.map((segment) => segment.installedLength)
      const holes = trackHoleHeights(plan, system.mountHeight)
      if (plan.face === 'front')
        eTrack(support, x, mm(plan.bottom), lengths, mm(depths.frontTrack), holes)
      else if (doubleSided)
        eTrack(support, x, mm(plan.bottom), lengths, mm(depths.backTrack), holes, -1)
    }
    support.traverse((object) => {
      object.userData.supportIndex = index
    })
    root.add(support)
  }
  if (floorMounted) {
    const heights =
      postHeight >= 3 ? [0.16, postHeight / 2, postHeight - 0.16] : [0.16, postHeight - 0.16]
    for (let index = 0; index < system.bays.length; index++) {
      const span = mm(system.bays[index].centreWidth)
      const x = positions[index] + span / 2
      if (options?.cableChannels) {
        const width = span < 0.8 ? 0.57 : 0.815
        const height = span < 0.8 ? 0.02 : 0.03
        const depth = span < 0.8 ? 0.015 : 0.03
        const channel = new THREE.Group()
        channel.name = 'Grey cable channel'
        const material = finishMaterial('silver', 'panel')
        channel.add(box(width, height, 0.002, material, 0, 0, -depth))
        for (const sign of [-1, 1])
          channel.add(box(width, 0.002, depth, material, 0, (sign * height) / 2, -depth / 2))
        channel.position.set(x, 0.16, postZ - 0.008)
        root.add(channel)
      }
      for (const [railIndex, y] of heights.entries()) {
        const tallMiddleRail =
          system.mountingType === 'floor-to-ceiling' && !hPost && postHeight > 3 && railIndex === 1
        const railHeight = tallMiddleRail ? 0.175 : 0.05
        const brace = roundedBox(span - 0.045, railHeight, 0.015, aluminium, 0.0008)
        brace.position.set(x, y, postZ)
        brace.name = `${Math.round(railHeight * 1000)} mm cross rail`
        root.add(brace)
        for (const sign of [-1, 1]) root.add(screw(x + sign * (span / 2 - 0.04), y, postZ + 0.0085))
      }
    }
  }
}
