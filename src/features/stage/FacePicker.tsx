import * as stylex from '@stylexjs/stylex'
import { ToggleButton } from 'react-aria-components'
import type { Face } from '../../domain/types'
import { editor, useEditor, usePlan } from '../../editor/editor'
import { colors, media } from '../../ui/tokens.stylex'

const faces: Face[] = ['front', 'back']

const styles = stylex.create({
  picker: {
    position: 'absolute',
    zIndex: 5,
    top: {
      default: 24,
      [media.tablet]: 108,
      [media.mobile]: 68,
    },
    right: {
      default: 24,
      [media.mobile]: 12,
    },
    left: {
      default: 'auto',
      [media.mobile]: 12,
    },
    display: 'flex',
    alignItems: 'center',
    minHeight: 56,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: '0 3px 13px #0000000d',
  },
  status: {
    display: {
      default: 'block',
      [media.mobile]: 'none',
    },
    padding: '0 14px',
    color: colors.muted,
    fontSize: 12,
  },
  face: {
    display: 'flex',
    flex: {
      default: 'none',
      [media.mobile]: 1,
    },
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: {
      default: 122,
      [media.mobile]: 0,
    },
    minHeight: {
      default: 56,
      [media.mobile]: 52,
    },
    padding: '6px 14px',
    borderWidth: 0,
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: colors.line,
    backgroundColor: colors.panel,
    textAlign: 'left',
    outlineColor: colors.blue,
  },
  active: {
    backgroundColor: colors.strong,
    color: '#fff',
  },
  dragging: {
    backgroundColor: '#edf6fb',
    color: '#111',
    boxShadow: `inset 0 0 0 2px ${colors.blue}`,
  },
  dropTarget: {
    backgroundColor: colors.blue,
    color: '#fff',
  },
  invalid: {
    backgroundColor: colors.red,
    boxShadow: `inset 0 0 0 2px ${colors.red}`,
  },
  name: {
    fontSize: 15,
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  count: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 11,
  },
  lightCount: {
    color: '#ddd',
  },
  whiteCount: {
    color: '#fff',
  },
})

/** Chooses the face to plan, and is a drop target for moving components between faces. */
export function FacePicker() {
  const plan = usePlan()
  const activeFace = useEditor((context) => context.activeFace)
  const drag = useEditor((context) => context.drag)

  return (
    <div aria-label="Side to plan" role="group" {...stylex.props(styles.picker)}>
      <span aria-live="polite" {...stylex.props(styles.status)}>
        {!drag
          ? 'Plan and add to'
          : drag.valid
            ? `${drag.duplicate ? 'Copy' : 'Move'} to ${drag.face}`
            : `Does not fit on ${drag.face}`}
      </span>
      {faces.map((face) => {
        const count = plan.system.items.filter((item) => item.face === face).length
        const active = !drag && activeFace === face
        const target = drag?.face === face

        return (
          <ToggleButton
            key={face}
            isSelected={activeFace === face}
            data-drop-face={face}
            onChange={() => {
              if (!drag) editor.trigger.selectFace({ face })
            }}
            {...stylex.props(
              styles.face,
              active && styles.active,
              drag && styles.dragging,
              target && styles.dropTarget,
              target && !drag.valid && styles.invalid,
            )}
          >
            <strong {...stylex.props(styles.name)}>{face}</strong>
            <small
              {...stylex.props(
                styles.count,
                active && styles.lightCount,
                target && styles.whiteCount,
              )}
            >
              {count} component{count === 1 ? '' : 's'}
            </small>
          </ToggleButton>
        )
      })}
    </div>
  )
}
