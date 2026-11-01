import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { Button } from 'react-aria-components'
import { partsQuantity } from '../../domain/pricing/parts'
import { editor, selectors, useEditor } from '../../editor/editor'
import { colors, media } from '../../ui/tokens.stylex'
import { ShareButton } from '../share/ShareButton'

const styles = stylex.create({
  nav: {
    zIndex: 15,
    display: {
      default: 'none',
      [media.mobile]: 'grid',
    },
    gridRow: 3,
    gridTemplateColumns: '42px repeat(4, minmax(0, 1fr)) 42px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    backgroundColor: colors.panel,
  },
  button: {
    borderWidth: 0,
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: colors.line,
    backgroundColor: colors.panel,
    color: {
      default: 'inherit',
      ':disabled': '#aaa',
    },
    fontSize: 12,
  },
  primary: {
    backgroundColor: colors.blue,
    color: '#fff',
  },
})

export function MobileNav() {
  const parts = useAtom(selectors.parts)
  const activeFace = useEditor((context) => context.activeFace)
  const canUndo = useEditor((context) => context.history.past.length > 0)
  const canRedo = useEditor((context) => context.history.future.length > 0)

  return (
    <nav aria-label="Builder controls" {...stylex.props(styles.nav)}>
      <Button
        aria-label="Undo"
        isDisabled={!canUndo}
        onPress={() => editor.trigger.undo()}
        {...stylex.props(styles.button)}
      >
        ↶
      </Button>
      <Button
        aria-label="Configure room and system"
        onPress={() => editor.trigger.open({ overlay: 'configuration' })}
        {...stylex.props(styles.button)}
      >
        Config
      </Button>
      <Button
        aria-label={`Add component to ${activeFace}`}
        onPress={() => editor.trigger.open({ overlay: 'catalog' })}
        {...stylex.props(styles.button, styles.primary)}
      >
        ＋ {activeFace}
      </Button>
      <Button
        onPress={() => editor.trigger.open({ overlay: 'parts' })}
        {...stylex.props(styles.button)}
      >
        Parts · {partsQuantity(parts)}
      </Button>
      <ShareButton style={styles.button}>Share</ShareButton>
      <Button
        aria-label="Redo"
        isDisabled={!canRedo}
        onPress={() => editor.trigger.redo()}
        {...stylex.props(styles.button)}
      >
        ↷
      </Button>
    </nav>
  )
}
