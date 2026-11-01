import * as THREE from 'three'

const templates = new Map<string, { template: THREE.Object3D; build: number }>()
let build = 0

function forEachGeometry(root: THREE.Object3D, visit: (geometry: THREE.BufferGeometry) => void) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) visit(object.geometry)
  })
}

/**
 * Builds a part once per key and returns copies that share its geometry, so rebuilding
 * the assembly does not triangulate unchanged parts again. The key must cover every
 * input of `make`.
 */
export function reuse<T extends THREE.Object3D>(key: string, make: () => T): T {
  let entry = templates.get(key)
  if (!entry) {
    const template = make()
    forEachGeometry(template, (geometry) => {
      geometry.userData.shared = true
    })
    entry = { template, build }
    templates.set(key, entry)
  }
  entry.build = build
  return entry.template.clone(true) as T
}

/** Starts a rebuild and releases the parts that neither of the last two builds used. */
export function startBuild() {
  build++
  for (const [key, entry] of templates) {
    if (entry.build >= build - 2) continue
    templates.delete(key)
    forEachGeometry(entry.template, (geometry) => geometry.dispose())
  }
}

/** Shared geometry belongs to its template, which outlives any one assembly. */
export function disposeGeometry(geometry: THREE.BufferGeometry) {
  if (!geometry.userData.shared) geometry.dispose()
}
