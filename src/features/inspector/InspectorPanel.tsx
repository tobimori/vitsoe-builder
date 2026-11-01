import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Button } from 'react-aria-components'
import { text } from '../../ui/text'
import { colors, media } from '../../ui/tokens.stylex'

const styles = stylex.create({
  panel: {
    position: 'absolute',
    zIndex: 6,
    top: {
      default: 96,
      [media.mobile]: 'auto',
    },
    right: {
      default: 24,
      [media.compact]: 16,
      [media.mobile]: 12,
    },
    bottom: {
      default: 'auto',
      [media.mobile]: 69,
    },
    left: {
      default: 'auto',
      [media.mobile]: 12,
    },
    display: 'flex',
    flexDirection: 'column',
    width: {
      default: 312,
      [media.mobile]: 'auto',
    },
    maxHeight: {
      default: 'calc(100% - 176px)',
      [media.mobile]: '50vh',
    },
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: '0 7px 25px #00000014',
  },
  /** Leaves room for the face picker above the panel. */
  belowFacePicker: {
    top: {
      default: 104,
      [media.tablet]: 180,
      [media.mobile]: 'auto',
    },
    maxHeight: {
      default: 'calc(100% - 176px)',
      [media.tablet]: 'calc(100% - 260px)',
      [media.mobile]: '50vh',
    },
  },
  header: {
    display: 'flex',
    flex: 'none',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: {
      default: '19px 20px',
      [media.mobile]: '14px 16px',
    },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.divider,
  },
  subtitle: {
    margin: '4px 0 0',
    color: colors.muted,
    fontSize: 14,
  },
  close: {
    minWidth: 58,
    minHeight: 44,
    margin: '-8px -10px -8px 0',
    padding: '0 10px',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.blue,
    fontSize: 13,
  },
  body: {
    minHeight: 0,
    overflowY: 'auto',
    padding: {
      default: '12px 20px 22px',
      [media.mobile]: '4px 16px 14px',
    },
  },
  footer: {
    display: 'grid',
    gridAutoColumns: '1fr',
    gridAutoFlow: 'column',
    flex: 'none',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.divider,
  },
})

export const footerButton = stylex.create({
  base: {
    height: 45,
    borderWidth: 0,
    borderRightWidth: {
      default: 1,
      ':last-child': 0,
    },
    borderRightStyle: 'solid',
    borderRightColor: colors.divider,
    backgroundColor: colors.panel,
    fontSize: 12,
  },
  danger: {
    color: colors.red,
  },
})

export function InspectorPanel({
  label,
  eyebrow,
  title,
  subtitle,
  belowFacePicker,
  footer,
  children,
  onClose,
}: {
  label: string
  eyebrow: string
  title: string
  subtitle: string
  belowFacePicker: boolean
  footer: ReactNode
  children: ReactNode
  /** Shows a close button in the header. */
  onClose?: () => void
}) {
  return (
    <aside
      aria-label={label}
      {...stylex.props(styles.panel, belowFacePicker && styles.belowFacePicker)}
    >
      <header {...stylex.props(styles.header)}>
        <div>
          <p {...stylex.props(text.eyebrow)}>{eyebrow}</p>
          <h2 {...stylex.props(text.heading)}>{title}</h2>
          <p {...stylex.props(styles.subtitle)}>{subtitle}</p>
        </div>
        {onClose && (
          <Button onPress={onClose} {...stylex.props(styles.close)}>
            Close
          </Button>
        )}
      </header>
      <div {...stylex.props(styles.body)}>{children}</div>
      <footer {...stylex.props(styles.footer)}>{footer}</footer>
    </aside>
  )
}
