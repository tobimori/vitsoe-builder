import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { Button, Input, TextField } from 'react-aria-components'
import type { ReactNode } from 'react'
import { partsTotal } from '../../domain/pricing/parts'
import { editor, editPlan, selectors, useEditor, usePlan } from '../../editor/editor'
import type { Tab } from '../../editor/store'
import { ActionButton, IconButton } from '../../ui/buttons'
import { formatPrice, plural } from '../../ui/format'
import { Icon } from '../../ui/icons'
import { Tabs } from '../../ui/tabs'
import { text } from '../../ui/text'
import { colors, media, weights } from '../../ui/tokens.stylex'
import { ArButton } from '../ar/ArButton'
import { ComponentsTab } from '../components/ComponentsTab'
import { DetailsPanel } from '../details/DetailsPanel'
import { LayersPanel } from '../layers/LayersPanel'
import { PartsList } from '../parts/PartsList'
import { ShareButton } from '../share/ShareButton'
import { PlanMenu } from './PlanMenu'

/** Both panel headers share a height, so the tab rows line up across the view. */
const HEADER_HEIGHT = 132

const styles = stylex.create({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  left: {
    gridArea: 'left',
    borderRightWidth: 1,
  },
  right: {
    gridArea: 'right',
    borderLeftWidth: 1,
  },
  phone: {
    gridArea: 'panel',
    borderTopWidth: {
      default: 0,
      [media.stacked]: 1,
    },
    borderLeftWidth: {
      default: 1,
      [media.stacked]: 0,
    },
  },
  planName: {
    padding: '16px 20px 20px',
  },
  header: {
    display: 'flex',
    flex: 'none',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: HEADER_HEIGHT,
    padding: '20px 20px 16px',
  },
  brand: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  mark: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  logo: {
    display: 'block',
    width: {
      default: 96,
      [media.stacked]: 80,
    },
    height: 'auto',
  },
  /** Set like the "Design Dieter Rams" line beside Vitsœ's logo. */
  product: {
    marginTop: -2,
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: weights.bold,
    whiteSpace: 'nowrap',
  },
  history: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  nameField: {
    flex: 1,
    minWidth: 0,
  },
  nameInput: {
    width: '100%',
    height: 32,
    padding: '0 6px',
    marginLeft: -6,
    borderWidth: 0,
    outline: 'none',
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.band,
      ':focus': colors.band,
    },
    fontSize: {
      default: 15,
      [media.touch]: 16,
    },
    fontWeight: weights.bold,
    textOverflow: 'ellipsis',
  },
  status: {
    display: 'block',
    marginTop: -4,
  },
  total: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  price: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.ink,
    fontSize: 22,
    lineHeight: '28px',
    fontWeight: weights.bold,
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
    outline: 'none',
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: 2,
  },
  problems: {
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  grow: {
    flex: 1,
  },
  band: {
    flex: 'none',
    padding: '0 20px',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    paddingBottom: 24,
  },
  phoneHeader: {
    gridArea: 'header',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '0 12px 0 16px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  phoneActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  phoneTotal: {
    gridArea: 'stage',
    zIndex: 6,
    alignSelf: 'start',
    justifySelf: 'start',
    margin: 10,
    padding: '6px 10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 14,
    fontWeight: weights.bold,
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
    outline: 'none',
  },
})

function HistoryButtons() {
  const canUndo = useEditor((context) => context.history.past.length > 0)
  const canRedo = useEditor((context) => context.history.future.length > 0)

  return (
    <div {...stylex.props(styles.history)}>
      <IconButton
        variant="round"
        label="Undo"
        aria-keyshortcuts="Control+Z Meta+Z"
        isDisabled={!canUndo}
        onPress={() => editor.trigger.undo()}
      >
        <Icon name="undo" />
      </IconButton>
      <IconButton
        variant="round"
        label="Redo"
        aria-keyshortcuts="Shift+Control+Z Shift+Meta+Z"
        isDisabled={!canRedo}
        onPress={() => editor.trigger.redo()}
      >
        <Icon name="redo" />
      </IconButton>
    </div>
  )
}

function Brand() {
  return (
    <div {...stylex.props(styles.mark)}>
      <img src="/brand/vitsoe.svg" alt="Vitsœ" {...stylex.props(styles.logo)} />
      <span {...stylex.props(styles.product)}>606 Planner</span>
    </div>
  )
}

/** The plan's name and file menu, and whether it is saved. */
function PlanName() {
  const plan = usePlan()
  const saved = useEditor((context) => context.saved)

  return (
    <div>
      <div {...stylex.props(styles.name)}>
        <TextField
          aria-label="Plan name"
          maxLength={200}
          value={plan.name}
          onChange={(name) => editPlan((plan) => ({ ...plan, name }))}
          {...stylex.props(styles.nameField)}
        >
          <Input {...stylex.props(styles.nameInput)} />
        </TextField>
        <PlanMenu />
      </div>
      <span {...stylex.props(text.small, styles.status)}>
        {saved ? 'Saved in this browser' : 'Not saved yet'}
      </span>
    </div>
  )
}

/** The brand, the plan's name and file menu, and whether it is saved. */
function PlanHeader() {
  return (
    <div {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.brand)}>
        <Brand />
        <HistoryButtons />
      </div>
      <PlanName />
    </div>
  )
}

const showParts = () => editor.trigger.showTab({ tab: 'parts' })

/** The price of the whole system, the problems to solve, and sharing. */
function OrderHeader() {
  const lines = useAtom(selectors.parts)
  const errors = useAtom(selectors.issues).filter((issue) => issue.severity === 'error').length

  return (
    <div {...stylex.props(styles.header)}>
      <div>
        <div {...stylex.props(styles.total)}>
          <Button
            onPress={showParts}
            className={({ isFocusVisible }) =>
              stylex.props(styles.price, isFocusVisible && styles.focused).className ?? ''
            }
          >
            {formatPrice(partsTotal(lines))}
          </Button>
        </div>
        {errors > 0 ? (
          <ActionButton variant="danger" style={styles.problems} onPress={showParts}>
            {plural(errors, 'problem')} to solve
          </ActionButton>
        ) : (
          <span {...stylex.props(text.small)}>Including VAT</span>
        )}
      </div>
      <div {...stylex.props(styles.actions)}>
        <ArButton style={styles.grow} />
        <ShareButton style={styles.grow} />
      </div>
    </div>
  )
}

const labels: Record<Tab, string> = {
  layers: 'Layers',
  components: 'Components',
  details: 'Details',
  parts: 'Parts list',
}

/** The tab's content, starting at the top whenever it or the selection changes. */
function TabContent({ tab, lead }: { tab: Tab; lead?: ReactNode }) {
  const selection = useEditor((context) => context.selection)
  const key =
    tab !== 'details' || !selection
      ? tab
      : selection.type === 'item'
        ? selection.id
        : `support-${selection.index}`

  return (
    <div key={key} {...stylex.props(styles.scroll)}>
      {lead}
      {tab === 'layers' ? (
        <LayersPanel />
      ) : tab === 'components' ? (
        <ComponentsTab />
      ) : tab === 'parts' ? (
        <PartsList />
      ) : (
        <DetailsPanel />
      )}
    </div>
  )
}

function TabBand({ values, value }: { values: readonly Tab[]; value: Tab }) {
  return (
    <Tabs
      label="Panel"
      value={value}
      tabs={values.map((entry) => ({ value: entry, label: labels[entry] }))}
      style={styles.band}
      onChange={(tab) => editor.trigger.showTab({ tab })}
    />
  )
}

/** The plan, the layers of the system, and the component catalogue. */
export function LeftPanel() {
  const tab = useEditor((context) => context.leftTab)

  return (
    <aside aria-label="Plan" {...stylex.props(styles.panel, styles.left)}>
      <PlanHeader />
      <TabBand values={['layers', 'components']} value={tab} />
      <TabContent tab={tab} />
    </aside>
  )
}

/** The price and sharing, the details of the selection or system, and the parts list. */
export function RightPanel() {
  const tab = useEditor((context) => context.rightTab)

  return (
    <aside aria-label="Details" {...stylex.props(styles.panel, styles.right)}>
      <OrderHeader />
      <TabBand values={['details', 'parts']} value={tab} />
      <TabContent tab={tab} />
    </aside>
  )
}

export function PhoneHeader() {
  return (
    <header {...stylex.props(styles.phoneHeader)}>
      <Brand />
      <div {...stylex.props(styles.phoneActions)}>
        <HistoryButtons />
        <ArButton compact />
        <ShareButton />
      </div>
    </header>
  )
}

/** On a phone, the total sits over the view; it opens the parts list. */
export function PhoneTotal() {
  const lines = useAtom(selectors.parts)

  return (
    <Button
      onPress={showParts}
      className={({ isFocusVisible }) =>
        stylex.props(styles.phoneTotal, isFocusVisible && styles.focused).className ?? ''
      }
    >
      {formatPrice(partsTotal(lines))}
    </Button>
  )
}

/** On a tablet or phone, one panel beside or under the view, with every tab. */
export function PhonePanel() {
  const tab = useEditor((context) => context.tab)
  const nothingSelected = useEditor((context) => context.selection === null)

  return (
    <section aria-label="Plan" {...stylex.props(styles.panel, styles.phone)}>
      <TabBand values={['details', 'layers', 'components', 'parts']} value={tab} />
      <TabContent
        tab={tab}
        lead={
          tab === 'details' &&
          nothingSelected && (
            <div {...stylex.props(styles.planName)}>
              <PlanName />
            </div>
          )
        }
      />
    </section>
  )
}
