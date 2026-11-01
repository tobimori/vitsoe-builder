import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'

const paper = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  side: THREE.DoubleSide,
  // Pushes surfaces back, so the lines drawn on them are not hidden by z-fighting
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
})

/** Faces that meet at more than this angle are inked; finer facets of curves are not. */
const CREASE = Math.cos(THREE.MathUtils.degToRad(24))

/** Positions closer than this, in model units, count as the same vertex. */
const WELD = 1e4

/** Quantised coordinates below this pack into one exact number; larger models use strings. */
const PACK = 2 ** 17

/** Every edge between two faces that are not coplanar, with the normals of both faces. */
interface EdgeTable {
  positions: Float32Array
  normals: Float32Array
  /** Creases and open edges, which are inked whenever one face is visible. */
  crease: Uint8Array
  /** The positions of the creases only, for outlines. */
  creases: Float32Array
  open: boolean
}

/** Geometries are shared between rebuilds of the assembly, so their tables are too. */
const tables = new WeakMap<THREE.BufferGeometry, EdgeTable>()

/** Ids that are equal for vertices at the same position. */
function weldVertices(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const ids = new Uint32Array(position.count)
  const welded = new Map<number | string, number>()

  for (let vertex = 0; vertex < position.count; vertex++) {
    const x = Math.round(position.getX(vertex) * WELD)
    const y = Math.round(position.getY(vertex) * WELD)
    const z = Math.round(position.getZ(vertex) * WELD)
    const key =
      Math.abs(x) < PACK && Math.abs(y) < PACK && Math.abs(z) < PACK
        ? ((x + PACK) * 2 * PACK + (y + PACK)) * 2 * PACK + (z + PACK)
        : `${x},${y},${z}`
    let id = welded.get(key)
    if (id === undefined) {
      id = welded.size
      welded.set(key, id)
    }
    ids[vertex] = id
  }

  return { ids, count: welded.size }
}

function edgeTable(geometry: THREE.BufferGeometry): EdgeTable {
  const cached = tables.get(geometry)
  if (cached) return cached

  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const corners = index ? index.count : position.count
  const vertexAt = (corner: number) => (index ? index.getX(corner) : corner)
  const { ids, count } = weldVertices(position)

  const faceNormals = new Float32Array(corners)
  const edges = new Map<number, number>()
  const from: number[] = []
  const to: number[] = []
  const firstFace: number[] = []
  const secondFace: number[] = []
  const faces: number[] = []

  for (let corner = 0; corner + 2 < corners; corner += 3) {
    const a = vertexAt(corner)
    const b = vertexAt(corner + 1)
    const c = vertexAt(corner + 2)
    const ax = position.getX(a)
    const ay = position.getY(a)
    const az = position.getZ(a)
    const ux = position.getX(b) - ax
    const uy = position.getY(b) - ay
    const uz = position.getZ(b) - az
    const vx = position.getX(c) - ax
    const vy = position.getY(c) - ay
    const vz = position.getZ(c) - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const length = Math.hypot(nx, ny, nz)
    if (length === 0) continue
    faceNormals[corner] = nx / length
    faceNormals[corner + 1] = ny / length
    faceNormals[corner + 2] = nz / length

    const vertices = [a, b, c]
    for (let side = 0; side < 3; side++) {
      const start = vertices[side]!
      const end = vertices[(side + 1) % 3]!
      const low = Math.min(ids[start]!, ids[end]!)
      const high = Math.max(ids[start]!, ids[end]!)
      if (low === high) continue
      const key = low * count + high
      const edge = edges.get(key)
      if (edge === undefined) {
        edges.set(key, faces.length)
        from.push(start)
        to.push(end)
        firstFace.push(corner)
        secondFace.push(corner)
        faces.push(1)
      } else {
        if (faces[edge] === 1) secondFace[edge] = corner
        faces[edge]!++
      }
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const crease: number[] = []
  const creases: number[] = []
  let open = false

  for (let edge = 0; edge < faces.length; edge++) {
    const first = firstFace[edge]!
    const second = secondFace[edge]!
    const dot =
      faceNormals[first]! * faceNormals[second]! +
      faceNormals[first + 1]! * faceNormals[second + 1]! +
      faceNormals[first + 2]! * faceNormals[second + 2]!
    const isCrease = faces[edge] !== 2 || dot < CREASE
    if (!isCrease && dot > 0.9999) continue

    open ||= faces[edge] === 1
    const segment = [
      position.getX(from[edge]!),
      position.getY(from[edge]!),
      position.getZ(from[edge]!),
      position.getX(to[edge]!),
      position.getY(to[edge]!),
      position.getZ(to[edge]!),
    ]
    positions.push(...segment)
    if (isCrease) creases.push(...segment)
    normals.push(
      faceNormals[first]!,
      faceNormals[first + 1]!,
      faceNormals[first + 2]!,
      faceNormals[second]!,
      faceNormals[second + 1]!,
      faceNormals[second + 2]!,
    )
    crease.push(isCrease ? 1 : 0)
  }

  const table = {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    crease: new Uint8Array(crease),
    creases: new Float32Array(creases),
    open,
  }
  tables.set(geometry, table)
  return table
}

/**
 * The edges a parallel projection along `direction` sees: creases on a visible face, and
 * outlines where the surface turns away. Hidden ones are removed by the white surfaces.
 */
function visibleEdges(table: EdgeTable, direction: THREE.Vector3) {
  const { positions, normals, crease, open } = table
  const visible: number[] = []
  const { x, y, z } = direction

  for (let edge = 0; edge < crease.length; edge++) {
    const n = edge * 6
    const first = normals[n]! * x + normals[n + 1]! * y + normals[n + 2]! * z < 0
    const second = normals[n + 3]! * x + normals[n + 4]! * y + normals[n + 5]! * z < 0
    const outline = first !== second
    if (outline || (crease[edge] && (open || first || second)))
      for (let i = 0; i < 6; i++) visible.push(positions[n + i]!)
  }

  return visible
}

/**
 * A pen for the drawing: `width` is in CSS pixels at the given view size. A raised pen
 * draws over the shaded surfaces its lines lie on.
 */
export function createInk(colour: string, width: number, raised = false) {
  return new LineMaterial({
    color: colour,
    linewidth: width,
    worldUnits: false,
    polygonOffset: raised,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  })
}

export function isInkLine(object: THREE.Object3D): object is LineSegments2 {
  return object instanceof LineSegments2
}

/** The meshes of `root` with their edge tables. */
function edgeTables(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true)
  const meshes: { mesh: THREE.Mesh; table: EdgeTable }[] = []
  root.traverseVisible((object) => {
    if (object instanceof THREE.Mesh && !isInkLine(object))
      meshes.push({ mesh: object, table: edgeTable(object.geometry) })
  })
  return meshes
}

function addLines(mesh: THREE.Mesh, edges: number[] | Float32Array, ink: LineMaterial) {
  if (edges.length === 0) return () => {}
  const geometry = new LineSegmentsGeometry().setPositions(edges)
  const lines = new LineSegments2(geometry, ink)
  lines.raycast = () => {}
  mesh.add(lines)
  return () => {
    mesh.remove(lines)
    geometry.dispose()
  }
}

/**
 * Turns the shaded model into a line drawing, after Vitsœ's system illustrations, as seen
 * along the world `direction` of a parallel projection. Returns a function that restores
 * the materials.
 */
export function drawLines(root: THREE.Object3D, direction: THREE.Vector3, ink: LineMaterial) {
  const toLocal = new THREE.Matrix3()
  const restores = edgeTables(root).map(({ mesh, table }) => {
    // Normals transform with the inverse transpose, so a direction tests against them with the inverse
    const local = direction.clone().applyMatrix3(toLocal.setFromMatrix4(mesh.matrixWorld).invert())
    const removeLines = addLines(mesh, visibleEdges(table, local), ink)
    const material = mesh.material
    mesh.material = paper

    return () => {
      mesh.material = material
      removeLines()
    }
  })

  return () => {
    for (const restore of restores) restore()
  }
}

/** Inks the creases of a shaded model, which outlines it from any angle. */
export function outlineCreases(root: THREE.Object3D, ink: LineMaterial) {
  const restores = edgeTables(root).map(({ mesh, table }) => addLines(mesh, table.creases, ink))

  return () => {
    for (const restore of restores) restore()
  }
}
