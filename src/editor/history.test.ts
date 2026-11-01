import { expect, it } from 'vite-plus/test'
import { commitHistory, createHistory, redoHistory, undoHistory } from './history'

it('clears redo after a new commit and retains only the configured past limit', () => {
  let history = createHistory(0)
  for (let value = 1; value <= 55; value += 1) history = commitHistory(history, value, 50)
  expect(history.past).toHaveLength(50)

  history = undoHistory(history)
  expect(history.present).toBe(54)
  expect(history.future).toEqual([55])

  history = commitHistory(history, 99)
  expect(history.future).toEqual([])
  expect(redoHistory(history).present).toBe(99)
})
