import { editor } from './editor'

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
    if (drag || editing) return

    const key = event.key.toLowerCase()
    const modifier = event.metaKey || event.ctrlKey
    const itemSelected = selection?.type === 'item'

    if (modifier && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) editor.trigger.redo()
      else editor.trigger.undo()
    } else if (event.ctrlKey && key === 'y') {
      event.preventDefault()
      editor.trigger.redo()
    } else if (modifier && key === 'd' && itemSelected) {
      event.preventDefault()
      editor.trigger.duplicateSelected()
    } else if ((key === 'delete' || key === 'backspace') && itemSelected) {
      event.preventDefault()
      editor.trigger.deleteSelected()
    }
  })
}
