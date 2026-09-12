import { deriveSupportTrackPlans } from '../domain/rules'
import { isIntegratedTable } from '../domain/products'
import type { BuilderDocument, CatalogProduct, ConnectedSupportMove } from '../domain/types'
import { NumberField } from './Controls'

export function SupportInspector({
  document,
  catalog,
  supportIndex,
  onChange,
  onClose,
}: {
  document: BuilderDocument
  catalog: CatalogProduct[]
  supportIndex: number
  onChange: (move: ConnectedSupportMove) => void
  onClose: () => void
}) {
  const { mountingType, placement, mountHeight } = document.system
  const wallMounted = mountingType === 'wall' || mountingType === 'semi-wall'
  const wallRunsAlongZ = placement.rotation === 90 || placement.rotation === 270
  const heightLocked = document.system.items.some((item) => isIntegratedTable(item.productId))
  const tracks = deriveSupportTrackPlans(document, catalog).filter(
    (track) => track.supportIndex === supportIndex,
  )
  const move = (patch: Partial<ConnectedSupportMove>) =>
    onChange({ x: placement.x, z: placement.z, mountHeight, ...patch })

  return (
    <aside className="inspector support-inspector" aria-label="Selected support">
      <header>
        <p className="eyebrow">Connected support run</p>
        <h2>Support {supportIndex + 1}</h2>
        <p>Moving this support keeps every bay centre fixed.</p>
      </header>
      <div className="inspector-body">
        {(!wallMounted || !wallRunsAlongZ) && (
          <NumberField
            label="Run from left"
            value={placement.x}
            min={0}
            max={document.room.width}
            onChange={(x) => move({ x })}
          />
        )}
        {(!wallMounted || wallRunsAlongZ) && (
          <NumberField
            label="Run from back"
            value={placement.z}
            min={0}
            max={document.room.depth}
            onChange={(z) => move({ z })}
          />
        )}
        {mountingType === 'wall' && (
          <NumberField
            label="Track bottom"
            value={mountHeight}
            min={0}
            max={document.room.ceilingHeight - 110}
            disabled={heightLocked}
            onChange={(nextMountHeight) => move({ mountHeight: nextMountHeight })}
          />
        )}
        {mountingType === 'wall' && heightLocked && (
          <p className="hint">
            Table legs fix the installation height. Horizontal movement remains available.
          </p>
        )}
        {mountingType === 'semi-wall' && (
          <div className="static-field">
            <span>Wall standoff</span>
            <strong>Hardware fixed</strong>
          </div>
        )}
        <div className="support-track-list">
          {tracks.map((track) => (
            <p key={track.face}>
              <span>{track.face} E-track</span>
              <strong>
                {track.bottom}–{track.top} mm
              </strong>
            </p>
          ))}
        </div>
      </div>
      <footer>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </footer>
    </aside>
  )
}
