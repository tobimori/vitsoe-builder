import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { editor } from '../../editor/editor'
import { ActionButton } from '../../ui/buttons'
import { Icon } from '../../ui/icons'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'

const styles = stylex.create({
  top: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
    minWidth: 0,
  },
  details: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    marginTop: 16,
  },
})

/** The selection's name, details and actions, and a way back to the whole system. */
export function InspectorHeader({
  title,
  subtitle,
  aside,
  actions,
}: {
  title: string
  subtitle: ReactNode
  aside?: ReactNode
  /** Text links for what can be done with the selection. */
  actions?: ReactNode
}) {
  return (
    <Section>
      <div {...stylex.props(styles.top)}>
        <h2 {...stylex.props(text.title, styles.title)}>{title}</h2>
        <ActionButton variant="link" onPress={() => editor.trigger.clearSelection()}>
          Done
          <Icon name="close" size={12} />
        </ActionButton>
      </div>
      <div {...stylex.props(styles.details)}>
        <span {...stylex.props(text.small)}>{subtitle}</span>
        {aside && <span {...stylex.props(styles.price, text.numeric)}>{aside}</span>}
      </div>
      {actions && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </Section>
  )
}
