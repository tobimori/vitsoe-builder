import type { BuilderDocument, CatalogProduct, FinishId, PlacedItem } from '../domain/types'
import { allowedFaces, variantFor } from '../domain/rules'
import { priceForVariant } from '../data/catalog'
import {
  isIntegratedTable,
  isOpenable,
  orientationsFor,
  resolveItemFinish,
} from '../domain/products'
import { NumberField } from './Controls'

export function Inspector({
  document,
  catalog,
  item,
  onChange,
  onDuplicate,
  onDelete,
  onClose,
}: {
  document: BuilderDocument
  catalog: CatalogProduct[]
  item: PlacedItem
  onChange: (item: PlacedItem) => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const product = catalog.find((entry) => entry.id === item.productId)
  const variant = variantFor(item, catalog)
  if (!product || !variant) return null
  const orientations = orientationsFor(item.productId)
  const resolvedFinish = resolveItemFinish(document, item, catalog)
  const price = priceForVariant(variant, resolvedFinish.finish)
  const selectedFinish = item.finishOverride ?? item.finish
  const hasFrontPanel = item.productId.includes('cabinet') || item.productId === 'shelf-with-drawer'

  const setFinish = (finishOverride: FinishId | 'system') => {
    const candidate = { ...item, finishOverride }
    const resolved = resolveItemFinish(document, candidate, catalog)
    onChange({
      ...candidate,
      finish: resolved.finish,
      frontFinish: resolved.frontFinish,
    })
  }

  return (
    <aside className="inspector" aria-label="Selected component">
      <header className="inspector-header">
        <div>
          <p className="eyebrow">Selected component</p>
          <h2>{product.name}</h2>
          <p>{variant.name}</p>
        </div>
        <button type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="inspector-body">
        <label className="number-field">
          <span>Bay</span>
          <select
            value={item.bayIndex}
            onChange={(event) => onChange({ ...item, bayIndex: Number(event.currentTarget.value) })}
          >
            {document.system.bays.map((bay, index) => (
              <option value={index} key={bay.id}>
                Bay {index + 1} · {bay.centreWidth}
              </option>
            ))}
          </select>
        </label>
        {isIntegratedTable(item.productId) ? (
          <div className="static-field">
            <span>Tabletop height</span>
            <strong>740 mm · fixed</strong>
          </div>
        ) : (
          <NumberField
            label="Pin height"
            value={item.height}
            min={0}
            max={document.room.ceilingHeight}
            step={70}
            onChange={(height) => onChange({ ...item, height })}
          />
        )}
        {product.id === 'sloping-shelf' && (
          <label className="number-field">
            <span>Slope</span>
            <select
              value={item.variantId}
              onChange={(event) => onChange({ ...item, variantId: event.currentTarget.value })}
            >
              {product.variants
                .filter((option) => option.width === variant.width)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name.split(' · ')[0]}
                  </option>
                ))}
            </select>
          </label>
        )}
        {orientations.length > 1 && (
          <label className="number-field">
            <span>Orientation</span>
            <select
              value={item.orientation ?? 'standard'}
              onChange={(event) =>
                onChange({
                  ...item,
                  orientation: event.currentTarget.value as 'standard' | 'inverted' | 'vertical',
                })
              }
            >
              {orientations.map((orientation) => (
                <option key={orientation} value={orientation}>
                  {orientation === 'standard'
                    ? 'Upright'
                    : orientation === 'vertical'
                      ? 'Vertical pinboard'
                      : 'Inverted'}
                </option>
              ))}
            </select>
          </label>
        )}
        {allowedFaces(document).length > 1 && variant.faces.length > 1 && (
          <label className="number-field">
            <span>Face</span>
            <select
              value={item.face}
              onChange={(event) =>
                onChange({ ...item, face: event.currentTarget.value as 'front' | 'back' })
              }
            >
              <option value="front">Front</option>
              <option value="back">Back</option>
            </select>
          </label>
        )}
        {resolvedFinish.materialLabel ? (
          <div className="static-field">
            <span>Material</span>
            <strong>{resolvedFinish.materialLabel}</strong>
          </div>
        ) : (
          <label className="number-field finish-override-field">
            <span>Finish</span>
            <select
              value={selectedFinish}
              onChange={(event) => setFinish(event.currentTarget.value as FinishId | 'system')}
            >
              <option value="system">Use system finish</option>
              {variant.finishes.map((finish) => (
                <option value={finish} key={finish}>
                  {finish === 'off-white' ? 'Off-white' : finish[0].toUpperCase() + finish.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasFrontPanel && resolvedFinish.finish === 'beech' && selectedFinish !== 'system' && (
          <label className="number-field">
            <span>Front panel</span>
            <select
              value={resolvedFinish.frontFinish ?? 'off-white'}
              onChange={(event) =>
                onChange({
                  ...item,
                  frontFinish: event.currentTarget.value as 'off-white' | 'black' | 'silver',
                })
              }
            >
              <option value="off-white">Off-white</option>
              <option value="black">Black</option>
              <option value="silver">Silver</option>
            </select>
          </label>
        )}
        {hasFrontPanel && resolvedFinish.finish === 'beech' && selectedFinish === 'system' && (
          <div className="static-field">
            <span>Front panel</span>
            <strong>{resolvedFinish.frontFinish}</strong>
          </div>
        )}
        {isOpenable(item.productId) && (
          <label className="toggle-row inspector-toggle">
            <span>{item.productId === 'desk-shelf' ? 'Desk' : 'Drawer / flap'}</span>
            <span>
              <input
                type="checkbox"
                checked={item.open ?? false}
                onChange={(event) => onChange({ ...item, open: event.currentTarget.checked })}
              />{' '}
              {item.open ? 'Open' : 'Closed'}
            </span>
          </label>
        )}
        <div className="static-field price-field">
          <span>Price incl. VAT</span>
          <strong>
            {price === undefined ? 'Unavailable' : `${price.toLocaleString('de-DE')} €`}
          </strong>
        </div>
      </div>
      <footer>
        <button type="button" title="Duplicate (Ctrl/Cmd+D)" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="danger" type="button" onClick={onDelete}>
          Delete
        </button>
      </footer>
    </aside>
  )
}
