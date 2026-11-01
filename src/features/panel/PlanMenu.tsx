import * as stylex from '@stylexjs/stylex'
import { useRef } from 'react'
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { catalog } from '../../domain/catalog/catalog'
import { parsePlan } from '../../domain/plan/codec'
import { editor, selectors } from '../../editor/editor'
import { Hint } from '../../ui/buttons'
import { Icon } from '../../ui/icons'
import { colors, media } from '../../ui/tokens.stylex'

const styles = stylex.create({
  trigger: {
    display: 'grid',
    flex: 'none',
    placeItems: 'center',
    width: {
      default: 28,
      [media.touch]: 40,
    },
    height: {
      default: 28,
      [media.touch]: 40,
    },
    padding: 0,
    borderWidth: 0,
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.band,
    },
    color: colors.muted,
    cursor: 'pointer',
    outline: 'none',
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: 1,
  },
  popover: {
    minWidth: 180,
    padding: '4px 0',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    outline: 'none',
  },
  menu: {
    outline: 'none',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    height: 36,
    padding: '0 12px',
    fontSize: 14,
    cursor: 'default',
    outline: 'none',
  },
  itemFocused: {
    backgroundColor: colors.band,
  },
  file: {
    display: 'none',
  },
})

async function importPlan(file: File | undefined) {
  if (!file) return

  const plan = parsePlan(await file.text(), catalog)
  if (plan) editor.trigger.load({ plan, notice: 'Plan imported.' })
  else editor.trigger.notify({ notice: 'This file is not a valid 606 plan.' })
}

function exportPlan() {
  const plan = selectors.plan.get()
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }),
  )
  const anchor = Object.assign(document.createElement('a'), {
    href: url,
    download: `${plan.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`,
  })
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Opens a plan from a file, or saves this one as a file. */
export function PlanMenu() {
  const file = useRef<HTMLInputElement>(null)

  return (
    <>
      <MenuTrigger>
        <Hint label="Plan file">
          <Button
            aria-label="Plan file"
            className={({ isFocusVisible }) =>
              stylex.props(styles.trigger, isFocusVisible && styles.focused).className ?? ''
            }
          >
            <Icon name="chevronDown" size={12} />
          </Button>
        </Hint>
        <Popover placement="bottom start" offset={4} {...stylex.props(styles.popover)}>
          <Menu
            aria-label="Plan file"
            onAction={(action) => {
              if (action === 'import') file.current?.click()
              else exportPlan()
            }}
            {...stylex.props(styles.menu)}
          >
            {[
              { id: 'import', label: 'Import plan…' },
              { id: 'export', label: 'Export plan' },
            ].map((entry) => (
              <MenuItem
                key={entry.id}
                id={entry.id}
                className={({ isFocused }) =>
                  stylex.props(styles.item, isFocused && styles.itemFocused).className ?? ''
                }
              >
                {entry.label}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          void importPlan(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
        {...stylex.props(styles.file)}
      />
    </>
  )
}
