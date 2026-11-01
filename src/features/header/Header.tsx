import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { Button, Input, TextField } from 'react-aria-components'
import { partsQuantity } from '../../domain/pricing/parts'
import { editor, selectors, useEditor, usePlan } from '../../editor/editor'
import { colors, media } from '../../ui/tokens.stylex'
import { ArButton } from '../ar/ArButton'
import { ShareButton } from '../share/ShareButton'
import { PlanFileActions } from './PlanFileActions'

const styles = stylex.create({
  header: {
    gridColumn: '1 / -1',
    zIndex: 20,
    display: 'grid',
    gridTemplateColumns: {
      default: '360px 1fr auto',
      [media.compact]: '286px 1fr auto',
      [media.mobile]: '1fr auto',
    },
    alignItems: 'stretch',
    minHeight: {
      default: 88,
      [media.mobile]: 58,
    },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: colors.panel,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: {
      default: '0 32px',
      [media.compact]: '0 32px 0 24px',
      [media.mobile]: '0 16px',
    },
  },
  logo: {
    display: 'block',
    width: {
      default: 156,
      [media.compact]: 132,
      [media.mobile]: 106,
    },
    height: 'auto',
  },
  designer: {
    maxWidth: {
      default: 54,
      [media.mobile]: 48,
    },
    color: '#4b4a48',
    fontSize: {
      default: 12,
      [media.mobile]: 10,
    },
    lineHeight: 1.15,
  },
  title: {
    display: {
      default: 'block',
      [media.mobile]: 'none',
    },
    alignSelf: 'center',
    minWidth: 0,
    padding: '0 32px',
  },
  name: {
    display: 'block',
    width: 'min(380px, 100%)',
    padding: 0,
    borderWidth: 0,
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: 17,
    fontWeight: 600,
  },
  status: {
    display: 'block',
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
  },
  actions: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 2,
    padding: 14,
  },
  action: {
    padding: '0 16px',
    borderWidth: 0,
    backgroundColor: colors.panel,
    fontSize: 14,
    outlineColor: colors.blue,
  },
  desktopOnly: {
    display: {
      default: 'block',
      [media.mobile]: 'none',
    },
  },
  quiet: {
    display: {
      default: 'block',
      [media.compact]: 'none',
    },
    color: '#555',
  },
  disabled: {
    color: {
      default: 'inherit',
      ':disabled': '#aaa',
    },
  },
  count: {
    display: 'inline-grid',
    placeItems: 'center',
    minWidth: 22,
    height: 22,
    marginLeft: 6,
    borderRadius: '50%',
    backgroundColor: '#ececea',
    fontSize: 11,
  },
  ar: {
    minWidth: {
      default: 132,
      [media.mobile]: 104,
    },
    padding: {
      default: '0 16px',
      [media.mobile]: '0 15px',
    },
    borderWidth: 0,
    backgroundColor: colors.blue,
    color: '#fff',
    fontSize: {
      default: 14,
      [media.mobile]: 13,
    },
  },
})

export function Header() {
  const plan = usePlan()
  const parts = useAtom(selectors.parts)
  const canUndo = useEditor((context) => context.history.past.length > 0)
  const canRedo = useEditor((context) => context.history.future.length > 0)
  const saved = useEditor((context) => context.saved)

  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.brand)}>
        <img src="/brand/vitsoe.svg" alt="Vitsœ" {...stylex.props(styles.logo)} />
        <span {...stylex.props(styles.designer)}>Design Dieter Rams</span>
      </div>
      <div {...stylex.props(styles.title)}>
        <TextField
          aria-label="Plan name"
          maxLength={200}
          value={plan.name}
          onChange={(name) => editor.trigger.edit({ plan: { ...plan, name } })}
        >
          <Input {...stylex.props(styles.name)} />
        </TextField>
        <span {...stylex.props(styles.status)}>{saved ? 'Saved locally' : 'New plan'}</span>
      </div>
      <nav aria-label="Plan actions" {...stylex.props(styles.actions)}>
        <Button
          aria-label="Undo"
          aria-keyshortcuts="Control+Z Meta+Z"
          isDisabled={!canUndo}
          onPress={() => editor.trigger.undo()}
          {...stylex.props(styles.action, styles.desktopOnly, styles.disabled)}
        >
          ↶
        </Button>
        <Button
          aria-label="Redo"
          aria-keyshortcuts="Shift+Control+Z Shift+Meta+Z"
          isDisabled={!canRedo}
          onPress={() => editor.trigger.redo()}
          {...stylex.props(styles.action, styles.desktopOnly, styles.disabled)}
        >
          ↷
        </Button>
        <PlanFileActions style={[styles.action, styles.quiet]} />
        <ShareButton style={[styles.action, styles.desktopOnly]}>Copy link</ShareButton>
        <Button
          onPress={() => editor.trigger.open({ overlay: 'parts' })}
          {...stylex.props(styles.action, styles.desktopOnly)}
        >
          Parts <span {...stylex.props(styles.count)}>{partsQuantity(parts)}</span>
        </Button>
        <ArButton style={styles.ar} />
      </nav>
    </header>
  )
}
