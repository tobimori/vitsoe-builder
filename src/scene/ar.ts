import { decorTexturesReady } from './decor'
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js'
import {
  strFromU8,
  strToU8,
  unzipSync,
  zipSync,
  type Zippable,
} from 'three/addons/libs/fflate.module.js'
import type { Group } from 'three'
import type { MountingType } from '../domain/types'

/** Export only the actual configuration, in metres; the room is never included. */
export async function exportAssemblyUsdz(
  assembly: Group,
  mountingType: MountingType,
): Promise<Blob> {
  await decorTexturesReady()
  const snapshot = assembly.clone(true)
  snapshot.position.set(0, 0, 0)
  const wall = mountingType === 'wall'
  // Apple plane anchors use local XZ as the surface and +Y as its normal.
  // In wall-anchor space, furniture depth is +Y and furniture up is -Z.
  snapshot.rotation.set(wall ? -Math.PI / 2 : 0, 0, 0)
  snapshot.scale.set(1, 1, 1)
  snapshot.name = 'Furniture'
  snapshot.updateMatrixWorld(true)
  const data = await new USDZExporter().parseAsync(snapshot, {
    quickLookCompatible: true,
    includeAnchoringProperties: false,
  })
  const files = unzipSync(data)
  const model = strFromU8(files['model.usda'])
  const root = 'def Xform "Root"\n{'
  if (!model.includes(root)) throw new Error('USDZ export root was not found.')

  // Three's exporter supplies the meshes but omits the applied anchoring API.
  // Put it on the document root as Apple specifies. The authored wall-anchor
  // rotation cancels the child rotation in Object mode; AR replaces this root
  // pose with the detected plane pose and retains the child-to-anchor basis.
  // https://developer.apple.com/documentation/usd/preliminary-anchoringapi
  files['model.usda'] = strToU8(
    model.replace(
      root,
      `def Xform "Root" (
    prepend apiSchemas = ["Preliminary_AnchoringAPI"]
)
{
    uniform token preliminary:anchoring:type = "plane"
    uniform token preliminary:planeAnchoring:alignment = "${wall ? 'vertical' : 'horizontal'}"
    double xformOp:rotateX = ${wall ? 90 : 0}
    uniform token[] xformOpOrder = ["xformOp:rotateX"]`,
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
