import { USDZExporter } from 'three/addons/exporters/USDZExporter.js'
import {
  strFromU8,
  strToU8,
  unzipSync,
  zipSync,
  type Zippable,
} from 'three/addons/libs/fflate.module.js'
import type { Group } from 'three'
import type { Catalog } from '../../domain/catalog/catalog'
import type { Plan } from '../../domain/plan/types'
import type { MountingType } from '../../domain/types'
import { buildAssembly, disposeAssembly } from '../models/assembly'

/** Export only the actual configuration, in metres; the room is never included. */
export async function exportAssemblyUsdz(
  assembly: Group,
  mountingType: MountingType,
): Promise<Blob> {
  const snapshot = assembly.clone(true)
  snapshot.position.set(0, 0, 0)
  snapshot.rotation.set(0, 0, 0)
  snapshot.scale.set(1, 1, 1)
  snapshot.name = 'Furniture'
  snapshot.updateMatrixWorld(true)
  const data = await new USDZExporter().parseAsync(snapshot, {
    quickLookCompatible: true,
    includeAnchoringProperties: false,
  })
  // Without an anchor, Quick Look keeps the model upright and lets it snap to the floor
  // or a wall. A vertical anchor shows it on the floor first, turned onto its back, until
  // it is moved to a wall. model-viewer exports ar-placement="wall" the same way:
  // https://github.com/google/model-viewer/issues/3989
  if (mountingType === 'wall') return new Blob([data], { type: 'model/vnd.usdz+zip' })

  const files = unzipSync(data)
  const source = files['model.usda']
  const model = source ? strFromU8(source) : ''
  const root = 'def Xform "Root"\n{'
  if (!model.includes(root)) throw new Error('USDZ export root was not found.')

  // Three's exporter supplies the meshes but omits the applied anchoring API.
  // Put it on the document root as Apple specifies.
  // https://developer.apple.com/documentation/usd/preliminary-anchoringapi
  files['model.usda'] = strToU8(
    model.replace(
      root,
      `def Xform "Root" (
    prepend apiSchemas = ["Preliminary_AnchoringAPI"]
)
{
    uniform token preliminary:anchoring:type = "plane"
    uniform token preliminary:planeAnchoring:alignment = "horizontal"`,
    ),
  )

  // USDZ requires uncompressed files whose payloads begin at 64-byte offsets.
  // Repacking after editing the root must preserve that requirement, including
  // geometry and texture entries. No mesh or texture bytes are changed.
  const aligned: Zippable = {}
  let offset = 0
  for (const [name, bytes] of Object.entries(files)) {
    const header = 30 + strToU8(name).length + 4
    const padding = (64 - ((offset + header) % 64)) % 64
    aligned[name] = [bytes, { extra: { 12345: new Uint8Array(padding) } }]
    offset += header + padding + bytes.length
  }
  return new Blob([zipSync(aligned, { level: 0 })], { type: 'model/vnd.usdz+zip' })
}

/** Builds the same assembly as the scene, so AR shows exactly the planned geometry. */
export async function exportPlanUsdz(plan: Plan, catalog: Catalog) {
  const assembly = buildAssembly(plan, catalog)
  try {
    return await exportAssemblyUsdz(assembly, plan.system.mountingType)
  } finally {
    disposeAssembly(assembly)
  }
}
