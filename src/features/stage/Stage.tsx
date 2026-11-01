import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { Button } from 'react-aria-components'
import { allowedFaces } from '../../domain/plan/system'
import { editor, selectors, useEditor, usePlan, useSelectedItem } from '../../editor/editor'
import { BuilderScene } from '../../scene/BuilderScene'
import { text } from '../../ui/text'
import { colors, media } from '../../ui/tokens.stylex'
import { ItemInspector } from '../inspector/ItemInspector'
import { SupportInspector } from '../inspector/SupportInspector'
import { FacePicker } from './FacePicker'
import { RenderProgress } from './RenderProgress'
import { ViewTools } from './ViewTools'

const styles = stylex.create({
  stage: {
    position: 'relative',
    gridRow: {
      default: 'auto',
      [media.mobile]: 2,
    },
    zIndex: 0,
    isolation: 'isolate',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  title: {
    position: 'absolute',
    zIndex: 4,
    top: {
      default: 27,
      [media.mobile]: 18,
    },
    left: {
      default: 32,
      [media.mobile]: 17,
    },
    pointerEvents: 'none',
  },
  heading: {
    margin: 0,
    fontSize: {
      default: 36,
      [media.mobile]: 24,
    },
    fontWeight: 400,
    letterSpacing: '-0.035em',
  },
  help: {
    position: 'absolute',
    right: 24,
    bottom: 78,
    display: {
      default: 'block',
      [media.narrowTablet]: 'none',
      [media.mobile]: 'none',
    },
    maxWidth: 430,
    margin: 0,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 1.35,
    textAlign: 'right',
  },
  add: {
    position: 'absolute',
    zIndex: 5,
    left: 32,
    bottom: {
      default: 24,
      [media.narrowTablet]: 84,
    },
    display: {
      default: 'block',
      [media.mobile]: 'none',
    },
    height: 46,
    padding: '0 22px',
    borderWidth: 0,
    backgroundColor: colors.blue,
    color: '#fff',
  },
  plus: {
    marginRight: 8,
  },
  issues: {
    position: 'absolute',
    zIndex: 5,
    left: 32,
    bottom: {
      default: 82,
      [media.narrowTablet]: 144,
    },
    display: {
      default: 'block',
      [media.mobile]: 'none',
    },
    padding: '7px 11px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#d8a49a',
    backgroundColor: colors.panel,
    color: '#912412',
    fontSize: 11,
  },
  issueMark: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 16,
    height: 16,
    marginRight: 5,
    borderRadius: '50%',
    backgroundColor: colors.red,
    color: '#fff',
  },
})

export function Stage() {
  const plan = usePlan()
  const issues = useAtom(selectors.issues)
  const rendering = useEditor((context) => context.rendering)
  const activeFace = useEditor((context) => context.activeFace)
  const selection = useEditor((context) => context.selection)
  const selectedItem = useSelectedItem()
  const errors = issues.filter((issue) => issue.severity === 'error').length
  const twoSided = allowedFaces(plan).includes('back')

  return (
    <section aria-label="Room view" {...stylex.props(styles.stage)}>
      {!rendering && (
        <div {...stylex.props(styles.title)}>
          <p {...stylex.props(text.eyebrow)}>606 Universal Shelving System</p>
          <h1 {...stylex.props(styles.heading)}>Plan your system</h1>
        </div>
      )}
      <BuilderScene />
      <ViewTools />
      {rendering ? (
        <RenderProgress />
      ) : (
        <>
          <p {...stylex.props(styles.help)}>
            Drag empty space to orbit · Right-drag to pan · Scroll to zoom · Double-click a
            component to focus · Option-drag to copy
          </p>
          <Button
            onPress={() => editor.trigger.open({ overlay: 'catalog' })}
            {...stylex.props(styles.add)}
          >
            <span aria-hidden="true" {...stylex.props(styles.plus)}>
              ＋
            </span>
            Add to {activeFace}
          </Button>
          {errors > 0 && (
            <Button
              onPress={() => editor.trigger.open({ overlay: 'parts' })}
              {...stylex.props(styles.issues)}
            >
              <span aria-hidden="true" {...stylex.props(styles.issueMark)}>
                !
              </span>
              {errors} issue{errors === 1 ? '' : 's'}
            </Button>
          )}
          {selectedItem && <ItemInspector item={selectedItem} belowFacePicker={twoSided} />}
          {selection?.type === 'support' && (
            <SupportInspector supportIndex={selection.index} belowFacePicker={twoSided} />
          )}
        </>
      )}
      {twoSided && <FacePicker />}
    </section>
  )
}
