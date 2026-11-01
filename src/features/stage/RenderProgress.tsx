import * as stylex from '@stylexjs/stylex'
import { Button, ProgressBar } from 'react-aria-components'
import type { RenderStatus } from '../../editor/store'
import { editor, useEditor } from '../../editor/editor'
import { colors, media } from '../../ui/tokens.stylex'

const titles: Record<RenderStatus['phase'], string> = {
  idle: '',
  loading: 'Preparing render',
  rendering: 'Rendering',
  complete: 'Render ready',
  error: 'Render unavailable',
}

const actions: Record<RenderStatus['phase'], string> = {
  idle: 'Cancel render',
  loading: 'Cancel render',
  rendering: 'Cancel render',
  complete: 'Back to edit',
  error: 'Continue editing',
}

const styles = stylex.create({
  panel: {
    position: 'absolute',
    zIndex: 7,
    right: {
      default: 24,
      [media.mobile]: 12,
    },
    bottom: {
      default: 78,
      [media.mobile]: 69,
    },
    display: 'flex',
    alignItems: 'center',
    gap: 22,
    width: {
      default: 'min(420px, calc(100% - 48px))',
      [media.mobile]: 'calc(100% - 24px)',
    },
    minHeight: {
      default: 72,
      [media.mobile]: 66,
    },
    padding: {
      default: '14px 16px',
      [media.mobile]: '10px 12px',
    },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: '0 3px 13px #00000014',
  },
  failed: {
    borderColor: '#c77668',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
  },
  message: {
    display: 'block',
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 1.35,
  },
  track: {
    height: 3,
    marginTop: 10,
    backgroundColor: colors.divider,
  },
  fill: (fraction: number) => ({
    height: '100%',
    width: `${fraction * 100}%`,
    backgroundColor: colors.blue,
  }),
  action: {
    minHeight: 44,
    padding: {
      default: '0 14px',
      [media.mobile]: '0 10px',
    },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.blue,
    fontSize: {
      default: 13,
      [media.mobile]: 12,
    },
    whiteSpace: 'nowrap',
  },
})

export function RenderProgress() {
  const status = useEditor((context) => context.renderStatus)
  if (!status || status.phase === 'idle') return null

  const { phase, message, progress } = status

  return (
    <div
      role={phase === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      {...stylex.props(styles.panel, phase === 'error' && styles.failed)}
    >
      <div {...stylex.props(styles.body)}>
        <strong {...stylex.props(styles.title)}>{titles[phase]}</strong>
        {message && phase !== 'complete' && (
          <span {...stylex.props(styles.message)}>{message}</span>
        )}
        {progress !== undefined && (
          <ProgressBar aria-label="Rendering progress" minValue={0} maxValue={1} value={progress}>
            {({ percentage = 0 }) => (
              <div {...stylex.props(styles.track)}>
                <div {...stylex.props(styles.fill(percentage / 100))} />
              </div>
            )}
          </ProgressBar>
        )}
      </div>
      <Button onPress={() => editor.trigger.toggleRendering()} {...stylex.props(styles.action)}>
        {actions[phase]}
      </Button>
    </div>
  )
}
