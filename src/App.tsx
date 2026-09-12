import { useEffect, useMemo, useRef, useState } from 'react'
import { BuilderScene } from './scene/BuilderScene'
import { catalog } from './data/catalog'
import { initialDocument } from './domain/defaults'
import {
  allowedFaces,
  buildPartsList,
  findAvailablePlacement,
  itemTreeIds,
  itemsHaveTrackHeightError,
  moveConnectedSupportRun,
  proposeItemDuplicate,
  proposeItemMove,
  roomBoundaryOverflow,
  snapItemHeight,
  validateDocument,
  variantFor,
} from './domain/rules'
import type {
  BuilderDocument,
  ConnectedSupportMove,
  ItemDragStatus,
  PlacedItem,
  ViewMode,
} from './domain/types'
import { migrateDocumentFinishes, parseBuilderDocument } from './domain/document'
import { commitHistory, createHistory, redoHistory, undoHistory } from './domain/history'
import { isAccessory } from './domain/products'
import { buildPlanUrl, decodePlanHash, resolveInitialPlan } from './domain/share'
import { CatalogDrawer } from './components/CatalogDrawer'
import { ConfigurationPanel } from './components/ConfigurationPanel'
import { Inspector } from './components/Inspector'
import { PartsPanel } from './components/PartsPanel'
import { SupportInspector } from './components/SupportInspector'

const STORAGE_KEY = 'vitsoe-606-builder-v1'

function loadDocument() {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Shared links still work when private browsing blocks local storage.
  }
  return resolveInitialPlan(window.location.hash, saved, catalog, initialDocument)
}

function makeId(prefix: string) {
  const suffix =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`
}

export default function App() {
  const [initialPlan] = useState(loadDocument)
  const [history, setHistory] = useState(() => createHistory(initialPlan.document))
  const document = history.present
  const setDocument = (next: BuilderDocument) => {
    setHistory((current) => commitHistory(current, next))
  }
  const setActiveFace = (activeFace: 'front' | 'back') => {
    setHistory((current) => ({
      ...current,
      present: {
        ...current.present,
        system: { ...current.present.system, activeFace },
      },
    }))
  }
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedSupportIndex, setSelectedSupportIndex] = useState<number | null>(null)
  const [dragStatus, setDragStatus] = useState<ItemDragStatus | null>(null)
  const [dragFaceOverride, setDragFaceOverride] = useState<'front' | 'back' | null>(null)
  const [cancelDragRevision, setCancelDragRevision] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('orbit')
  const [cameraFitRevision, setCameraFitRevision] = useState(0)
  const [tab, setTab] = useState<'system' | 'room'>('system')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [partsOpen, setPartsOpen] = useState(false)
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(initialPlan.warning ?? null)
  const [shareFallbackUrl, setShareFallbackUrl] = useState<string | null>(null)
  const [arUrl, setArUrl] = useState<string | null>(null)
  const [arLoading, setArLoading] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const exportUsdzRef = useRef<(() => Promise<Blob>) | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const mobileDialogRef = useRef<HTMLDivElement>(null)
  const arDialogRef = useRef<HTMLDivElement>(null)
  const shareInputRef = useRef<HTMLInputElement>(null)

  const selectedItem = document.system.items.find((item) => item.id === selectedItemId)
  const issues = useMemo(() => validateDocument(document, catalog), [document])
  const parts = useMemo(() => buildPartsList(document, catalog), [document])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(document))
        setSavedAt(new Date())
      } catch {
        setSavedAt(null)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [document])

  useEffect(() => {
    const loadSharedHash = () => {
      const shared = decodePlanHash(window.location.hash, catalog)
      if (shared.status === 'absent') return
      if (shared.status === 'invalid') {
        setNotice(shared.message)
        return
      }
      setHistory(createHistory(shared.document))
      setSelectedItemId(null)
      setSelectedSupportIndex(null)
      setNotice('Shared plan loaded.')
    }
    window.addEventListener('hashchange', loadSharedHash)
    return () => window.removeEventListener('hashchange', loadSharedHash)
  }, [])

  useEffect(() => {
    try {
      window.history.replaceState(
        window.history.state,
        '',
        buildPlanUrl(document, window.location.href),
      )
    } catch {
      setNotice('This plan is too large to store in a shareable link.')
    }
  }, [document])

  useEffect(() => {
    if (!shareFallbackUrl) return
    shareInputRef.current?.focus()
    shareInputRef.current?.select()
  }, [shareFallbackUrl])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(
    () => () => {
      if (arUrl) URL.revokeObjectURL(arUrl)
    },
    [arUrl],
  )

  useEffect(() => {
    if (!mobileConfigOpen || !mobileDialogRef.current) return
    mobileCloseRef.current?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !mobileDialogRef.current) return
      const focusable = [
        ...mobileDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select',
        ),
      ]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', trapFocus)
    return () => window.removeEventListener('keydown', trapFocus)
  }, [mobileConfigOpen])

  useEffect(() => {
    if (!arUrl || !arDialogRef.current) return
    arDialogRef.current.querySelector<HTMLElement>('button')?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !arDialogRef.current) return
      const focusable = [...arDialogRef.current.querySelectorAll<HTMLElement>('button, a[href]')]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', trapFocus)
    return () => window.removeEventListener('keydown', trapFocus)
  }, [arUrl])

  const updateItem = (candidate: PlacedItem) => {
    const original = document.system.items.find((item) => item.id === candidate.id)
    if (!original) return
    const proposal = proposeItemMove(document, catalog, candidate)
    if (!proposal) return
    candidate = proposal.candidate
    const spatialChanged =
      candidate.productId !== original.productId ||
      candidate.variantId !== original.variantId ||
      candidate.bayIndex !== original.bayIndex ||
      candidate.height !== original.height ||
      candidate.face !== original.face ||
      candidate.orientation !== original.orientation ||
      candidate.parentItemId !== original.parentItemId ||
      candidate.open !== original.open
    if (!spatialChanged) {
      setDocument({
        ...document,
        system: {
          ...document.system,
          items: document.system.items.map((item) => (item.id === candidate.id ? candidate : item)),
        },
      })
      return
    }
    if (!proposal.valid) {
      setNotice('That position is outside the system or overlaps another component.')
      return
    }
    setDocument(proposal.document)
  }

  const duplicateItemAt = (
    item: PlacedItem,
    bayIndex: number,
    height: number,
    face: 'front' | 'back',
  ) => {
    const proposal = proposeItemDuplicate(
      document,
      catalog,
      { ...item, bayIndex, height, face },
      (sourceId) => makeId(sourceId),
    )
    if (!proposal?.valid) {
      setNotice('There is no clear space for that copy.')
      return
    }
    setDocument(proposal.document)
    setSelectedItemId(proposal.candidate.id)
    setSelectedSupportIndex(null)
  }

  const moveConnectedSupports = (move: ConnectedSupportMove) => {
    const next = moveConnectedSupportRun(document, move)
    const heightDelta = next.system.mountHeight - document.system.mountHeight
    const outsideRoom =
      roomBoundaryOverflow(next, catalog) > roomBoundaryOverflow(document, catalog)
    if (
      outsideRoom ||
      (heightDelta !== 0 &&
        itemsHaveTrackHeightError(next, catalog, next.system.items) &&
        !itemsHaveTrackHeightError(document, catalog, document.system.items))
    ) {
      setNotice('The connected support run does not fit in that position.')
      return
    }
    setDocument(next)
  }

  const addItem = (productId: string, variantId: string) => {
    const product = catalog.find((entry) => entry.id === productId)
    const variant = product?.variants.find((entry) => entry.id === variantId)
    if (!product || !variant) return
    const accessory = isAccessory(product)
    if (
      accessory &&
      (!selectedItem || !product.compatibleHosts?.includes(selectedItem.productId))
    ) {
      setNotice(`Select a compatible component before adding ${product.name.toLowerCase()}.`)
      return
    }
    const activeFace =
      accessory && selectedItem ? selectedItem.face : (document.system.activeFace ?? 'front')
    const preferredBay = selectedItem?.bayIndex ?? 0
    const item = findAvailablePlacement(
      document,
      catalog,
      productId,
      variantId,
      activeFace,
      preferredBay,
      accessory ? selectedItem?.id : undefined,
      makeId('item'),
    )
    if (!item) {
      setNotice(
        accessory
          ? 'That accessory does not fit its selected host.'
          : productId === 'table'
            ? 'Clear a matching bay around the 740 mm tabletop, or choose the other table width.'
            : 'There is no compatible clear space for this component.',
      )
      return
    }
    setDocument({
      ...document,
      system: { ...document.system, items: [...document.system.items, item] },
    })
    setSelectedItemId(item.id)
    setCatalogOpen(false)
  }

  const duplicateSelected = () => {
    if (!selectedItem) return
    const variant = variantFor(selectedItem, catalog)
    duplicateItemAt(
      selectedItem,
      selectedItem.bayIndex,
      snapItemHeight(selectedItem.height + Math.max(variant?.height ?? 70, 70), document),
      selectedItem.face,
    )
  }

  const deleteSelected = () => {
    if (!selectedItem) return
    const deleteIds = itemTreeIds(document.system.items, selectedItem.id)
    setDocument({
      ...document,
      system: {
        ...document.system,
        items: document.system.items.filter((item) => !deleteIds.has(item.id)),
      },
    })
    setSelectedItemId(null)
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target
      const editing =
        target instanceof HTMLElement &&
        (target.matches('input, textarea, select') || target.isContentEditable)
      if (event.key === 'Escape') {
        if (dragStatus) {
          event.preventDefault()
          setCancelDragRevision((revision) => revision + 1)
          setDragStatus(null)
          setDragFaceOverride(null)
          return
        }
        if (catalogOpen || partsOpen || mobileConfigOpen || arUrl || shareFallbackUrl) {
          setCatalogOpen(false)
          setPartsOpen(false)
          setMobileConfigOpen(false)
          setArUrl(null)
          setShareFallbackUrl(null)
        } else if (!editing) {
          setSelectedItemId(null)
          setSelectedSupportIndex(null)
        }
        return
      }
      if (dragStatus) return
      if (editing) return

      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setHistory((current) => (event.shiftKey ? redoHistory(current) : undoHistory(current)))
        return
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        setHistory((current) => redoHistory(current))
        return
      }
      if (modifier && event.key.toLowerCase() === 'd' && selectedItemId) {
        event.preventDefault()
        duplicateSelected()
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItemId) {
        event.preventDefault()
        deleteSelected()
        return
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [
    arUrl,
    catalogOpen,
    dragStatus,
    mobileConfigOpen,
    partsOpen,
    selectedItemId,
    shareFallbackUrl,
    document,
  ])

  const exportPlan = () => {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = Object.assign(window.document.createElement('a'), {
      href: url,
      download: `${document.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`,
    })
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const copyShareLink = async () => {
    try {
      const url = buildPlanUrl(document, window.location.href)
      let copied = false

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url)
          copied = true
        }
      } catch {
        // Clipboard access commonly requires HTTPS. Try the older selection API below.
      }

      if (!copied) {
        const input = window.document.createElement('textarea')
        input.value = url
        input.readOnly = true
        input.style.position = 'fixed'
        input.style.left = '-9999px'
        window.document.body.append(input)
        input.select()
        try {
          copied = window.document.execCommand('copy')
        } catch {
          copied = false
        }
        input.remove()
      }

      if (copied) {
        setNotice('Share link copied.')
      } else {
        setShareFallbackUrl(url)
      }
    } catch {
      setNotice('This plan is too large to share as a link.')
    }
  }

  const importPlan = async (file?: File) => {
    if (!file) return
    try {
      const parsed = parseBuilderDocument(await file.text(), catalog)
      if (!parsed) throw new Error('Invalid document')
      setHistory(createHistory(migrateDocumentFinishes(parsed, catalog)))
      setSelectedItemId(null)
      setSelectedSupportIndex(null)
      setNotice('Plan imported.')
    } catch {
      setNotice('This file is not a valid 606 plan.')
    }
  }

  const launchAr = async () => {
    if (!exportUsdzRef.current) {
      setNotice('AR is still preparing. Try again in a moment.')
      return
    }
    try {
      setArLoading(true)
      const blob = await exportUsdzRef.current()
      if (arUrl) URL.revokeObjectURL(arUrl)
      setArUrl(URL.createObjectURL(blob))
    } catch {
      setNotice('The AR model could not be prepared.')
    } finally {
      setArLoading(false)
    }
  }

  const isIos =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const activeFace = document.system.activeFace ?? 'front'
  const faceCounts = {
    front: document.system.items.filter((item) => item.face === 'front').length,
    back: document.system.items.filter((item) => item.face === 'back').length,
  }
  const selectFace = (face: 'front' | 'back') => {
    if (face !== activeFace) setActiveFace(face)
    setViewMode((current) => (current === 'orbit' ? 'orbit' : face))
    if (selectedItem?.face !== face) setSelectedItemId(null)
    setCameraFitRevision((revision) => revision + 1)
  }
  const handleItemDragStatus = (status: ItemDragStatus | null) => {
    if (!status) {
      setDragStatus(null)
      setDragFaceOverride(null)
      return
    }
    const target = window.document.elementFromPoint(status.clientX, status.clientY)
    const face = target?.closest<HTMLElement>('[data-drop-face]')?.dataset.dropFace
    const override = face === 'front' || face === 'back' ? face : null
    setDragFaceOverride((current) => (current === override ? current : override))
    setDragStatus((current) =>
      current?.itemId === status.itemId &&
      current.face === status.face &&
      current.valid === status.valid &&
      current.duplicate === status.duplicate
        ? current
        : status,
    )
  }
  const dragDestination = dragFaceOverride ?? dragStatus?.face

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/brand/vitsoe.svg" alt="Vitsœ" />
          <span>Design Dieter Rams</span>
        </div>
        <div className="document-title">
          <input
            maxLength={200}
            value={document.name}
            aria-label="Plan name"
            onChange={(event) => setDocument({ ...document, name: event.currentTarget.value })}
          />
          <span>{savedAt ? 'Saved locally' : 'New plan'}</span>
        </div>
        <nav className="header-actions" aria-label="Plan actions">
          <button
            type="button"
            className="history-action"
            disabled={!history.past.length}
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
            onClick={() => setHistory((current) => undoHistory(current))}
          >
            ↶
          </button>
          <button
            type="button"
            className="history-action"
            disabled={!history.future.length}
            title="Redo (Shift+Ctrl/Cmd+Z)"
            aria-label="Redo"
            onClick={() => setHistory((current) => redoHistory(current))}
          >
            ↷
          </button>
          <button
            type="button"
            className="quiet-action import-action"
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </button>
          <button type="button" className="quiet-action export-action" onClick={exportPlan}>
            Export
          </button>
          <button type="button" className="share-action" onClick={copyShareLink}>
            Copy link
          </button>
          <button type="button" className="parts-action" onClick={() => setPartsOpen(true)}>
            Parts <span>{parts.reduce((sum, line) => sum + line.quantity, 0)}</span>
          </button>
          <button type="button" className="ar-action" disabled={arLoading} onClick={launchAr}>
            {arLoading ? 'Preparing…' : 'View in AR'}
          </button>
          <input
            ref={importInputRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => importPlan(event.currentTarget.files?.[0])}
          />
        </nav>
      </header>

      <div
        ref={mobileDialogRef}
        className={`mobile-config-layer ${mobileConfigOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Configuration"
        aria-hidden={!mobileConfigOpen}
      >
        <button
          className="mobile-config-scrim"
          type="button"
          aria-label="Close configuration"
          onClick={() => setMobileConfigOpen(false)}
        />
        <button
          ref={mobileCloseRef}
          className="mobile-config-close"
          type="button"
          aria-label="Close configuration"
          onClick={() => setMobileConfigOpen(false)}
        >
          ×
        </button>
        <ConfigurationPanel
          document={document}
          tab={tab}
          onTabChange={setTab}
          onChange={setDocument}
          selectedSupportIndex={selectedSupportIndex}
          onSelectSupport={(supportIndex) => {
            setSelectedSupportIndex(supportIndex)
            setSelectedItemId(null)
            setMobileConfigOpen(false)
          }}
        />
      </div>
      <div className="desktop-config">
        <ConfigurationPanel
          document={document}
          tab={tab}
          onTabChange={setTab}
          onChange={setDocument}
          selectedSupportIndex={selectedSupportIndex}
          onSelectSupport={(supportIndex) => {
            setSelectedSupportIndex(supportIndex)
            setSelectedItemId(null)
          }}
        />
      </div>

      <section className="stage" aria-label="Room view">
        <div className="stage-title">
          <p className="eyebrow">606 Universal Shelving System</p>
          <h1>Plan your system</h1>
        </div>
        <BuilderScene
          document={document}
          catalog={catalog}
          selectedItemId={selectedItemId}
          selectedSupportIndex={selectedSupportIndex}
          viewMode={viewMode}
          cameraFitRevision={cameraFitRevision}
          onSelectItem={(itemId) => {
            setSelectedItemId(itemId)
            if (!itemId) return
            setSelectedSupportIndex(null)
            const item = document.system.items.find((entry) => entry.id === itemId)
            if (item && item.face !== activeFace) {
              setActiveFace(item.face)
            }
          }}
          onSelectSupport={(supportIndex) => {
            setSelectedSupportIndex(supportIndex)
            if (supportIndex !== null) setSelectedItemId(null)
          }}
          onMoveItem={(itemId, bayIndex, height, face, duplicate) => {
            const item = document.system.items.find((entry) => entry.id === itemId)
            if (!item) return
            if (duplicate) duplicateItemAt(item, bayIndex, height, face)
            else updateItem({ ...item, bayIndex, height, face })
          }}
          onMoveConnectedSupports={moveConnectedSupports}
          dragFaceOverride={dragFaceOverride}
          cancelDragRevision={cancelDragRevision}
          onItemDragStatusChange={handleItemDragStatus}
          onExportUsdzReady={(exporter) => {
            exportUsdzRef.current = exporter
          }}
        />
        <div className="view-tools" aria-label="View options">
          <button
            type="button"
            aria-pressed={viewMode === 'orbit'}
            onClick={() => setViewMode('orbit')}
          >
            3D view
          </button>
          <button
            type="button"
            aria-pressed={viewMode !== 'orbit'}
            onClick={() => setViewMode(activeFace)}
          >
            Straight-on
          </button>
          <button
            type="button"
            aria-pressed={document.room.showDimensions}
            onClick={() =>
              setHistory((current) => ({
                ...current,
                present: {
                  ...current.present,
                  room: {
                    ...current.present.room,
                    showDimensions: !current.present.room.showDimensions,
                  },
                },
              }))
            }
          >
            Dimensions
          </button>
          <button type="button" onClick={() => setCameraFitRevision((revision) => revision + 1)}>
            Fit view
          </button>
        </div>
        <p className="camera-help">
          Drag empty space to orbit · Right-drag to pan · Scroll to zoom · Double-click a component
          to focus · Option-drag to copy
        </p>
        {allowedFaces(document).includes('back') && (
          <div className={`side-control ${dragStatus ? 'dragging' : ''}`} aria-label="Side to plan">
            <span aria-live="polite">
              {dragStatus
                ? dragStatus.valid || dragStatus.face !== dragDestination
                  ? `${dragStatus.duplicate ? 'Copy' : 'Move'} to ${dragDestination}`
                  : `Does not fit on ${dragDestination}`
                : 'Plan and add to'}
            </span>
            {(['front', 'back'] as const).map((face) => (
              <button
                type="button"
                className={[
                  activeFace === face ? 'active' : '',
                  dragStatus && dragDestination === face ? 'drop-target' : '',
                  dragStatus &&
                  dragStatus.face === face &&
                  dragDestination === face &&
                  !dragStatus.valid
                    ? 'invalid'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={activeFace === face}
                data-drop-face={face}
                key={face}
                onClick={() => {
                  if (!dragStatus) selectFace(face)
                }}
              >
                <strong>{face}</strong>
                <small>
                  {faceCounts[face]} component{faceCounts[face] === 1 ? '' : 's'}
                </small>
              </button>
            ))}
          </div>
        )}
        <button className="add-component" type="button" onClick={() => setCatalogOpen(true)}>
          <span>＋</span> Add to {activeFace}
        </button>
        {issues.some((issue) => issue.severity === 'error') && (
          <button className="error-pill" type="button" onClick={() => setPartsOpen(true)}>
            <span>!</span> {issues.filter((issue) => issue.severity === 'error').length} issue
            {issues.filter((issue) => issue.severity === 'error').length === 1 ? '' : 's'}
          </button>
        )}
        {selectedItem && (
          <Inspector
            document={document}
            catalog={catalog}
            item={selectedItem}
            onChange={updateItem}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onClose={() => setSelectedItemId(null)}
          />
        )}
        {selectedSupportIndex !== null && (
          <SupportInspector
            document={document}
            catalog={catalog}
            supportIndex={selectedSupportIndex}
            onChange={moveConnectedSupports}
            onClose={() => setSelectedSupportIndex(null)}
          />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Builder controls">
        <button
          type="button"
          disabled={!history.past.length}
          aria-label="Undo"
          onClick={() => setHistory((current) => undoHistory(current))}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="Configure room and system"
          onClick={() => setMobileConfigOpen(true)}
        >
          Config
        </button>
        <button
          type="button"
          className="primary"
          aria-label={`Add component to ${activeFace}`}
          onClick={() => setCatalogOpen(true)}
        >
          ＋ {activeFace}
        </button>
        <button type="button" onClick={() => setPartsOpen(true)}>
          Parts · {parts.reduce((sum, line) => sum + line.quantity, 0)}
        </button>
        <button type="button" onClick={copyShareLink}>
          Share
        </button>
        <button
          type="button"
          disabled={!history.future.length}
          aria-label="Redo"
          onClick={() => setHistory((current) => redoHistory(current))}
        >
          ↷
        </button>
      </nav>

      <CatalogDrawer
        open={catalogOpen}
        document={document}
        catalog={catalog}
        bayWidth={document.system.bays[selectedItem?.bayIndex ?? 0]?.centreWidth ?? 667}
        availableBayWidths={[...new Set(document.system.bays.map((bay) => bay.centreWidth))]}
        activeFace={document.system.activeFace ?? 'front'}
        selectedHostProductId={selectedItem?.productId}
        onClose={() => setCatalogOpen(false)}
        onAdd={addItem}
      />
      <PartsPanel
        open={partsOpen}
        lines={parts}
        issues={issues}
        onClose={() => setPartsOpen(false)}
      />
      {arUrl && (
        <div
          ref={arDialogRef}
          className="ar-ready"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ar-title"
        >
          <button
            className="ar-ready-scrim"
            type="button"
            aria-label="Close AR preview"
            onClick={() => setArUrl(null)}
          />
          <div className="ar-ready-card">
            <button
              className="ar-ready-close"
              type="button"
              aria-label="Close AR preview"
              onClick={() => setArUrl(null)}
            >
              ×
            </button>
            <p className="eyebrow">Augmented reality</p>
            <h2 id="ar-title">Your room, your system</h2>
            <p>
              {isIos
                ? document.system.mountingType === 'wall' ||
                  document.system.mountingType === 'semi-wall'
                  ? 'Point your device at a clear wall, place the system, then adjust its mounting height.'
                  : 'Scan a clear area of floor, then place the system at full scale.'
                : 'Open this planner on an iPhone or iPad to place the system in your room. You can download the AR model here.'}
            </p>
            <a
              className="ar-launch-link"
              rel="ar"
              href={isIos ? `${arUrl}#allowsContentScaling=0` : arUrl}
              download={isIos ? undefined : 'vitsoe-606-plan.usdz'}
            >
              <img alt="" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
              {isIos ? 'Open in AR' : 'Download USDZ'}
            </a>
          </div>
        </div>
      )}
      {shareFallbackUrl && (
        <div className="share-ready" role="dialog" aria-modal="true" aria-labelledby="share-title">
          <button
            className="share-ready-scrim"
            type="button"
            aria-label="Close share link"
            onClick={() => setShareFallbackUrl(null)}
          />
          <div className="share-ready-card">
            <button
              className="share-ready-close"
              type="button"
              aria-label="Close share link"
              onClick={() => setShareFallbackUrl(null)}
            >
              ×
            </button>
            <p className="eyebrow">Share this plan</p>
            <h2 id="share-title">Copy this link</h2>
            <p>Your browser blocked automatic copying. Select the link and copy it.</p>
            <input
              ref={shareInputRef}
              aria-label="Share link"
              readOnly
              value={shareFallbackUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              className="share-select"
              type="button"
              onClick={() => {
                shareInputRef.current?.focus()
                shareInputRef.current?.select()
              }}
            >
              Select link
            </button>
          </div>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </main>
  )
}
