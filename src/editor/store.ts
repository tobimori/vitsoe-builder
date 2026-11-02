import { createAtom, createStore } from '@xstate/store'
import * as v from 'valibot'
import { catalog } from '../domain/catalog/catalog'
import { sizedForBay } from '../domain/catalog/options'
import {
  canPlaceItem,
  itemTreeIds,
  placeComponent,
  proposeItemDuplicate,
  proposeItemMove,
} from '../domain/placement/proposals'
import { BOOKEND_STEP, bookendPosition, slidesOnHost } from '../domain/placement/bookends'
import { snapPinHeight } from '../domain/placement/grid'
import { initialPlan } from '../domain/plan/defaults'
import { allowedFaces, changeMountingType } from '../domain/plan/system'
import type { Plan, PlanItem, Wall } from '../domain/plan/types'
import { placeOnWall } from '../domain/plan/walls'
import { buildPartsList } from '../domain/pricing/parts'
import { fitPlacement } from '../domain/supports/footprint'
import { proposeSupportRunMove, type SupportRunMove } from '../domain/supports/run'
import { deriveSupportTrackPlans } from '../domain/supports/tracks'
import type { Face, MountingType } from '../domain/types'
import { validatePlan } from '../domain/validation/validate'
import {
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from './history'

export type Selection = { type: 'item'; id: string } | { type: 'support'; index: number } | null

/**
 * A free 3D view, a straight elevation of the active face, or a fixed line drawing
 * of the active face like Vitsœ's system illustrations.
 */
export type View = 'orbit' | 'elevation' | 'drawing'

/** The left panel has the layers and the catalogue; the right one, details and parts. */
export type Tab = 'layers' | 'components' | 'details' | 'parts'

const leftTabs: readonly Tab[] = ['layers', 'components']

export interface DragStatus {
  itemId: string
  /** The face the component would land on. */
  face: Face
  valid: boolean
  duplicate: boolean
}

/** A catalogue component being placed into the view, sized by the bay it goes into. */
export interface Placing {
  productId: string
  /** The product option, see `productOptions`. */
  option: string
  /** Dragged from the catalogue: it lands where the drag ends, once. */
  fromCatalogue?: boolean
}

export interface EditorContext {
  history: HistoryState<Plan>
  selection: Selection
  /** The face the camera looks at; new components are added to it. */
  activeFace: Face
  view: View
  showDimensions: boolean
  drag: DragStatus | null
  placing: Placing | null
  leftTab: Tab
  rightTab: Tab
  /** The tab chosen last; a phone shows one panel at a time. */
  tab: Tab
  notice: string | null
  saved: boolean
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function createEditor(plan: Plan = initialPlan, notice: string | null = null) {
  const context: EditorContext = {
    history: createHistory(plan),
    selection: null,
    activeFace: 'front',
    view: 'orbit',
    showDimensions: false,
    drag: null,
    placing: null,
    leftTab: 'layers',
    rightTab: 'details',
    tab: 'details',
    notice,
    saved: false,
  }

  const commit = (state: EditorContext, next: Plan): EditorContext => ({
    ...state,
    history: commitHistory(state.history, next),
  })

  const notify = (state: EditorContext, notice: string): EditorContext => ({ ...state, notice })

  const withTab = (state: EditorContext, tab: Tab): EditorContext => ({
    ...state,
    ...(leftTabs.includes(tab) ? { leftTab: tab } : { rightTab: tab }),
    tab,
  })

  const selectedItem = ({ selection, history }: EditorContext) => {
    if (selection?.type !== 'item') return undefined
    return history.present.system.items.find((item) => item.id === selection.id)
  }

  function moveItem(state: EditorContext, candidate: PlanItem): EditorContext {
    const plan = state.history.present
    const original = plan.system.items.find((item) => item.id === candidate.id)
    const proposal = original && proposeItemMove(plan, catalog, candidate)
    if (!original || !proposal) return state

    const moved = proposal.candidate
    const spatialChange =
      moved.productId !== original.productId ||
      moved.variantId !== original.variantId ||
      moved.bayIndex !== original.bayIndex ||
      moved.height !== original.height ||
      moved.face !== original.face ||
      moved.orientation !== original.orientation ||
      moved.parentItemId !== original.parentItemId ||
      moved.offset !== original.offset ||
      moved.open !== original.open

    if (spatialChange && !proposal.valid) {
      return notify(state, 'That position is outside the system or overlaps another component.')
    }

    return {
      ...commit(state, proposal.plan),
      activeFace: moved.face !== original.face ? moved.face : state.activeFace,
    }
  }

  function duplicateItem(state: EditorContext, candidate: PlanItem): EditorContext {
    const proposal = proposeItemDuplicate(state.history.present, catalog, candidate, makeId)
    if (!proposal?.valid) return notify(state, 'There is no clear space for that copy.')

    const original = state.history.present.system.items.find((item) => item.id === candidate.id)
    return {
      ...commit(state, proposal.plan),
      activeFace:
        proposal.candidate.face !== original?.face ? proposal.candidate.face : state.activeFace,
      selection: { type: 'item', id: proposal.candidate.id },
    }
  }

  return createStore({
    context,
    schemas: {
      emitted: {
        /** Frames the whole system from the active face. */
        fitCamera: v.object({}),
        /** Turns the camera to the active face, keeping its distance. */
        turnCamera: v.object({}),
        cancelDrag: v.object({}),
        zoomTo: v.object({ itemId: v.string() }),
      },
    },
    on: {
      edit: (state, { plan }: { plan: Plan }) => commit(state, plan),

      load: (state, { plan, notice }: { plan: Plan; notice: string }, enqueue) => {
        enqueue.emit.fitCamera({})
        return {
          ...state,
          history: createHistory(plan),
          selection: null,
          placing: null,
          activeFace: 'front',
          notice,
        }
      },

      /** Shows a plan while it is dragged, without a step in the history. */
      previewPlan: (state, { plan }: { plan: Plan }) => ({
        ...state,
        history: { ...state.history, present: plan },
      }),

      /** Ends a preview as one step from the plan before it. */
      commitPreview: (state, { from }: { from: Plan }) => ({
        ...state,
        history: commitHistory({ ...state.history, present: from }, state.history.present),
      }),

      undo: (state) => ({ ...state, history: undoHistory(state.history) }),
      redo: (state) => ({ ...state, history: redoHistory(state.history) }),

      changeMountingType: (state, { mountingType }: { mountingType: MountingType }, enqueue) => {
        enqueue.emit.fitCamera({})
        const plan = changeMountingType(state.history.present, mountingType)
        return {
          ...commit(state, plan),
          activeFace: allowedFaces(plan).includes(state.activeFace) ? state.activeFace : 'front',
        }
      },

      /** Stands the system along another wall, centred on it. */
      moveToWall: (state, { wall }: { wall: Wall }, enqueue) => {
        const plan = state.history.present
        if (wall === plan.system.placement.wall) return state
        enqueue.emit.fitCamera({})
        return commit(state, fitPlacement(placeOnWall(plan, wall), catalog))
      },

      updateItem: (state, { item }: { item: PlanItem }, enqueue) => {
        const next = moveItem(state, item)
        if (next.activeFace !== state.activeFace) enqueue.emit.turnCamera({})
        return next
      },

      /** Ends a drag: moves the component to the item's position, or copies it there. */
      dropItem: (state, { item, duplicate }: { item: PlanItem; duplicate: boolean }, enqueue) => {
        const next = duplicate ? duplicateItem(state, item) : moveItem(state, item)
        if (next.activeFace !== state.activeFace) enqueue.emit.turnCamera({})
        return next
      },

      nudgeSelected: (state, { bays, pitches }: { bays: number; pitches: number }) => {
        const item = selectedItem(state)
        if (!item) return state

        const plan = state.history.present
        // Accessories keep their place in their host, except bookends, which slide along it
        if (item.parentItemId) {
          const bookend =
            slidesOnHost(item.productId) && bookendPosition(plan.system.items, catalog, item)
          if (!bookend || bays === 0) return state
          const offset = Math.min(
            bookend.limit,
            Math.max(-bookend.limit, bookend.offset + bays * BOOKEND_STEP),
          )
          return offset === bookend.offset ? state : moveItem(state, { ...item, offset })
        }
        const bayIndex = Math.min(plan.system.bays.length - 1, Math.max(0, item.bayIndex + bays))
        if (bayIndex === item.bayIndex && pitches === 0) return state
        return moveItem(
          state,
          sizedForBay(
            { ...item, bayIndex, height: item.height + pitches * 70 },
            plan.system.bays,
            catalog,
          ),
        )
      },

      duplicateSelected: (state) => {
        const item = selectedItem(state)
        if (!item) return state

        const variant = catalog.variant(item.productId, item.variantId)
        const height = snapPinHeight(
          item.height + Math.max(variant?.height ?? 70, 70),
          state.history.present,
        )
        return duplicateItem(state, { ...item, height })
      },

      deleteSelected: (state) => {
        const item = selectedItem(state)
        if (!item) return state

        const plan = state.history.present
        const removed = itemTreeIds(plan.system.items, item.id)
        return {
          ...commit(state, {
            ...plan,
            system: {
              ...plan.system,
              items: plan.system.items.filter((entry) => !removed.has(entry.id)),
            },
          }),
          selection: null,
        }
      },

      addComponent: (state, { productId, variantId }: { productId: string; variantId: string }) => {
        const plan = state.history.present
        const host = selectedItem(state)
        const result = placeComponent(plan, catalog, {
          id: makeId('item'),
          productId,
          variantId,
          face: state.activeFace,
          preferredBayIndex: host?.bayIndex ?? 0,
          host,
        })
        if (!result.ok) return notify(state, result.message)

        const next = commit(state, {
          ...plan,
          system: { ...plan.system, items: [...plan.system.items, result.item] },
        })
        // Accessories keep their host selected, so several can be added in turn
        return result.item.parentItemId
          ? next
          : { ...next, selection: { type: 'item', id: result.item.id } }
      },

      moveSupports: (state, { move }: { move: SupportRunMove }) => {
        const proposal = proposeSupportRunMove(state.history.present, catalog, move)
        return proposal.valid
          ? commit(state, proposal.plan)
          : notify(state, 'The connected support run does not fit in that position.')
      },

      selectItem: (state, { id }: { id: string }) => ({
        ...withTab(state, 'details'),
        selection: { type: 'item', id },
        placing: null,
      }),

      selectSupport: (state, { index }: { index: number }) => ({
        ...withTab(state, 'details'),
        selection: { type: 'support', index },
      }),

      clearSelection: (state) => ({ ...state, selection: null }),

      /** Zooms the camera to a component, as a double-click on it does. */
      zoomTo: (state, { itemId }: { itemId: string }, enqueue) => {
        enqueue.emit.zoomTo({ itemId })
        return state
      },

      selectFace: (state, { face }: { face: Face }, enqueue) => {
        if (face === state.activeFace) return state
        enqueue.emit.turnCamera({})
        return { ...state, activeFace: face }
      },

      /** The camera has moved round to the other face. */
      faceInView: (state, { face }: { face: Face }) =>
        face === state.activeFace ? state : { ...state, activeFace: face },

      setView: (state, { view }: { view: View }, enqueue) => {
        if (view !== state.view) enqueue.emit.fitCamera({})
        return { ...state, view }
      },

      fitCamera: (state, _event, enqueue) => {
        enqueue.emit.fitCamera({})
        return state
      },

      toggleDimensions: (state) => ({ ...state, showDimensions: !state.showDimensions }),

      dragChanged: (state, { drag }: { drag: DragStatus | null }) => ({ ...state, drag }),

      showTab: (state, { tab }: { tab: Tab }) => ({
        ...withTab(state, tab),
        placing: tab === 'components' ? state.placing : null,
      }),

      startPlacing: (state, { placing }: { placing: Placing }) => ({
        ...withTab(state, 'components'),
        placing,
        selection: null,
      }),

      stopPlacing: (state) => ({ ...state, placing: null }),

      /** Adds a placed component and keeps placing, so several can go in one after another. */
      placeItem: (state, { item }: { item: Omit<PlanItem, 'id'> }) => {
        const plan = state.history.present
        const candidate = { ...item, id: makeId('item') }
        if (!canPlaceItem(plan, catalog, candidate)) return notify(state, 'It does not fit here.')
        return commit(state, {
          ...plan,
          system: { ...plan.system, items: [...plan.system.items, candidate] },
        })
      },

      notify: (state, { notice }: { notice: string | null }) => ({ ...state, notice }),

      saved: (state, { saved }: { saved: boolean }) => ({ ...state, saved }),

      escape: (state, { editing }: { editing: boolean }, enqueue) => {
        if (state.drag) {
          enqueue.emit.cancelDrag({})
          return { ...state, drag: null }
        }
        if (state.placing) return { ...state, placing: null }
        return editing ? state : { ...state, selection: null }
      },
    },
  })
}

export type Editor = ReturnType<typeof createEditor>

export function createEditorSelectors(editor: Editor) {
  const plan = createAtom(() => editor.get().context.history.present)

  return {
    plan,
    issues: createAtom(() => validatePlan(plan.get(), catalog)),
    parts: createAtom(() => buildPartsList(plan.get(), catalog)),
    tracks: createAtom(() => deriveSupportTrackPlans(plan.get(), catalog)),
  }
}
