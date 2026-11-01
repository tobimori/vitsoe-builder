import * as stylex from '@stylexjs/stylex'
import { Button, ToggleButton } from 'react-aria-components'
import { editor, useEditor } from '../../editor/editor'
import { colors, media } from '../../ui/tokens.stylex'

const styles = stylex.create({
  tools: {
    position: 'absolute',
    zIndex: 5,
    right: {
      default: 24,
      [media.mobile]: 12,
    },
    bottom: {
      default: 24,
      [media.mobile]: 13,
    },
    left: {
      default: 'auto',
      [media.mobile]: 12,
    },
    display: {
      default: 'flex',
      [media.mobile]: 'grid',
    },
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: '0 3px 13px #0000000d',
  },
  tool: {
    minWidth: {
      default: 92,
      [media.tablet]: 72,
      [media.mobile]: 0,
    },
    height: 44,
    padding: {
      default: '0 14px',
      [media.tablet]: '0 8px',
      [media.mobile]: '0 2px',
    },
    borderWidth: 0,
    borderRightWidth: {
      default: 1,
      ':last-child': 0,
    },
    borderRightStyle: 'solid',
    borderRightColor: colors.divider,
    backgroundColor: colors.panel,
    fontSize: {
      default: 13,
      [media.tablet]: 12,
      [media.mobile]: 10,
    },
    outlineColor: colors.blue,
  },
  pressed: {
    backgroundColor: '#252525',
    color: '#fff',
  },
})

const toolClassName = ({ isSelected }: { isSelected: boolean }) =>
  stylex.props(styles.tool, isSelected && styles.pressed).className ?? ''

export function ViewTools() {
  const view = useEditor((context) => context.view)
  const activeFace = useEditor((context) => context.activeFace)
  const showDimensions = useEditor((context) => context.showDimensions)
  const rendering = useEditor((context) => context.rendering)

  return (
    <div role="toolbar" aria-label="View options" {...stylex.props(styles.tools)}>
      <ToggleButton
        isSelected={view === 'orbit'}
        onChange={() => editor.trigger.setView({ view: 'orbit' })}
        className={toolClassName}
      >
        3D view
      </ToggleButton>
      <ToggleButton
        isSelected={view !== 'orbit'}
        onChange={() => editor.trigger.setView({ view: activeFace })}
        className={toolClassName}
      >
        Straight-on
      </ToggleButton>
      <ToggleButton
        isSelected={showDimensions}
        onChange={() => editor.trigger.toggleDimensions()}
        className={toolClassName}
      >
        Dimensions
      </ToggleButton>
      <Button onPress={() => editor.trigger.fitCamera()} {...stylex.props(styles.tool)}>
        Fit view
      </Button>
      <ToggleButton
        isSelected={rendering}
        onChange={() => editor.trigger.toggleRendering()}
        className={toolClassName}
      >
        Render
      </ToggleButton>
    </div>
  )
}
