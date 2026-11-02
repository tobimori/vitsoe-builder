import { catalog } from '../../domain/catalog/catalog'
import { sizedForBay } from '../../domain/catalog/options'
import { initialPlan } from '../../domain/plan/defaults'
import { changeMountingType, setPlacement } from '../../domain/plan/system'
import type { Plan, PlanItem, SystemFinish } from '../../domain/plan/types'
import { fitPlacement } from '../../domain/supports/footprint'
import type { BayWidth, MountingType } from '../../domain/types'

/** A component at a pin height, as Layers lists it; the bay it stands in sets its width. */
interface Part {
  productId: string
  variantId: string
  height: number
}

const part =
  (productId: string, variantId: string) =>
  (...heights: number[]): Part[] =>
    heights.map((height) => ({ productId, variantId, height }))

const shelves = (depth: 160 | 220 | 300 | 360) => part('shelf', `steel-912-${depth}`)
const cabinet = part('cabinet', 'cabinet-912')
const flapCabinet = part('retractable-flap-cabinet', 'retractable-flap-912')
const twoDrawers = part('two-drawer-cabinet', 'two-drawer-912')
const shelfWithDrawer = part('shelf-with-drawer', 'shelf-drawer-912')
const magazineShelf = part('sloping-shelf', 'sloping-79-912')
const sloping = part('sloping-shelf', 'sloping-18-912')

const vitsoePhoto = (asset: number) =>
  `https://d2lsod3xpjaepj.cloudfront.net/files/assets/3000/${asset}/crop169/1050.jpg`

// Are.na's image service reads the resize from base64 JSON, as in the `image.display.url`
// its API returns, so a smaller width than that 1200 px default goes in the same form.
const arenaPhoto = (key: string) =>
  `https://images.are.na/${btoa(
    JSON.stringify({
      bucket: 'arena_images',
      key,
      edits: {
        resize: { width: 720, height: 720, fit: 'inside', withoutEnlargement: true },
        webp: { quality: 75 },
        jpeg: { quality: 75 },
        rotate: null,
      },
    }),
  )}`

interface Recipe {
  id: string
  name: string
  /** The room it was photographed in, as Vitsœ's gallery sorts them. */
  room: string
  description: string
  source: { label: string; url: string }
  /** The photograph it is rebuilt from, loaded from where it is published. */
  photo: string
  mountingType: MountingType
  bays: BayWidth[]
  /** The components in each bay, on the front. */
  front: Part[][]
  /** The components in each bay, on the back of a two-sided system. */
  back?: Part[][]
  colour?: SystemFinish['colour']
  ceilingHeight?: number
}

export interface Inspiration extends Pick<
  Recipe,
  'id' | 'name' | 'room' | 'description' | 'source' | 'photo'
> {
  plan: Plan
}

const recipes: Recipe[] = [
  {
    id: 'library-sideboard',
    name: 'Library over a sideboard',
    room: 'Living room',
    description: 'Four wide bays: a row of cabinets, with five rows of books above.',
    source: { label: 'Are.na, the most saved 606', url: 'https://www.are.na/block/2305075' },
    photo: arenaPhoto('2305075/original_98db8a3a80fc9696c48109a0c957c331.jpg'),
    mountingType: 'wall',
    bays: [912, 912, 912, 912],
    front: Array.from({ length: 4 }, () => [
      ...cabinet(905),
      ...shelves(220)(1255, 1535, 1815, 2095, 2375),
    ]),
  },
  {
    id: 'media-wall',
    name: 'Media wall',
    room: 'Living room',
    description: 'Drawers along the wall, books above, and room for a television in the middle.',
    source: {
      label: 'Vitsœ gallery, living room',
      url: 'https://www.vitsoe.com/gb/606/gallery?category=living-room',
    },
    photo: vitsoePhoto(2236),
    mountingType: 'wall',
    bays: [912, 912, 912, 912, 912],
    front: [
      [...twoDrawers(625), ...shelves(220)(1045, 1395, 1745, 2025)],
      [...flapCabinet(625), ...shelves(220)(1395, 1745, 2025)],
      [...twoDrawers(625), ...shelves(220)(1395, 1745, 2025)],
      [...twoDrawers(625), ...shelves(220)(1045, 1395, 1745, 2025)],
      [...twoDrawers(625), ...shelves(220)(1045, 2025), ...shelves(300)(1395)],
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen shelves',
    room: 'Kitchen & dining',
    description: 'Cookbooks low and deep, then jars, glasses and cups at arm’s reach.',
    source: {
      label: 'Vitsœ gallery, kitchen & dining',
      url: 'https://www.vitsoe.com/gb/606/gallery?category=kitchen-dining',
    },
    photo: vitsoePhoto(2179),
    mountingType: 'wall',
    bays: [912, 912],
    front: Array.from({ length: 2 }, () => [
      ...shelves(300)(415, 765),
      ...shelves(220)(1115, 1395, 1675, 1955, 2235),
    ]),
  },
  {
    id: 'study',
    name: 'Study with a desk',
    room: 'Study & home office',
    description: 'A desk shelf with a drawer between two cabinets, and box files above.',
    source: {
      label: 'Vitsœ gallery, study & home office',
      url: 'https://www.vitsoe.com/gb/606/gallery?category=study',
    },
    photo: vitsoePhoto(2285),
    mountingType: 'wall',
    bays: [912, 912, 912],
    front: [
      [...cabinet(695), ...shelves(220)(1255, 1535), ...shelves(300)(1815)],
      [...shelfWithDrawer(695), ...shelves(220)(1535), ...shelves(300)(1815)],
      [...cabinet(695), ...shelves(220)(1255, 1535), ...shelves(300)(1815)],
    ],
  },
  {
    id: 'bookcase',
    name: 'Bookcase by a door',
    room: 'Bookshelves',
    description: 'Nine rows of books from the floor up, on posts against the wall.',
    source: {
      label: 'Vitsœ gallery, bookshelves',
      url: 'https://www.vitsoe.com/gb/606/gallery?category=books',
    },
    photo: vitsoePhoto(2318),
    mountingType: 'semi-wall',
    bays: [912, 912],
    front: Array.from({ length: 2 }, () =>
      shelves(220)(275, 555, 835, 1115, 1395, 1675, 1955, 2235, 2515),
    ),
    ceilingHeight: 3200,
  },
  {
    id: 'window',
    name: 'Shelves by a window',
    room: 'Living room',
    description: 'One narrow bay of open shelves between two windows.',
    source: {
      label: 'Are.na, the second most saved 606',
      url: 'https://www.are.na/block/12049373',
    },
    photo: arenaPhoto('12049373/original_ccb043bf8ba353bdb9d5cf11b2ada6c7.png'),
    mountingType: 'wall',
    bays: [667],
    front: [[...shelves(300)(835), ...shelves(220)(1115, 1325, 1535, 1745, 1955)]],
  },
  {
    id: 'records',
    name: 'Records and books',
    room: 'TV, media & vinyl',
    description: 'Deep shelves low down for records, with books above.',
    source: { label: 'Are.na', url: 'https://www.are.na/block/14440796' },
    photo: arenaPhoto('14440796/original_2944ae6e4caa48c025b1f808abeaed10.png'),
    mountingType: 'wall',
    bays: [912, 912],
    front: Array.from({ length: 2 }, () => [
      ...shelves(360)(415, 835),
      ...shelves(220)(1325, 1605, 1885),
    ]),
  },
  {
    id: 'magazines',
    name: 'Magazine display',
    room: 'Retail & restaurant',
    description: 'Covers face out on sloping shelves, between shelves of books.',
    source: { label: 'Are.na, a design bookshop', url: 'https://www.are.na/block/1338213' },
    photo: arenaPhoto('1338213/original_cb25f55d4853a4a9f94094b0175b95fb.jpg'),
    mountingType: 'wall',
    bays: [912, 912, 912],
    front: Array.from({ length: 3 }, () => [
      ...shelves(360)(765),
      ...sloping(1115),
      ...magazineShelf(1605),
      ...shelves(220)(1955),
    ]),
  },
  {
    id: 'room-divider',
    name: 'Room divider',
    room: 'Office',
    description: 'Box files on both sides, held between the floor and the ceiling.',
    source: {
      label: 'Vitsœ gallery, office',
      url: 'https://www.vitsoe.com/gb/606/gallery?category=office',
    },
    photo: vitsoePhoto(2348),
    mountingType: 'floor-to-ceiling',
    bays: [912, 912],
    front: Array.from({ length: 2 }, () => shelves(300)(415, 765, 1115, 1465, 1815)),
    back: Array.from({ length: 2 }, () => shelves(300)(415, 765, 1115, 1465, 1815)),
  },
  {
    id: 'bedside',
    name: 'Bedside drawers',
    room: 'Bedroom',
    description: 'A single black cabinet with two drawers, hung beside the bed.',
    source: {
      label: 'Vitsœ gallery, bedroom',
      url: 'https://www.vitsoe.com/gb/606/gallery?category=bedroom-wardrobe',
    },
    photo: vitsoePhoto(2258),
    mountingType: 'wall',
    bays: [912],
    front: [twoDrawers(625)],
    colour: 'black',
  },
]

function toPlan(recipe: Recipe): Plan {
  const base = changeMountingType(initialPlan, recipe.mountingType)
  const bays = recipe.bays.map((centreWidth, index) => ({ id: `bay-${index + 1}`, centreWidth }))
  const faces = [
    ['front', recipe.front],
    ['back', recipe.back ?? []],
  ] as const
  let count = 0
  const items = faces.flatMap(([face, columns]) =>
    columns.flatMap((parts, bayIndex) =>
      parts.map((entry): PlanItem =>
        sizedForBay(
          {
            id: `item-${++count}`,
            productId: entry.productId,
            variantId: entry.variantId,
            bayIndex,
            height: entry.height,
            face,
            finish: 'system',
            orientation: 'standard',
          },
          bays,
          catalog,
        ),
      ),
    ),
  )
  const span = recipe.bays.reduce((total, width) => total + width, 0)
  const width = Math.max(initialPlan.room.width, Math.ceil((span + 1200) / 100) * 100)
  const plan: Plan = {
    ...base,
    name: recipe.name,
    room: { ...base.room, width, ceilingHeight: recipe.ceilingHeight ?? base.room.ceilingHeight },
    system: {
      ...base.system,
      bays,
      items,
      finish: { ...base.system.finish, colour: recipe.colour ?? base.system.finish.colour },
    },
  }
  return fitPlacement(setPlacement(plan, { offset: Math.round((width - span) / 2) }), catalog)
}

/** Popular 606 systems from Vitsœ's gallery and Are.na, rebuilt from their photographs. */
export const inspirations: Inspiration[] = recipes.map((recipe) => ({
  id: recipe.id,
  name: recipe.name,
  room: recipe.room,
  description: recipe.description,
  source: recipe.source,
  photo: recipe.photo,
  plan: toPlan(recipe),
}))
