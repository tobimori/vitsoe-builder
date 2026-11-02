import * as stylex from '@stylexjs/stylex'
import { useEffect } from 'react'
import { catalog } from '../../domain/catalog/catalog'
import { isTwoSided } from '../../domain/plan/system'
import { editor, useEditor, usePlan } from '../../editor/editor'
import { BuilderScene } from '../../scene/BuilderScene'
import { ActionButton } from '../../ui/buttons'
import { colors, media } from '../../ui/tokens.stylex'
import { touchScreen } from '../../ui/touch'
import { ItemMenu } from './ItemMenu'
import { StageControls } from './StageControls'

const appear = stylex.keyframes({
  from: { opacity: 0, transform: 'translate(-50%, -6px)' },
})

const styles = stylex.create({
  stage: {
    gridArea: 'stage',
    position: 'relative',
    isolation: 'isolate',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: colors.stage,
  },
  drawing: {
    backgroundColor: colors.surface,
  },
  message: {
    position: 'absolute',
    zIndex: 7,
    top: {
      default: 16,
      [media.stacked]: 10,
    },
    left: '50%',
    maxWidth: 'calc(100% - 24px)',
    padding: '10px 14px',
    backgroundColor: colors.ink,
    color: '#fff',
    fontSize: 14,
    lineHeight: '20px',
    transform: 'translateX(-50%)',
    animationName: appear,
    animationDuration: '0.2s',
  },
  invalid: {
    backgroundColor: colors.red,
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '4px 4px 4px 12px',
    whiteSpace: 'nowrap',
  },
  done: {
    height: 28,
    padding: '0 10px',
    backgroundColor: {
      default: '#ffffff26',
      ':hover': '#ffffff40',
    },
    color: '#fff',
  },
  empty: {
    position: 'absolute',
    zIndex: 5,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
})

function Notice() {
  const notice = useEditor((context) => context.notice)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => editor.trigger.notify({ notice: null }), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return notice && <div {...stylex.props(styles.message)}>{notice}</div>
}

/** What dropping the component would do, so the result is clear before letting go. */
function DragStatus() {
  const drag = useEditor((context) => context.drag)
  const activeFace = useEditor((context) => context.activeFace)
  const twoSided = isTwoSided(usePlan().system.mountingType)
  if (!drag) return null

  const action = drag.duplicate ? 'copy' : 'move'
  const otherFace = activeFace === 'front' ? 'Back' : 'Front'
  const tips = [
    !touchScreen && 'Hold Alt to copy.',
    twoSided && `Drag onto ${otherFace} for the other side.`,
  ]
  const message = !drag.valid
    ? 'It does not fit here'
    : drag.face !== activeFace
      ? `Release to ${action} it to the ${drag.face}, or hold to turn round`
      : drag.duplicate
        ? 'Release to copy'
        : tips.filter(Boolean).join(' ')
  if (!message) return null

  return <div {...stylex.props(styles.message, !drag.valid && styles.invalid)}>{message}</div>
}

/** What a click in the view does while a component is being placed, and a way to stop. */
function PlacingStatus() {
  const placing = useEditor((context) => context.placing)
  const notice = useEditor((context) => context.notice)
  const product = placing && catalog.product(placing.productId)
  if (!product || notice) return null

  const name = product.name.toLowerCase()
  if (placing.fromCatalogue)
    return <div {...stylex.props(styles.message)}>Drop the {name} into a bay</div>

  return (
    <div {...stylex.props(styles.message, styles.bar)}>
      <span>Choose a bay for the {name}</span>
      <ActionButton style={styles.done} onPress={() => editor.trigger.stopPlacing()}>
        Done
      </ActionButton>
    </div>
  )
}

export function Stage() {
  const drawing = useEditor((context) => context.view === 'drawing')
  const placing = useEditor((context) => context.placing !== null)
  const empty = usePlan().system.items.length === 0

  return (
    <section aria-label="Room view" {...stylex.props(styles.stage, drawing && styles.drawing)}>
      <BuilderScene />
      <StageControls />
      {empty && !placing && (
        <div {...stylex.props(styles.empty)}>
          <ActionButton
            variant="primary"
            onPress={() => editor.trigger.showTab({ tab: 'components' })}
          >
            Add components
          </ActionButton>
        </div>
      )}
      <DragStatus />
      <ItemMenu />
      <PlacingStatus />
      <div role="status" aria-live="polite">
        <Notice />
      </div>
    </section>
  )
}
