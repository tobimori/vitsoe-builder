import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Button, Tooltip, TooltipTrigger, type ButtonProps } from 'react-aria-components'
import { colors, media, weights } from './tokens.stylex'

const styles = stylex.create({
  base: {
    display: 'inline-flex',
    flex: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: {
      default: 36,
      [media.touch]: 44,
    },
    padding: '0 14px',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.ink,
    fontSize: 14,
    lineHeight: '20px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outline: 'none',
    transitionProperty: 'background-color, color',
    transitionDuration: '0.12s',
    WebkitTapHighlightColor: 'transparent',
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: 2,
  },
  disabled: {
    color: colors.faint,
    cursor: 'default',
  },
  primary: {
    padding: '0 16px',
    backgroundColor: {
      default: colors.blue,
      ':hover': colors.blueDark,
    },
    color: '#fff',
    fontWeight: weights.bold,
  },
  primaryDisabled: {
    backgroundColor: colors.band,
  },
  secondary: {
    backgroundColor: {
      default: colors.band,
      ':hover': colors.bandHover,
    },
  },
  quiet: {
    padding: '0 10px',
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.band,
    },
  },
  link: {
    height: 'auto',
    minHeight: {
      default: 0,
      [media.touch]: 36,
    },
    padding: 0,
    color: colors.blue,
    textDecoration: {
      default: 'none',
      ':hover': 'underline',
    },
  },
  danger: {
    height: 'auto',
    minHeight: {
      default: 0,
      [media.touch]: 36,
    },
    padding: 0,
    color: colors.red,
    textDecoration: {
      default: 'none',
      ':hover': 'underline',
    },
  },
  icon: {
    width: {
      default: 32,
      [media.touch]: 40,
    },
    height: {
      default: 32,
      [media.touch]: 40,
    },
    padding: 0,
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.band,
    },
  },
  /** The grey circles Vitsœ uses for previous and next. */
  round: {
    width: {
      default: 32,
      [media.touch]: 40,
    },
    height: {
      default: 32,
      [media.touch]: 40,
    },
    padding: 0,
    borderRadius: '50%',
    backgroundColor: {
      default: colors.band,
      ':hover': colors.bandHover,
    },
    color: colors.muted,
  },
  tooltip: {
    padding: '6px 10px',
    backgroundColor: colors.ink,
    color: '#fff',
    fontSize: 13,
    lineHeight: '18px',
  },
})

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'link' | 'danger' | 'icon' | 'round'

export function ActionButton({
  variant = 'quiet',
  style,
  ...props
}: Omit<ButtonProps, 'className' | 'style'> & {
  variant?: ButtonVariant
  style?: stylex.StyleXStyles
}) {
  return (
    <Button
      {...props}
      className={({ isFocusVisible, isDisabled }) =>
        stylex.props(
          styles.base,
          styles[variant],
          isDisabled && styles.disabled,
          isDisabled && variant === 'primary' && styles.primaryDisabled,
          isFocusVisible && styles.focused,
          style,
        ).className ?? ''
      }
    />
  )
}

/** A label that appears when the pointer rests on, or the keyboard focuses, its trigger. */
export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      {children}
      <Tooltip offset={8} {...stylex.props(styles.tooltip)}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  )
}

/** An icon-only button, named by its tooltip. */
export function IconButton({
  label,
  variant = 'icon',
  children,
  ...props
}: Omit<ButtonProps, 'className' | 'style' | 'children'> & {
  label: string
  variant?: 'icon' | 'round'
  style?: stylex.StyleXStyles
  children: ReactNode
}) {
  return (
    <Hint label={label}>
      <ActionButton variant={variant} aria-label={label} {...props}>
        {children}
      </ActionButton>
    </Hint>
  )
}
