import { editor } from './editor'

const nudges: Record<string, { bays: number; pitches: number }> = {
  ArrowUp: { bays: 0, pitches: 1 },
  ArrowDown: { bays: 0, pitches: -1 },
  ArrowLeft: { bays: -1, pitches: 0 },
  ArrowRight: { bays: 1, pitches: 0 },
}

export function bindShortcuts() {
  window.addEventListener('keydown', (event) => {
    const target = event.target
    const editing =
      target instanceof HTMLElement &&
      (target.matches('input, textarea, select') || target.isContentEditable)
    const { drag, selection } = editor.getSnapshot().context

    if (event.key === 'Escape') {
      if (drag) event.preventDefault()
      editor.trigger.escape({ editing })
      return
    }
    if (drag || editing || event.defaultPrevented) return

    const key = event.key.toLowerCase()
    const modifier = event.metaKey || event.ctrlKey
    const itemSelected = selection?.type === 'item'
    const itemsSelected = itemSelected || selection?.type === 'items'
    // Arrow keys belong to focused controls such as tabs and segmented buttons
    const onStage = target === document.body || target instanceof HTMLCanvasElement
    const nudge = nudges[event.key]

    if (modifier && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) editor.trigger.redo()
      else editor.trigger.undo()
    } else if (event.ctrlKey && key === 'y') {
      event.preventDefault()
      editor.trigger.redo()
    } else if (modifier && key === 'a') {
      event.preventDefault()
      editor.trigger.selectAll()
    } else if (modifier && key === 'c' && itemsSelected) {
      event.preventDefault()
      editor.trigger.copySelected()
    } else if (modifier && key === 'x' && itemsSelected) {
      event.preventDefault()
      editor.trigger.cutSelected()
    } else if (modifier && key === 'v') {
      event.preventDefault()
      editor.trigger.paste()
    } else if (modifier && key === 'd' && itemsSelected) {
      event.preventDefault()
      editor.trigger.duplicateSelected()
    } else if ((key === 'delete' || key === 'backspace') && itemsSelected) {
      event.preventDefault()
      editor.trigger.deleteSelected()
    } else if (nudge && itemSelected && onStage && !modifier) {
      event.preventDefault()
      editor.trigger.nudgeSelected(nudge)
    }
  })
}
