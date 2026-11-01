import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { text } from './text'
import { colors } from './tokens.stylex'

const styles = stylex.create({
  section: {
    padding: '20px 20px 24px',
    borderTopWidth: {
      default: 1,
      ':first-child': 0,
    },
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 32,
    marginBottom: 8,
  },
  end: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  aside: {
    color: colors.muted,
    fontSize: 13,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
})

/** A titled block of a side panel, with an optional summary and actions beside the title. */
export function Section({
  title,
  aside,
  actions,
  children,
}: {
  title?: string
  /** A short summary beside the title. */
  aside?: ReactNode
  /** Small icon buttons at the end of the title row. */
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section {...stylex.props(styles.section)}>
      {title && (
        <header {...stylex.props(styles.header)}>
          <h2 {...stylex.props(text.heading)}>{title}</h2>
          {(aside || actions) && (
            <span {...stylex.props(styles.end)}>
              {aside && <span {...stylex.props(styles.aside)}>{aside}</span>}
              {actions}
            </span>
          )}
        </header>
      )}
      {children}
    </section>
  )
}
