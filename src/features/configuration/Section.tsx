import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { text } from '../../ui/text'
import { colors, media } from '../../ui/tokens.stylex'

const styles = stylex.create({
  section: {
    padding: {
      default: '32px 32px 36px',
      [media.compact]: '32px 24px 36px',
    },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.rule,
  },
  heading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  aside: {
    color: colors.muted,
    fontSize: 11,
  },
})

export function Section({
  title,
  aside,
  children,
}: {
  title?: string
  /** A short summary beside the title. */
  aside?: string
  children: ReactNode
}) {
  return (
    <section {...stylex.props(styles.section)}>
      {title && (
        <div {...stylex.props(styles.heading)}>
          <h2 {...stylex.props(text.heading)}>{title}</h2>
          {aside && <span {...stylex.props(styles.aside)}>{aside}</span>}
        </div>
      )}
      {children}
    </section>
  )
}
