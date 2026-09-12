import { describe, expect, it } from 'vite-plus/test'
import { Box3, Matrix4, Mesh, Raycaster, Vector3 } from 'three'
import { strFromU8, unzipSync } from 'three/addons/libs/fflate.module.js'
import type { BuilderDocument, CatalogProduct } from '../src/domain/types'
import { buildAssembly, disposeAssembly } from '../src/scene/geometry'
import { exportAssemblyUsdz } from '../src/scene/ar'
import { carrierPinName, makeComponent } from '../src/scene/components'
import { catalog as fullCatalog } from '../src/data/catalog'
import type { PlacedItem } from '../src/domain/types'
import { aluminium, finishMaterial } from '../src/scene/materials'
import { carrierHeight, deriveSupportTrackPlans } from '../src/domain/rules'
import { mountingDepths, mountingProfile } from '../src/scene/mounting'
import { orientationsFor, verticalEnvelope } from '../src/domain/products'

const catalog: CatalogProduct[] = [
  {
    id: 'shelf',
    name: 'Shelf',
    category: 'shelves',
    variants: [
      {
        id: 'wide',
        name: 'Wide',
        width: 900,
        height: 130,
        depth: 220,
        finishes: ['off-white'],
        faces: ['front', 'back'],
      },
    ],
  },
]
function configuration(): BuilderDocument {
  return {
    version: 1,
    name: 'Spatial test',
    room: { width: 4200, depth: 3600, ceilingHeight: 2600, showDimensions: true },
    system: {
      mountingType: 'floor-to-ceiling',
      bays: [
        { id: 'narrow', centreWidth: 667 },
        { id: 'wide', centreWidth: 912 },
      ],
      items: [
        {
          id: 'shelf-test',
          productId: 'shelf',
          variantId: 'wide',
          bayIndex: 1,
          height: 1255,
          face: 'front',
          finish: 'off-white',
        },
      ],
      placement: { x: 500, z: 250, rotation: 0 },
      railHeight: 2000,
      mountHeight: 345,
    },
  }
}

describe('configured assembly and AR export', () => {
  it('keeps table tops at 740 mm while their carriers follow the track hole grid', () => {
    for (const mountHeight of [205, 345, 333]) {
      const document = configuration()
      const product = fullCatalog.find((entry) => entry.id === 'table')!
      const item: PlacedItem = {
        id: 'table',
        productId: product.id,
        variantId: product.variants[0].id,
        bayIndex: 0,
        height: 740,
        face: 'front',
        finish: 'off-white',
      }
      document.system.mountHeight = mountHeight
      document.system.items = [item]
      const assembly = buildAssembly(document, fullCatalog)
      const table = assembly.children.find((child) => child.userData.itemId === item.id)!
      expect(new Box3().setFromObject(table).max.y).toBeCloseTo(0.74, 5)
      const carrier = assembly.getObjectByName(carrierPinName)!
      const height = carrier.getWorldPosition(new Vector3()).y
      expect(height).toBeCloseTo(carrierHeight(item, document) / 1000, 6)
      expect(height).toBeLessThan(0.705)
      const support = assembly.children.find((child) => child.userData.supportIndex === 0)!
      const fins: Mesh[] = []
      support.traverse((object) => {
        if (object.name === 'Perforated anodised E-profile fin') fins.push(object as Mesh)
      })
      const ray = new Raycaster(
        new Vector3(-1.579 / 2 - 0.03, height, 0.011),
        new Vector3(1, 0, 0),
        0,
        0.06,
      )
      expect(ray.intersectObjects(fins)).toHaveLength(0)
      disposeAssembly(assembly)
    }
  })

  it('renders a whole hole below the original track baseline when a low carrier needs edge clearance', () => {
    const document = configuration()
    const product = fullCatalog.find((entry) => entry.id === 'shelf')!
    document.system.items = [
      {
        id: 'low-shelf',
        productId: product.id,
        variantId: product.variants[0].id,
        bayIndex: 0,
        height: 345,
        face: 'front',
        finish: 'off-white',
      },
    ]
    const plan = deriveSupportTrackPlans(document, fullCatalog)[0]
    expect(plan.bottom).toBe(335)
    const assembly = buildAssembly(document, fullCatalog)
    const support = assembly.children.find((child) => child.userData.supportIndex === 0)!
    const fins: Mesh[] = []
    support.traverse((object) => {
      if (object.name === 'Perforated anodised E-profile fin') fins.push(object as Mesh)
    })
    const ray = new Raycaster(
      new Vector3(-1.579 / 2 - 0.03, 0.345, 0.011),
      new Vector3(1, 0, 0),
      0,
      0.06,
    )
    expect(ray.intersectObjects(fins)).toHaveLength(0)
    ray.ray.origin.y = 0.339
    expect(ray.intersectObjects(fins).length).toBeGreaterThan(0)
    disposeAssembly(assembly)
  })

  it('keeps every reversible shelf and horizontal panel clear of the E-track outer fins on both faces', () => {
    const cases = [
      ['shelf', 'standard'],
      ['shelf', 'inverted'],
      ['shelf', 'vertical'],
      ['shelf-with-clothes-rail', 'standard'],
      ['wood-shelf', 'standard'],
      ['wood-shelf', 'inverted'],
      ['double-shelf', 'standard'],
      ['double-shelf', 'inverted'],
      ['desk-shelf', 'standard'],
      ['desk-shelf', 'inverted'],
      ['cabinet', 'standard'],
      ['table', 'standard'],
    ] as const
    for (const [productId, orientation] of cases) {
      for (const mountingType of ['floor-to-ceiling', 'freestanding'] as const) {
        for (const face of ['front', 'back'] as const) {
          const document = configuration()
          document.system.mountingType = mountingType
          const depths = mountingDepths(mountingType === 'freestanding')
          const product = fullCatalog.find((entry) => entry.id === productId)!
          const variant = product.variants.find((entry) => entry.width === 655)!
          document.system.items = [
            {
              id: 'connection',
              productId,
              variantId: variant.id,
              bayIndex: 0,
              height: productId === 'table' ? 740 : 975,
              face,
              finish: 'off-white',
              orientation,
            },
          ]
          const assembly = buildAssembly(document, fullCatalog)
          const item = assembly.children.find((child) => child.userData.itemId === 'connection')!
          const support = -1.579 / 2
          // This vertical line lies inside the outer E-fin, behind its front edge.
          // A shelf intersected here would physically cut through that extrusion.
          const ray = new Raycaster(
            new Vector3(
              support + 0.00925,
              3,
              (face === 'front' ? depths.frontTrack + 15 : depths.backTrack - 15) / 1000,
            ),
            new Vector3(0, -1, 0),
          )
          expect(
            ray.intersectObject(item, true),
            `${productId}/${orientation}/${face} penetrates the track fin`,
          ).toHaveLength(0)
          const bounds = new Box3().setFromObject(item)
          if (face === 'front')
            expect(bounds.min.z).toBeGreaterThan(
              (depths.frontTrack + mountingProfile.trackWeb) / 1000,
            )
          else
            expect(bounds.max.z).toBeLessThan((depths.backTrack - mountingProfile.trackWeb) / 1000)
          disposeAssembly(assembly)
        }
      }
    }
  })

  it.each(['floor-to-ceiling', 'freestanding'] as const)(
    'seats both E-track webs on hollow post mounting lands (%s)',
    (mountingType) => {
      const document = configuration()
      document.system.mountingType = mountingType
      const assembly = buildAssembly(document, fullCatalog)
      const support = assembly.children.find((child) => child.userData.supportIndex === 0)!
      const body = support.children.find((child) => child.name.includes('post extrusion'))!
      const depths = mountingDepths(mountingType === 'freestanding')
      const x = -1.579 / 2
      for (const face of ['front', 'back'] as const) {
        const direction = face === 'front' ? -1 : 1
        const ray = new Raycaster(
          new Vector3(x + 0.006, 1, face === 'front' ? 0.1 : -0.2),
          new Vector3(0, 0, direction),
        )
        const land = ray.intersectObject(body)[0]
        expect(land).toBeDefined()
        expect(land.point.z).toBeCloseTo(
          (face === 'front' ? depths.frontTrack : depths.backTrack) / 1000,
          6,
        )
      }
      const bore = new Raycaster(new Vector3(x, 3, depths.postCentre / 1000), new Vector3(0, -1, 0))
      expect(bore.intersectObject(body)).toHaveLength(0)
      disposeAssembly(assembly)
    },
  )

  it.each([
    ['floor-to-ceiling', 'front'],
    ['floor-to-ceiling', 'back'],
    ['freestanding', 'front'],
    ['freestanding', 'back'],
  ] as const)(
    'shares one flush aluminium pin across adjacent shelves (%s/%s)',
    (mountingType, face) => {
      const document = configuration()
      document.system.mountingType = mountingType
      document.system.bays = [
        { id: 'a', centreWidth: 667 },
        { id: 'b', centreWidth: 667 },
      ]
      const product = fullCatalog.find((entry) => entry.id === 'shelf')!
      const variant = product.variants.find((entry) => entry.width === 655)!
      document.system.items = [0, 1].map((bayIndex) => ({
        id: `shelf-${bayIndex}`,
        productId: product.id,
        variantId: variant.id,
        bayIndex,
        height: 975,
        face,
        finish: 'off-white',
      }))
      const assembly = buildAssembly(document, fullCatalog)
      const carriers: Box3[] = []
      assembly.traverse((object) => {
        if (object.name !== carrierPinName) return
        expect((object as Mesh).material).toBe(aluminium)
        const bounds = new Box3().setFromObject(object)
        if (Math.abs(bounds.getCenter(new Vector3()).x) < 0.02) carriers.push(bounds)
      })
      carriers.sort((a, b) => a.min.x - b.min.x)
      expect(carriers).toHaveLength(1)
      expect(carriers[0].min.x).toBeCloseTo(-0.01, 6)
      expect(carriers[0].max.x).toBeCloseTo(0.01, 6)
      const support = assembly.children.find((child) => child.userData.supportIndex === 1)!
      const fins: Mesh[] = []
      support.traverse((object) => {
        if (object.name === 'Perforated anodised E-profile fin') fins.push(object as Mesh)
      })
      const depths = mountingDepths(mountingType === 'freestanding')
      const pinZ = (face === 'front' ? depths.frontPin : depths.backPin) / 1000
      const ray = new Raycaster(new Vector3(-0.03, 0.975, pinZ), new Vector3(1, 0, 0), 0, 0.06)
      expect(ray.intersectObjects(fins)).toHaveLength(0)
      // The same ray one centimetre below is blocked: this is a drilled opening,
      // not an absent fin or a cosmetic dark mark.
      ray.ray.origin.y -= 0.01
      expect(ray.intersectObjects(fins).length).toBeGreaterThan(0)
      disposeAssembly(assembly)
    },
  )

  it('butts cabinet sides between top and bottom panels without overlapping exterior faces', () => {
    const product = fullCatalog.find((entry) => entry.id === 'cabinet')!
    const variant = product.variants[0]
    const component = makeComponent(
      product,
      {
        id: 'cabinet',
        productId: product.id,
        variantId: variant.id,
        bayIndex: 0,
        height: 975,
        face: 'front',
        finish: 'beech',
        frontFinish: 'silver',
      },
      variant,
    )
    const sides = component.children.filter(
      (child) => child.name === 'Anodised aluminium cabinet side',
    )
    const top = new Box3().setFromObject(component.getObjectByName('Cabinet top panel')!)
    const bottom = new Box3().setFromObject(component.getObjectByName('Cabinet bottom panel')!)
    for (const side of sides) {
      const bounds = new Box3().setFromObject(side)
      expect(bounds.max.y).toBeLessThanOrEqual(top.min.y + 1e-7)
      expect(bounds.min.y).toBeGreaterThanOrEqual(bottom.max.y - 1e-7)
      expect(top.max.y - bounds.max.y).toBeCloseTo(0.0162, 5)
    }
    expect((component.getObjectByName('Cabinet back') as Mesh).material).toBe(
      finishMaterial('silver', 'panel'),
    )
    disposeAssembly(component)
  })

  it('terminates compressed posts below the adjuster and ceiling plate without an overlapping cap', () => {
    const assembly = buildAssembly(configuration(), catalog)
    const support = assembly.children.find((child) => child.userData.supportIndex === 0)!
    expect(support.getObjectByName('Open post end cap')).toBeUndefined()
    const body = new Box3().setFromObject(support.getObjectByName('Concave X-post extrusion')!)
    const adjuster = new Box3().setFromObject(support.getObjectByName('Compression adjuster')!)
    const plate = new Box3().setFromObject(support.getObjectByName('Compression ceiling plate')!)
    expect(body.max.y).toBeLessThanOrEqual(adjuster.min.y + 1e-7)
    expect(adjuster.max.y).toBeLessThanOrEqual(plate.min.y + 1e-7)
    expect(plate.max.y).toBeCloseTo(2.6, 6)
    disposeAssembly(assembly)
  })

  it('builds selectable front and rear tracks and resolves inherited finishes on freestanding items', () => {
    const document = configuration()
    const shelf = fullCatalog.find((entry) => entry.id === 'shelf')!
    document.system.mountingType = 'freestanding'
    document.system.finish = { colour: 'black', wood: 'beech' }
    document.system.items = ['front', 'back'].map((face) => ({
      id: face,
      productId: shelf.id,
      variantId: shelf.variants[0].id,
      bayIndex: 0,
      height: 980,
      face: face as 'front' | 'back',
      finish: 'off-white',
      finishOverride: 'system',
    }))
    const assembly = buildAssembly(document, fullCatalog)
    const support = assembly.children.find((child) => child.userData.supportIndex === 0)!
    expect(support.children.filter((child) => child.name === 'E-track assembly')).toHaveLength(2)
    support.traverse((object) => expect(object.userData.supportIndex).toBe(0))
    for (const face of ['front', 'back']) {
      const item = assembly.children.find((child) => child.userData.itemId === face)!
      const bounds = new Box3().setFromObject(item)
      if (face === 'front') expect(bounds.max.z).toBeGreaterThan(0.1)
      else expect(bounds.max.z).toBeLessThan(-0.06)
      const deck = item.getObjectByName('Folded steel deck') as Mesh
      expect(deck.material).toBe(finishMaterial('black'))
    }
    disposeAssembly(assembly)
  })

  it('keeps the clothes rail inside the photographed inverted shelf, within the nominal 110 mm envelope', () => {
    const product = fullCatalog.find((entry) => entry.id === 'shelf-with-clothes-rail')!
    const variant = product.variants[0]
    const item: PlacedItem = {
      id: 'rail',
      productId: product.id,
      variantId: variant.id,
      bayIndex: 0,
      height: 1735,
      face: 'front',
      finish: 'off-white',
    }
    const component = makeComponent(product, item, variant)
    const bounds = new Box3().setFromObject(component)
    expect(variant.height).toBe(110)
    expect(bounds.min.y).toBeCloseTo(-0.1, 5)
    expect(bounds.max.y).toBeCloseTo(0.01, 5)
    disposeAssembly(component)
  })

  it('uses two 50 mm rails and one 175 mm rail per bay for tall compressed X-posts', () => {
    const document = configuration()
    document.room.ceilingHeight = 3200
    const assembly = buildAssembly(document, catalog)
    expect(assembly.children.filter((child) => child.name === '175 mm cross rail')).toHaveLength(2)
    expect(assembly.children.filter((child) => child.name === '50 mm cross rail')).toHaveLength(4)
    disposeAssembly(assembly)
  })

  it('keeps the sourced 110 mm metal shelf envelope when reversed, and keeps its depth in front of the track', () => {
    const product = fullCatalog.find((entry) => entry.id === 'shelf')!
    for (const orientation of ['standard', 'inverted'] as const) {
      const item: PlacedItem = {
        id: 's',
        productId: product.id,
        variantId: product.variants[0].id,
        bayIndex: 0,
        height: 975,
        face: 'front',
        finish: 'off-white',
        orientation,
      }
      const component = makeComponent(product, item, product.variants[0])
      const bounds = new Box3().setFromObject(component)
      expect(bounds.getSize(new Vector3()).y).toBeCloseTo(0.11, 5)
      expect(bounds.min.z).toBeGreaterThanOrEqual(-0.011)
      disposeAssembly(component)
    }
  })

  it('retains a rounded rear return in every steel shelf orientation and the clothes-rail shell', () => {
    const cases = [
      ['shelf', 'standard'],
      ['shelf', 'inverted'],
      ['shelf', 'vertical'],
      ['shelf-with-clothes-rail', 'standard'],
    ] as const
    for (const [productId, orientation] of cases) {
      const product = fullCatalog.find((entry) => entry.id === productId)!
      const item: PlacedItem = {
        id: 'rear-return',
        productId,
        variantId: product.variants[0].id,
        bayIndex: 0,
        height: 975,
        face: 'front',
        finish: 'off-white',
        orientation,
      }
      const component = makeComponent(product, item, product.variants[0])
      component.updateMatrixWorld(true)
      const deck = component.getObjectByName('Folded steel deck')!
      const origin = deck.localToWorld(new Vector3(0, -0.0845, -0.03))
      const direction = new Vector3(0, 0, 1).transformDirection(deck.matrixWorld)
      const hits = new Raycaster(origin, direction, 0, 0.05).intersectObject(deck)
      const depths = hits.map((hit) => deck.worldToLocal(hit.point.clone()).z)
      // Separate rear return and front upstand enclose the small open fold.
      expect(depths.some((depth) => Math.abs(depth + 0.0032) < 0.00001)).toBe(true)
      expect(depths.some((depth) => Math.abs(depth) < 0.00001)).toBe(true)
      disposeAssembly(component)
    }
  })

  it('offers a wood shelf upside down with the same body and a matching carrier-relative envelope', () => {
    const product = fullCatalog.find((entry) => entry.id === 'wood-shelf')!
    expect(orientationsFor(product.id)).toEqual(['standard', 'inverted'])
    for (const orientation of orientationsFor(product.id)) {
      const item: PlacedItem = {
        id: 'wood',
        productId: product.id,
        variantId: product.variants[0].id,
        bayIndex: 0,
        height: 975,
        face: 'front',
        finish: 'beech',
        orientation,
      }
      const component = makeComponent(product, item, product.variants[0])
      component.position.y = item.height / 1000
      const bounds = new Box3().setFromObject(component)
      const envelope = verticalEnvelope(item, product.variants[0])
      expect(bounds.min.y).toBeCloseTo(envelope.start / 1000, 5)
      expect(bounds.max.y).toBeCloseTo((envelope.start + envelope.size) / 1000, 5)
      const carrier = component.getObjectByName(carrierPinName)!
      expect(carrier.getWorldPosition(new Vector3()).y).toBeCloseTo(item.height / 1000, 6)
      expect(bounds.max.z).toBeCloseTo(0.36, 5)
      expect(bounds.min.z).toBeCloseTo(-0.009, 5)
      disposeAssembly(component)
    }
  })

  it('joins the sloping deck to its triangular ends within each published variant envelope', () => {
    const product = fullCatalog.find((entry) => entry.id === 'sloping-shelf')!
    for (const variant of product.variants) {
      const item: PlacedItem = {
        id: 'slope',
        productId: product.id,
        variantId: variant.id,
        bayIndex: 0,
        height: 975,
        face: 'front',
        finish: 'off-white',
      }
      const component = makeComponent(product, item, variant)
      const deck = component.getObjectByName('Continuous sloping deck and retaining lip')!
      const ends = component.children.filter(
        (child) => child.name === 'Triangular sloping shelf end with carrier hole',
      )
      const deckBounds = new Box3().setFromObject(deck)
      for (const end of ends) {
        const bounds = new Box3().setFromObject(end)
        expect(bounds.max.z).toBeCloseTo(deckBounds.max.z, 6)
        expect(bounds.min.y).toBeCloseTo(deckBounds.min.y, 6)
        expect(bounds.max.y).toBeCloseTo(deckBounds.max.y, 6)
        const joinedX = end.position.x < 0 ? bounds.max.x : bounds.min.x
        expect(joinedX).toBeCloseTo(end.position.x < 0 ? deckBounds.min.x : deckBounds.max.x, 6)
      }
      const body = new Box3().setFromObject(component)
      expect(body.max.z).toBeCloseTo(variant.depth / 1000, 5)
      expect(body.getSize(new Vector3()).y).toBeCloseTo(variant.height / 1000, 5)
      const pinRay = new Raycaster(new Vector3(-1, 0, 0), new Vector3(1, 0, 0))
      expect(pinRay.intersectObjects(ends, true)).toHaveLength(0)
      disposeAssembly(component)
    }
  })

  it('keeps both fixed desk surfaces at their sourced depths in either orientation', () => {
    const product = fullCatalog.find((entry) => entry.id === 'desk-shelf')!
    expect(orientationsFor(product.id)).toEqual(['standard', 'inverted'])
    for (const orientation of orientationsFor(product.id)) {
      const item: PlacedItem = {
        id: 'desk',
        productId: product.id,
        variantId: product.variants[0].id,
        bayIndex: 0,
        height: 975,
        face: 'front',
        finish: 'off-white',
        orientation,
      }
      const component = makeComponent(product, item, product.variants[0])
      component.position.y = item.height / 1000
      component.updateMatrixWorld(true)
      const surfaces: Mesh[] = []
      component.traverse((object) => {
        if (object instanceof Mesh && object.userData.accessorySurface) surfaces.push(object)
      })
      expect(surfaces).toHaveLength(2)
      const depths = surfaces
        .map((surface) => new Box3().setFromObject(surface).getSize(new Vector3()).z)
        .sort()
      expect(depths[0]).toBeCloseTo(0.36, 5)
      expect(depths[1]).toBeCloseTo(0.55, 5)
      const bounds = new Box3().setFromObject(component)
      const envelope = verticalEnvelope(item, product.variants[0])
      expect(bounds.min.y).toBeCloseTo(envelope.start / 1000, 5)
      expect(bounds.max.y).toBeCloseTo((envelope.start + envelope.size) / 1000, 5)
      disposeAssembly(component)
    }
  })

  it('stands bookends on the actual upward deck on both faces, including inverted shelves', () => {
    for (const productId of ['shelf', 'wood-shelf', 'double-shelf', 'desk-shelf']) {
      for (const orientation of ['standard', 'inverted'] as const) {
        for (const face of ['front', 'back'] as const) {
          const document = configuration()
          const product = fullCatalog.find((entry) => entry.id === productId)!
          const host: PlacedItem = {
            id: 'host',
            productId,
            variantId: product.variants[0].id,
            bayIndex: 0,
            height: 975,
            face,
            finish: 'off-white',
            orientation,
          }
          const accessory = fullCatalog.find((entry) => entry.id === 'bookend')!
          document.system.items = [
            host,
            {
              id: 'bookend',
              productId: accessory.id,
              variantId: accessory.variants[0].id,
              bayIndex: 0,
              height: 975,
              face,
              finish: 'off-white',
              parentItemId: host.id,
            },
          ]
          const assembly = buildAssembly(document, fullCatalog)
          const hostObject = assembly.children.find((child) => child.userData.itemId === host.id)!
          const bookend = assembly.children.find((child) => child.userData.itemId === 'bookend')!
          const bounds = new Box3().setFromObject(bookend)
          const centre = bounds.getCenter(new Vector3())
          const ray = new Raycaster(new Vector3(centre.x, 2, centre.z), new Vector3(0, -1, 0))
          const deck = ray.intersectObject(hostObject, true)[0]!
          expect(deck, `${productId}/${orientation}/${face} has a supporting surface`).toBeDefined()
          expect(bounds.min.y).toBeCloseTo(deck.point.y, 5)
          expect(bookend.localToWorld(new Vector3(0, 1, 0)).y - bookend.position.y).toBeCloseTo(
            1,
            6,
          )
          disposeAssembly(assembly)
        }
      }
    }
  })

  it('models integrated tables at 740 mm with the catalogue one-leg/two-leg distinction', () => {
    const product = fullCatalog.find((entry) => entry.id === 'table')!
    for (const depth of [800, 1200, 1600]) {
      const variant = product.variants.find((entry) => entry.depth === depth)!
      const item: PlacedItem = {
        id: 'table',
        productId: product.id,
        variantId: variant.id,
        bayIndex: 0,
        height: 635,
        face: 'front',
        finish: 'off-white',
      }
      const component = makeComponent(product, item, variant)
      component.position.y = 0.635
      const bounds = new Box3().setFromObject(component)
      expect(bounds.min.y).toBeCloseTo(0, 5)
      expect(bounds.max.y).toBeCloseTo(0.74, 5)
      expect(
        component.children.filter((child) => child.name === 'Integrated table leg'),
      ).toHaveLength(depth === 1600 ? 2 : 1)
      disposeAssembly(component)
    }
  })

  it('ignores legacy desk opening state while preserving actual cabinet drawer counts', () => {
    const desk = fullCatalog.find((entry) => entry.id === 'desk-shelf')!
    const variant = desk.variants[0]
    for (const open of [false, true]) {
      const item: PlacedItem = {
        id: 'desk',
        productId: desk.id,
        variantId: variant.id,
        bayIndex: 0,
        height: 835,
        face: 'front',
        finish: 'off-white',
        open,
      }
      const component = makeComponent(desk, item, variant)
      expect(new Box3().setFromObject(component).max.z).toBeCloseTo(0.55, 5)
      disposeAssembly(component)
    }
    for (const [id, count] of [
      ['cabinet', 1],
      ['two-drawer-cabinet', 2],
      ['three-drawer-cabinet', 3],
    ] as const) {
      const product = fullCatalog.find((entry) => entry.id === id)!
      const item: PlacedItem = {
        id,
        productId: id,
        variantId: product.variants[0].id,
        bayIndex: 0,
        height: 975,
        face: 'front',
        finish: 'off-white',
      }
      const component = makeComponent(product, item, product.variants[0])
      expect(component.children.filter((child) => /^Drawer \d$/.test(child.name))).toHaveLength(
        count,
      )
      expect(new Box3().setFromObject(component).getSize(new Vector3()).y).toBeCloseTo(0.395, 5)
      disposeAssembly(component)
    }
  })

  it('preserves mixed bay track-centre dimensions and floor-to-ceiling physical size', () => {
    const assembly = buildAssembly(configuration(), catalog)
    const item = assembly.children.find((child) => child.userData.itemId === 'shelf-test')!
    expect(item.position.x).toBeCloseTo(0.3335, 6)
    const bounds = new Box3().setFromObject(assembly)
    const dimensions = bounds.getSize(new Vector3())
    expect(bounds.min.y).toBeCloseTo(0, 6)
    expect(dimensions.y).toBeCloseTo(2.6, 6)
    expect(dimensions.x).toBeCloseTo(1.579 + 0.13, 6)
    disposeAssembly(assembly)
  })

  it.each(['wall', 'semi-wall', 'floor-to-ceiling', 'freestanding'] as const)(
    'exports an upright metre-scale scene with the correct anchor basis (%s)',
    async (mountingType) => {
      const document = configuration()
      document.system.mountingType = mountingType
      const assembly = buildAssembly(document, catalog)
      assembly.position.set(3, 2, 4)
      assembly.rotation.set(0.1, 0.3, 0.2)
      assembly.updateMatrixWorld(true)
      const originalMatrix = assembly.matrix.clone()
      const originalWorld = assembly.matrixWorld.clone()
      const blob = await exportAssemblyUsdz(assembly, mountingType)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const files = unzipSync(bytes)
      const model = strFromU8(files['model.usda'])
      const wall = mountingType === 'wall'
      expect(blob.type).toBe('model/vnd.usdz+zip')
      expect(model).toContain('metersPerUnit = 1')
      expect(model).toContain('upAxis = "Y"')
      expect(model).toContain(
        'def Xform "Root" (\n    prepend apiSchemas = ["Preliminary_AnchoringAPI"]',
      )
      expect(model).toContain(`alignment = "${wall ? 'vertical' : 'horizontal'}"`)
      expect(model.match(/preliminary:anchoring:type/g)).toHaveLength(1)

      // Read the emitted child matrix rather than inspecting the JS snapshot.
      // USD rows serialize Three's column-major elements in this exporter.
      const furniture = model.slice(model.indexOf('def Xform "Furniture"'))
      const matrixLine = furniture
        .split('\n')
        .find((line) => line.includes('matrix4d xformOp:transform'))!
      const values = matrixLine
        .split('=')[1]
        .match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)!
        .map(Number)
      expect(values).toHaveLength(16)
      const furnitureBasis = new Matrix4().fromArray(values)
      const expectedUp = wall ? new Vector3(0, 0, -1) : new Vector3(0, 1, 0)
      const expectedDepth = wall ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)
      expect(
        new Vector3(0, 1, 0).transformDirection(furnitureBasis).distanceTo(expectedUp),
      ).toBeLessThan(1e-6)
      expect(
        new Vector3(0, 0, 1).transformDirection(furnitureBasis).distanceTo(expectedDepth),
      ).toBeLessThan(1e-6)
      expect(furnitureBasis.determinant()).toBeCloseTo(1, 7)
      expect(new Vector3().setFromMatrixPosition(furnitureBasis).length()).toBe(0)

      const angle = (Number(model.match(/double xformOp:rotateX = ([-\d.]+)/)![1]) * Math.PI) / 180
      const objectPreview = new Matrix4().makeRotationX(angle).multiply(furnitureBasis)
      expect(
        new Vector3(0, 1, 0).applyMatrix4(objectPreview).distanceTo(new Vector3(0, 1, 0)),
      ).toBeLessThan(1e-6)
      expect(
        new Vector3(0, 0, 1).applyMatrix4(objectPreview).distanceTo(new Vector3(0, 0, 1)),
      ).toBeLessThan(1e-6)

      // A detected wall's local Y is its outward normal; local -Z points up.
      // Check a differently facing wall as well, so this cannot pass by merely
      // changing the alignment token or rotating the complete scene sideways.
      const yaw = new Matrix4().makeRotationY(0.8)
      const anchorPose = wall
        ? yaw.clone().multiply(new Matrix4().makeRotationX(Math.PI / 2))
        : yaw.clone()
      const placed = anchorPose.multiply(furnitureBasis)
      expect(
        new Vector3(0, 1, 0).transformDirection(placed).distanceTo(new Vector3(0, 1, 0)),
      ).toBeLessThan(1e-6)
      expect(
        new Vector3(0, 0, 1)
          .transformDirection(placed)
          .distanceTo(new Vector3(0, 0, 1).transformDirection(yaw)),
      ).toBeLessThan(1e-6)
      expect(assembly.matrix.elements).toEqual(originalMatrix.elements)
      expect(assembly.matrixWorld.elements).toEqual(originalWorld.elements)

      const zip = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      let offset = 0
      let entries = 0
      while (zip.getUint32(offset, true) === 0x04034b50) {
        expect(zip.getUint16(offset + 8, true)).toBe(0)
        const length = zip.getUint32(offset + 18, true)
        const payload =
          offset + 30 + zip.getUint16(offset + 26, true) + zip.getUint16(offset + 28, true)
        expect(payload % 64).toBe(0)
        offset = payload + length
        entries++
      }
      expect(entries).toBe(Object.keys(files).length)
      expect(entries).toBeGreaterThan(10)

      if (wall) {
        const horizontalBlob = await exportAssemblyUsdz(assembly, 'semi-wall')
        const horizontalFiles = unzipSync(new Uint8Array(await horizontalBlob.arrayBuffer()))
        for (const name of Object.keys(files).filter((name) => name.startsWith('geometries/')))
          expect(files[name]).toEqual(horizontalFiles[name])
      }
      disposeAssembly(assembly)
    },
    15_000,
  )
})
