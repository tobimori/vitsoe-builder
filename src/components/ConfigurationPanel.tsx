import { useState } from 'react'
import type { BuilderDocument, MountingType } from '../domain/types'
import { FREESTANDING_MAX_HEIGHT, deriveSupportTrackPlans, totalCentreWidth } from '../domain/rules'
import { catalog } from '../data/catalog'
import { structureRules } from '../data/structure'
import { isIntegratedTable, resolveItemFinish } from '../domain/products'
import { resizeBay } from '../domain/bays'
import { NumberField, Segmented } from './Controls'

const supports: { value: MountingType; label: string }[] = [
  { value: 'wall', label: 'Wall-mounted' },
  { value: 'semi-wall', label: 'Semi wall-mounted' },
  { value: 'floor-to-ceiling', label: 'Floor-to-ceiling' },
  { value: 'freestanding', label: 'Freestanding' },
]

const twoSided = (mountingType: MountingType) =>
  mountingType === 'freestanding' || mountingType === 'floor-to-ceiling'

export function ConfigurationPanel({
  document,
  tab,
  onTabChange,
  onChange,
  selectedSupportIndex,
  onSelectSupport,
}: {
  document: BuilderDocument
  tab: 'system' | 'room'
  onTabChange: (tab: 'system' | 'room') => void
  onChange: (document: BuilderDocument) => void
  selectedSupportIndex: number | null
  onSelectSupport: (supportIndex: number) => void
}) {
  const [bayResizeMessage, setBayResizeMessage] = useState<string | null>(null)
  const setSystem = (patch: Partial<BuilderDocument['system']>) =>
    onChange({ ...document, system: { ...document.system, ...patch } })
  const setRoom = (patch: Partial<BuilderDocument['room']>) =>
    onChange({ ...document, room: { ...document.room, ...patch } })

  const setMountBottom = (mountHeight: number) => {
    if (document.system.items.some((item) => isIntegratedTable(item.productId))) return
    const delta = mountHeight - document.system.mountHeight
    setSystem({
      mountHeight,
      items: document.system.items.map((item) =>
        isIntegratedTable(item.productId) ? item : { ...item, height: item.height + delta },
      ),
    })
  }
  const setStructureOptions = (
    patch: Partial<NonNullable<BuilderDocument['system']['structureOptions']>>,
  ) => {
    const structureOptions = {
      wallBracket: 'short' as const,
      extensionBolts: false,
      cableChannels: false,
      stabilisingFeet: false,
      ...document.system.structureOptions,
      ...patch,
    }
    const bracketReach =
      (structureOptions.wallBracket === 'long' ? 110 : 70) +
      (structureOptions.extensionBolts ? 65 : 0)
    const alongZ =
      document.system.placement.rotation === 90 || document.system.placement.rotation === 270
    setSystem({
      structureOptions,
      placement:
        document.system.mountingType === 'semi-wall'
          ? {
              ...document.system.placement,
              x: alongZ ? bracketReach : document.system.placement.x,
              z: alongZ ? document.system.placement.z : bracketReach,
            }
          : document.system.placement,
    })
  }

  const setMounting = (mountingType: MountingType) => {
    if (mountingType === document.system.mountingType) return
    const supportsTwoSides = twoSided(mountingType)
    const alongZ =
      document.system.placement.rotation === 90 || document.system.placement.rotation === 270
    const placement = { ...document.system.placement }
    if (mountingType === 'wall') {
      if (alongZ) placement.x = 0
      else placement.z = 0
    } else if (mountingType === 'semi-wall') {
      if (alongZ) placement.x = 70
      else placement.z = 70
    } else {
      placement.z = Math.max(600, placement.z)
    }
    setSystem({
      mountingType,
      mountHeight: structureRules[mountingType].normalTrackBaseline,
      activeFace: 'front',
      placement,
      items: document.system.items.map((item) => ({
        ...item,
        face: supportsTwoSides ? item.face : 'front',
      })),
    })
  }

  const setBayWidth = (index: number, centreWidth: 667 | 912) => {
    const result = resizeBay(document, catalog, index, centreWidth)
    if (!result.ok) {
      setBayResizeMessage(result.message)
      return
    }
    setBayResizeMessage(null)
    onChange(result.document)
  }

  const systemFinish = document.system.finish ?? { colour: 'off-white', wood: 'laminate' }
  const finishValue =
    systemFinish.wood === 'beech' ? `beech-${systemFinish.colour}` : systemFinish.colour

  const setFinish = (value: string) => {
    const beech = value.startsWith('beech-')
    const colour = (beech ? value.slice(6) : value) as 'off-white' | 'black' | 'silver'
    setSystem({ finish: { colour, wood: beech ? 'beech' : 'laminate' } })
  }
  const overrideCount = document.system.items.filter(
    (item) => item.finishOverride !== 'system',
  ).length
  const wallMounted =
    document.system.mountingType === 'wall' || document.system.mountingType === 'semi-wall'
  const wallRunsAlongZ =
    document.system.placement.rotation === 90 || document.system.placement.rotation === 270
  const useSystemFinishForAll = () => {
    const items = document.system.items.map((item) => {
      const resolved = resolveItemFinish(document, { ...item, finishOverride: 'system' }, catalog)
      return {
        ...item,
        finishOverride: 'system' as const,
        finish: resolved.finish,
        frontFinish: resolved.frontFinish,
      }
    })
    setSystem({ items })
  }

  const removeBay = (index: number) => {
    if (document.system.bays.length === 1) return
    setSystem({
      bays: document.system.bays.filter((_, bayIndex) => bayIndex !== index),
      items: document.system.items
        .filter((item) => item.bayIndex !== index)
        .map((item) => ({
          ...item,
          bayIndex: item.bayIndex > index ? item.bayIndex - 1 : item.bayIndex,
        })),
    })
  }

  return (
    <aside className="config-panel" aria-label="Configuration">
      <div className="tabs" role="tablist" aria-label="Edit">
        {(['system', 'room'] as const).map((value) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            key={value}
            onClick={() => onTabChange(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === 'system' ? (
        <div className="panel-content">
          <section>
            <h2>Support</h2>
            <div className="support-grid">
              {supports.map((support) => (
                <button
                  type="button"
                  key={support.value}
                  className={document.system.mountingType === support.value ? 'active' : ''}
                  aria-pressed={document.system.mountingType === support.value}
                  onClick={() => setMounting(support.value)}
                >
                  <span className="support-icon" aria-hidden="true">
                    <span className={`support-mark ${support.value}`} />
                  </span>
                  <span className="support-label">{support.label}</span>
                </button>
              ))}
            </div>
            <p className="hint">
              {supports.find((support) => support.value === document.system.mountingType)?.label}
            </p>
          </section>

          <section>
            <h2>System finish</h2>
            <label className="finish-select-row">
              <span
                className={`finish-preview ${systemFinish.colour} ${systemFinish.wood}`}
                aria-hidden="true"
              />
              <select
                value={finishValue}
                onChange={(event) => setFinish(event.currentTarget.value)}
              >
                <option value="off-white">Off-white</option>
                <option value="black">Black</option>
                <option value="silver">Silver</option>
                <option value="beech-off-white">Beech with off-white</option>
                <option value="beech-black">Beech with black</option>
                <option value="beech-silver">Beech with silver</option>
              </select>
            </label>
            <p className="hint">
              Beech applies to supported wood components; metal parts use the selected colour.
            </p>
            {overrideCount > 0 && (
              <button type="button" className="text-action" onClick={useSystemFinishForAll}>
                Use system finish for all · {overrideCount} override{overrideCount === 1 ? '' : 's'}
              </button>
            )}
          </section>

          <section>
            <div className="section-heading">
              <h2>Bays</h2>
              <span>{totalCentreWidth(document)} mm centres</span>
            </div>
            <div className="bay-list">
              {document.system.bays.map((bay, index) => (
                <div className="bay-row" key={bay.id}>
                  <span className="bay-index">{index + 1}</span>
                  <Segmented
                    label={`Bay ${index + 1} centre width`}
                    value={String(bay.centreWidth)}
                    options={[
                      { value: '667', label: '667' },
                      { value: '912', label: '912' },
                    ]}
                    onChange={(value) => setBayWidth(index, Number(value) as 667 | 912)}
                  />
                  <button
                    type="button"
                    className="remove"
                    aria-label={`Remove bay ${index + 1}`}
                    onClick={() => removeBay(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {bayResizeMessage && (
              <p className="field-message" role="alert">
                {bayResizeMessage}
              </p>
            )}
            <button
              type="button"
              className="text-action"
              onClick={() =>
                setSystem({
                  bays: [...document.system.bays, { id: `bay-${Date.now()}`, centreWidth: 667 }],
                })
              }
            >
              <span>＋</span> Add bay
            </button>
            {document.system.mountingType === 'freestanding' && (
              <p className="hint">Maximum freestanding height: {FREESTANDING_MAX_HEIGHT} mm.</p>
            )}
          </section>

          <section>
            <div className="section-heading">
              <h2>E-tracks</h2>
              <span>{document.system.trackMode === 'manual' ? 'Manual' : 'Automatic'}</span>
            </div>
            <Segmented
              label="E-track sizing"
              value={document.system.trackMode ?? 'automatic'}
              options={[
                { value: 'automatic', label: 'Automatic' },
                { value: 'manual', label: 'Manual' },
              ]}
              onChange={(trackMode) => setSystem({ trackMode })}
            />
            {document.system.trackMode === 'manual' ? (
              <>
                <NumberField
                  label="Installed length"
                  value={document.system.railHeight}
                  min={110}
                  max={document.room.ceilingHeight}
                  step={10}
                  onChange={(railHeight) => setSystem({ railHeight })}
                />
                <NumberField
                  label="Track bottom"
                  value={document.system.mountHeight}
                  min={0}
                  max={document.room.ceilingHeight - 110}
                  disabled={document.system.items.some((item) => isIntegratedTable(item.productId))}
                  onChange={setMountBottom}
                />
                {document.system.items.some((item) => isIntegratedTable(item.productId)) && (
                  <p className="hint">Table legs fix the installation height.</p>
                )}
              </>
            ) : (
              <div className="track-summary">
                {deriveSupportTrackPlans(document, catalog).map((track) => (
                  <button
                    type="button"
                    className={selectedSupportIndex === track.supportIndex ? 'active' : ''}
                    key={`${track.supportIndex}-${track.face}`}
                    onClick={() => onSelectSupport(track.supportIndex)}
                  >
                    <span>
                      Support {track.supportIndex + 1} · {track.face}
                    </span>
                    <strong>
                      {track.segments
                        .map((segment) => `${segment.installedLength}${segment.cut ? '*' : ''}`)
                        .join(' + ')}{' '}
                      mm
                    </strong>
                  </button>
                ))}
                <small>* cut to fit. Joins require planner confirmation.</small>
              </div>
            )}
          </section>

          {document.system.mountingType !== 'wall' && (
            <section>
              <h2>Structural options</h2>
              {document.system.mountingType === 'semi-wall' && (
                <>
                  <label className="number-field">
                    <span>Wall bracket</span>
                    <select
                      value={document.system.structureOptions?.wallBracket ?? 'short'}
                      onChange={(event) =>
                        setStructureOptions({
                          wallBracket: event.currentTarget.value as 'short' | 'long',
                        })
                      }
                    >
                      <option value="short">60–70 mm</option>
                      <option value="long">100–110 mm</option>
                    </select>
                  </label>
                  <p className="hint">
                    Match “From back wall” to the selected bracket reach
                    {document.system.structureOptions?.extensionBolts ? ' plus 65 mm' : ''}.
                  </p>
                  <label className="toggle-row option-row">
                    <span>65 mm extensions</span>
                    <input
                      type="checkbox"
                      checked={document.system.structureOptions?.extensionBolts ?? false}
                      onChange={(event) =>
                        setStructureOptions({ extensionBolts: event.currentTarget.checked })
                      }
                    />
                  </label>
                </>
              )}
              <label className="toggle-row option-row">
                <span>Cable channels</span>
                <input
                  type="checkbox"
                  checked={document.system.structureOptions?.cableChannels ?? false}
                  onChange={(event) =>
                    setStructureOptions({ cableChannels: event.currentTarget.checked })
                  }
                />
              </label>
              {(document.system.mountingType === 'semi-wall' ||
                document.system.mountingType === 'floor-to-ceiling') && (
                <label className="toggle-row option-row">
                  <span>Stabilising feet</span>
                  <input
                    type="checkbox"
                    checked={document.system.structureOptions?.stabilisingFeet ?? false}
                    onChange={(event) =>
                      setStructureOptions({ stabilisingFeet: event.currentTarget.checked })
                    }
                  />
                </label>
              )}
            </section>
          )}

          <section>
            <h2>Position in room</h2>
            {(!wallMounted || !wallRunsAlongZ) && (
              <NumberField
                label="Run from left"
                value={document.system.placement.x}
                min={0}
                max={document.room.width}
                onChange={(x) => setSystem({ placement: { ...document.system.placement, x } })}
              />
            )}
            {(!wallMounted || wallRunsAlongZ) && (
              <NumberField
                label="Run from back"
                value={document.system.placement.z}
                min={0}
                max={document.room.depth}
                onChange={(z) => setSystem({ placement: { ...document.system.placement, z } })}
              />
            )}
            {document.system.mountingType === 'semi-wall' && (
              <div className="static-field">
                <span>Wall standoff</span>
                <strong>Set by hardware</strong>
              </div>
            )}
            <label className="number-field">
              <span>Rotation</span>
              <select
                value={document.system.placement.rotation}
                onChange={(event) =>
                  setSystem({
                    placement: {
                      ...document.system.placement,
                      rotation: Number(event.currentTarget.value) as 0 | 90 | 180 | 270,
                    },
                  })
                }
              >
                {[0, 90, 180, 270].map((angle) => (
                  <option key={angle} value={angle}>
                    {angle}°
                  </option>
                ))}
              </select>
            </label>
          </section>
        </div>
      ) : (
        <div className="panel-content">
          <section>
            <h2>Room dimensions</h2>
            <p className="hint">A simple rectangular room.</p>
            <NumberField
              label="Width"
              value={document.room.width}
              min={1000}
              max={20000}
              onChange={(width) => setRoom({ width })}
            />
            <NumberField
              label="Depth"
              value={document.room.depth}
              min={1000}
              max={20000}
              onChange={(depth) => setRoom({ depth })}
            />
            <NumberField
              label="Ceiling"
              value={document.room.ceilingHeight}
              min={1800}
              max={6000}
              onChange={(ceilingHeight) => setRoom({ ceilingHeight })}
            />
          </section>
          <section>
            <label className="toggle-row">
              <span>Show dimensions</span>
              <input
                type="checkbox"
                checked={document.room.showDimensions}
                onChange={(event) => setRoom({ showDimensions: event.currentTarget.checked })}
              />
            </label>
          </section>
        </div>
      )}
    </aside>
  )
}
