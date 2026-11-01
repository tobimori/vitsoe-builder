import { createAtom, createStore } from '@xstate/store'
import * as v from 'valibot'
import { catalog } from '../domain/catalog/catalog'
import {
  itemTreeIds,
  placeComponent,
  proposeItemDuplicate,
  proposeItemMove,
} from '../domain/placement/proposals'
import { snapPinHeight } from '../domain/placement/grid'
import { initialPlan } from '../domain/plan/defaults'
import { changeMountingType } from '../domain/plan/system'
import type { Plan, PlanItem } from '../domain/plan/types'
import { buildPartsList } from '../domain/pricing/parts'
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

export type View = 'orbit' | Face

export type Overlay = 'catalog' | 'parts' | 'configuration' | null

export interface RenderStatus {
  phase: 'idle' | 'loading' | 'rendering' | 'complete' | 'error'
  /** Completed fraction from 0 to 1 when the renderer can measure it. */
  progress?: number
  message?: string
}

export interface DragStatus {
  itemId: string
  /** The face the component would land on. */
  face: Face
  valid: boolean
  duplicate: boolean
}

export interface EditorContext {
  history: HistoryState<Plan>
  selection: Selection
  /** The face that new components are added to. */
  activeFace: Face
  view: View
  showDimensions: boolean
  rendering: boolean
  renderStatus: RenderStatus | null
  drag: DragStatus | null
  overlay: Overlay
  configurationTab: 'system' | 'room'
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
    showDimensions: true,
    rendering: false,
    renderStatus: null,
    drag: null,
    overlay: null,
    configurationTab: 'system',
    notice,
    saved: false,
  }

  const commit = (state: EditorContext, next: Plan): EditorContext => ({
    ...state,
    history: commitHistory(state.history, next),
  })

  const notify = (state: EditorContext, notice: string): EditorContext => ({ ...state, notice })

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
      moved.open !== original.open ||
      moved.decor !== original.decor

    if (spatialChange && !proposal.valid) {
      const decorIssue = validatePlan(proposal.plan, catalog).find(
        (issue) =>
          (issue.code === 'decor-fit' || issue.code === 'decor-clearance') &&
          issue.itemIds?.includes(moved.id),
      )
      return notify(
        state,
        decorIssue?.message ?? 'That position is outside the system or overlaps another component.',
      )
    }

    return {
      ...commit(state, proposal.plan),
      activeFace: moved.face !== original.face ? moved.face : state.activeFace,
    }
  }

  function duplicateItem(state: EditorContext, candidate: PlanItem): EditorContext {
    const proposal = proposeItemDuplicate(state.history.present, catalog, candidate, makeId)
    if (!proposal?.valid) return notify(state, 'There is no clear space for that copy.')

    return {
      ...commit(state, proposal.plan),
      activeFace: proposal.candidate.face,
      selection: { type: 'item', id: proposal.candidate.id },
    }
  }

  return createStore({
    context,
    schemas: {
      emitted: {
        fitCamera: v.object({}),
        cancelDrag: v.object({}),
      },
    },
    on: {
      edit: (state, { plan }: { plan: Plan }) => commit(state, plan),

      load: (state, { plan, notice }: { plan: Plan; notice: string }) => ({
        ...state,
        history: createHistory(plan),
        selection: null,
        notice,
      }),

      undo: (state) => ({ ...state, history: undoHistory(state.history) }),
      redo: (state) => ({ ...state, history: redoHistory(state.history) }),

      changeMountingType: (state, { mountingType }: { mountingType: MountingType }) => ({
        ...commit(state, changeMountingType(state.history.present, mountingType)),
        activeFace: 'front',
      }),

      updateItem: (state, { item }: { item: PlanItem }) => moveItem(state, item),

      dropItem: (
        state,
        drop: { id: string; bayIndex: number; height: number; face: Face; duplicate: boolean },
      ) => {
        const item = state.history.present.system.items.find((entry) => entry.id === drop.id)
        if (!item) return state

        const candidate = { ...item, bayIndex: drop.bayIndex, height: drop.height, face: drop.face }
        return drop.duplicate ? duplicateItem(state, candidate) : moveItem(state, candidate)
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

        return {
          ...commit(state, {
            ...plan,
            system: { ...plan.system, items: [...plan.system.items, result.item] },
          }),
          selection: { type: 'item', id: result.item.id },
          overlay: null,
        }
      },

      moveSupports: (state, { move }: { move: SupportRunMove }) => {
        const proposal = proposeSupportRunMove(state.history.present, catalog, move)
        return proposal.valid
          ? commit(state, proposal.plan)
          : notify(state, 'The connected support run does not fit in that position.')
      },

      selectItem: (state, { id }: { id: string }) => {
        const item = state.history.present.system.items.find((entry) => entry.id === id)
        return {
          ...state,
          selection: { type: 'item', id },
          activeFace: item?.face ?? state.activeFace,
        }
      },

      selectSupport: (state, { index }: { index: number }) => ({
        ...state,
        selection: { type: 'support', index },
        overlay: state.overlay === 'configuration' ? null : state.overlay,
      }),

      clearSelection: (state) => ({ ...state, selection: null }),

      selectFace: (state, { face }: { face: Face }, enqueue) => {
        enqueue.emit.fitCamera({})
        const item = selectedItem(state)
        return {
          ...state,
          activeFace: face,
          view: state.view === 'orbit' ? 'orbit' : face,
          selection:
            state.selection?.type === 'item' && item?.face !== face ? null : state.selection,
        }
      },

      setView: (state, { view }: { view: View }, enqueue) => {
        if (view !== state.view) enqueue.emit.fitCamera({})
        return { ...state, view }
      },

      fitCamera: (state, _event, enqueue) => {
        enqueue.emit.fitCamera({})
        return state
      },

      toggleDimensions: (state) => ({ ...state, showDimensions: !state.showDimensions }),

      toggleRendering: (state) => ({
        ...state,
        rendering: !state.rendering,
        renderStatus: null,
      }),

      renderStatusChanged: (state, { status }: { status: RenderStatus | null }) => ({
        ...state,
        renderStatus: status,
      }),

      dragChanged: (state, { drag }: { drag: DragStatus | null }) => ({ ...state, drag }),

      open: (state, { overlay }: { overlay: Overlay }) => ({ ...state, overlay }),

      setConfigurationTab: (state, { tab }: { tab: 'system' | 'room' }) => ({
        ...state,
        configurationTab: tab,
      }),

      notify: (state, { notice }: { notice: string | null }) => ({ ...state, notice }),

      saved: (state, { saved }: { saved: boolean }) => ({ ...state, saved }),

      escape: (state, { editing }: { editing: boolean }, enqueue) => {
        if (state.drag) {
          enqueue.emit.cancelDrag({})
          return { ...state, drag: null }
        }
        if (state.rendering) return { ...state, rendering: false }
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
