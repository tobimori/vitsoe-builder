import * as stylex from '@stylexjs/stylex'
import { useRef } from 'react'
import { Menu, MenuItem, Popover } from 'react-aria-components'
import { editor, useEditor, usePlan } from '../../editor/editor'
import { selectedIds } from '../../editor/store'
import { menu } from '../../ui/menu'
import { sharedOtherFace } from '../inspector/SelectionInspector'

const styles = stylex.create({
  anchor: {
    position: 'fixed',
    width: 0,
    height: 0,
  },
})

const mac = /mac|iphone|ipad/i.test(navigator.platform)

/** What can be done with the selected components, from a right click on one in the view. */
export function ItemMenu() {
  const anchor = useRef<HTMLDivElement>(null)
  const plan = usePlan()
  const point = useEditor((context) => context.menu)
  const ids = selectedIds(useEditor((context) => context.selection))
  const items = plan.system.items.filter((entry) => ids.includes(entry.id))
  if (!point || items.length === 0) return null

  const turnTo = sharedOtherFace(plan, items)
  const entries = [
    ...(turnTo ? [{ id: 'turn', label: `Move to ${turnTo}` }] : []),
    { id: 'duplicate', label: 'Duplicate', shortcut: mac ? '⌘D' : 'Ctrl+D' },
    { id: 'remove', label: 'Remove', shortcut: mac ? '⌫' : 'Delete' },
  ]

  return (
    <>
      <div ref={anchor} style={{ left: point.x, top: point.y }} {...stylex.props(styles.anchor)} />
      <Popover
        triggerRef={anchor}
        isOpen
        onOpenChange={(open) => {
          if (!open) editor.trigger.closeMenu()
        }}
        placement="bottom start"
        offset={2}
        {...stylex.props(menu.popover)}
      >
        <Menu
          aria-label={items.length > 1 ? 'Components' : 'Component'}
          autoFocus="first"
          onAction={(action) => {
            editor.trigger.closeMenu()
            if (action === 'turn' && turnTo) {
              editor.trigger.moveItems({ items: items.map((item) => ({ ...item, face: turnTo })) })
            } else if (action === 'duplicate') editor.trigger.duplicateSelected()
            else if (action === 'remove') editor.trigger.deleteSelected()
          }}
          {...stylex.props(menu.list)}
        >
          {entries.map((entry) => (
            <MenuItem
              key={entry.id}
              id={entry.id}
              textValue={entry.label}
              className={({ isFocused }) =>
                stylex.props(
                  menu.item,
                  entry.id === 'remove' && menu.danger,
                  isFocused && menu.itemFocused,
                ).className ?? ''
              }
            >
              {entry.label}
              {entry.shortcut && <kbd {...stylex.props(menu.shortcut)}>{entry.shortcut}</kbd>}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </>
  )
}
