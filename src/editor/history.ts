export interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

export function createHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] }
}

export function commitHistory<T>(state: HistoryState<T>, next: T, limit = 50): HistoryState<T> {
  if (next === state.present) return state
  return {
    past: [...state.past, state.present].slice(-limit),
    present: next,
    future: [],
  }
}

export function undoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  const previous = state.past.at(-1)
  if (previous === undefined) return state
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  }
}

export function redoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  const next = state.future[0]
  if (next === undefined) return state
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  }
}
