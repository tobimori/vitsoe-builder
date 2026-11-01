import * as stylex from '@stylexjs/stylex'
import { Button, ToggleButton } from 'react-aria-components'
import { isTwoSided } from '../../domain/plan/system'
import type { Face } from '../../domain/types'
import { editor, useEditor, usePlan } from '../../editor/editor'
import type { View } from '../../editor/store'
import { CheckboxField } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { touchScreen } from '../../ui/touch'
import { useSinglePanel } from '../../ui/useSinglePanel'
import { colors, media, weights } from '../../ui/tokens.stylex'

const views: { value: View; label: string }[] = [
  { value: 'orbit', label: '3D' },
  { value: 'elevation', label: 'Elevation' },
  { value: 'drawing', label: 'Drawing' },
]

const faces: { value: Face; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
]

const styles = stylex.create({
  bar: {
    position: 'absolute',
    zIndex: 6,
    left: '50%',
    bottom: {
      default: 20,
      [media.narrow]: 10,
    },
    display: 'flex',
    alignItems: 'center',
    width: 'max-content',
    maxWidth: 'calc(100% - 20px)',
    height: 44,
    // Scrolls sideways on the narrowest phones
    overflowX: 'auto',
    scrollbarWidth: 'none',
    padding: {
      default: '0 8px',
      [media.narrow]: '0 4px',
    },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    transform: 'translateX(-50%)',
  },
  group: {
    display: 'flex',
    height: '100%',
  },
  divider: {
    flex: 'none',
    width: 1,
    height: 20,
    margin: {
      default: '0 8px',
      [media.narrow]: '0 4px',
    },
    backgroundColor: colors.line,
  },
  item: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: {
      default: '0 10px',
      [media.narrow]: '0 6px',
    },
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.ink,
    fontSize: 14,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outline: 'none',
    transitionProperty: 'background-color, color, box-shadow',
    transitionDuration: '0.12s',
    // Reserves the bold width, so the current item does not shift the others
    '::after': {
      content: 'attr(data-label)',
      height: 0,
      overflow: 'hidden',
      visibility: 'hidden',
      fontWeight: weights.bold,
    },
  },
  current: {
    fontWeight: weights.bold,
  },
  drop: {
    backgroundColor: colors.blueTint,
    boxShadow: `inset 0 0 0 1.5px ${colors.blue}`,
    color: colors.blue,
  },
  target: {
    backgroundColor: colors.blue,
    color: '#fff',
  },
  invalid: {
    backgroundColor: colors.red,
    boxShadow: 'none',
    color: '#fff',
  },
  dimensions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 10px',
  },
  key: {
    padding: '1px 5px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    color: colors.muted,
    fontFamily: 'inherit',
    fontSize: 11,
    lineHeight: '14px',
  },
  dimensionsOn: {
    backgroundColor: colors.blueTint,
    color: colors.blue,
  },
  fit: {
    color: colors.blue,
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: -2,
  },
})

/** Picks the face to work on; while dragging, the other face is a drop target. */
function FaceSwitch() {
  const activeFace = useEditor((context) => context.activeFace)
  const drag = useEditor((context) => context.drag)

  return (
    <div role="group" aria-label="Face" {...stylex.props(styles.group)}>
      {faces.map((face) => {
        const other = face.value !== activeFace
        const target = drag?.face === face.value && other

        return (
          <ToggleButton
            key={face.value}
            isSelected={!other}
            data-drop-face={face.value}
            data-label={face.label}
            onChange={() => {
              if (!drag) editor.trigger.selectFace({ face: face.value })
            }}
            className={({ isFocusVisible }) =>
              stylex.props(
                styles.item,
                !other && styles.current,
                drag && other && styles.drop,
                target && styles.target,
                target && !drag.valid && styles.invalid,
                isFocusVisible && styles.focused,
              ).className ?? ''
            }
          >
            {face.label}
          </ToggleButton>
        )
      })}
    </div>
  )
}

export function StageControls() {
  const plan = usePlan()
  const view = useEditor((context) => context.view)
  const showDimensions = useEditor((context) => context.showDimensions)
  // Tablets and phones have less room, so the option becomes an icon
  const narrow = useSinglePanel()

  return (
    <div role="toolbar" aria-label="View" {...stylex.props(styles.bar)}>
      {isTwoSided(plan.system.mountingType) && (
        <>
          <FaceSwitch />
          <span {...stylex.props(styles.divider)} />
        </>
      )}
      <div role="group" aria-label="View" {...stylex.props(styles.group)}>
        {views.map((entry) => (
          <ToggleButton
            key={entry.value}
            isSelected={view === entry.value}
            data-label={entry.label}
            onChange={() => editor.trigger.setView({ view: entry.value })}
            className={({ isSelected, isFocusVisible }) =>
              stylex.props(
                styles.item,
                isSelected && styles.current,
                isFocusVisible && styles.focused,
              ).className ?? ''
            }
          >
            {entry.label}
          </ToggleButton>
        ))}
      </div>
      <span {...stylex.props(styles.divider)} />
      {narrow ? (
        <ToggleButton
          aria-label="Dimensions"
          isSelected={showDimensions}
          onChange={() => editor.trigger.toggleDimensions()}
          className={({ isSelected, isFocusVisible }) =>
            stylex.props(
              styles.item,
              isSelected && styles.dimensionsOn,
              isFocusVisible && styles.focused,
            ).className ?? ''
          }
        >
          <Icon name="dimensions" />
        </ToggleButton>
      ) : (
        <div {...stylex.props(styles.dimensions)}>
          <CheckboxField
            label="Dimensions"
            checked={showDimensions}
            onChange={() => editor.trigger.toggleDimensions()}
          />
          {!touchScreen && (
            <kbd title="Hold Alt to show every dimension" {...stylex.props(styles.key)}>
              Alt
            </kbd>
          )}
        </div>
      )}
      <Button
        onPress={() => editor.trigger.fitCamera()}
        className={({ isFocusVisible }) =>
          stylex.props(styles.item, styles.fit, isFocusVisible && styles.focused).className ?? ''
        }
      >
        Fit
      </Button>
    </div>
  )
}
