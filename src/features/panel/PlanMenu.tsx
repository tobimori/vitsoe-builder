import * as stylex from '@stylexjs/stylex'
import { useRef, useState, type ReactNode } from 'react'
import { Button, Menu, MenuItem, MenuTrigger, Popover, Separator } from 'react-aria-components'
import { catalog } from '../../domain/catalog/catalog'
import { parsePlan } from '../../domain/plan/codec'
import { editor, selectors, usePlan } from '../../editor/editor'
import { deletePlan, newPlan } from '../../editor/sync'
import { ActionButton, Hint } from '../../ui/buttons'
import { Icon } from '../../ui/icons'
import { menu } from '../../ui/menu'
import { CardDialog } from '../../ui/overlays'
import { text } from '../../ui/text'
import { libraryOpen } from '../library/LibraryDialog'
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
  file: {
    display: 'none',
  },
  actions: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    marginTop: 20,
  },
})

function Entry({
  id,
  children,
  danger = false,
}: {
  id: string
  children: ReactNode
  danger?: boolean
}) {
  return (
    <MenuItem
      id={id}
      className={({ isFocused, isDisabled }) =>
        stylex.props(menu.item, isFocused && !isDisabled && menu.itemFocused, danger && menu.danger)
          .className ?? ''
      }
    >
      {children}
    </MenuItem>
  )
}

async function importPlan(file: File | undefined) {
  if (!file) return

  const plan = parsePlan(await file.text(), catalog)
  if (plan) newPlan(plan, `${plan.name} imported.`)
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

/** Starts and deletes plans, opens the library, and moves plans in and out as files. */
export function PlanMenu() {
  const file = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState(false)
  const { name } = usePlan()

  return (
    <>
      <MenuTrigger>
        <Hint label="Plans">
          <Button
            aria-label="Plans"
            className={({ isFocusVisible }) =>
              stylex.props(styles.trigger, isFocusVisible && styles.focused).className ?? ''
            }
          >
            <Icon name="chevronDown" size={12} />
          </Button>
        </Hint>
        <Popover placement="bottom start" offset={4} {...stylex.props(menu.popover)}>
          <Menu
            aria-label="Plans"
            onAction={(action) => {
              if (action === 'new') newPlan()
              else if (action === 'library') libraryOpen.set(true)
              else if (action === 'import') file.current?.click()
              else if (action === 'export') exportPlan()
              else if (action === 'delete') setDeleting(true)
            }}
            {...stylex.props(menu.list)}
          >
            <Entry id="new">New plan</Entry>
            <Entry id="library">Library…</Entry>
            <Separator {...stylex.props(menu.separator)} />
            <Entry id="import">Import plan…</Entry>
            <Entry id="export">Export plan</Entry>
            <Separator {...stylex.props(menu.separator)} />
            <Entry id="delete" danger>
              Delete plan…
            </Entry>
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
      <CardDialog
        labelledBy="delete-plan-title"
        closeLabel="Cancel"
        isOpen={deleting}
        onClose={() => setDeleting(false)}
      >
        <h2 id="delete-plan-title" {...stylex.props(text.title)}>
          Delete this plan?
        </h2>
        <p {...stylex.props(text.hint)}>
          {name} is removed from this browser. Links you shared still open it.
        </p>
        <div {...stylex.props(styles.actions)}>
          <ActionButton
            variant="primary"
            autoFocus
            onPress={() => {
              setDeleting(false)
              deletePlan()
            }}
          >
            Delete plan
          </ActionButton>
          <ActionButton variant="link" onPress={() => setDeleting(false)}>
            Cancel
          </ActionButton>
        </div>
      </CardDialog>
    </>
  )
}
