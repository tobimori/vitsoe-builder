import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Button, Dialog, Modal, ModalOverlay } from 'react-aria-components'
import { colors } from './tokens.stylex'

const fadeIn = stylex.keyframes({ from: { opacity: 0 } })
const fadeOut = stylex.keyframes({ to: { opacity: 0 } })
const fromRight = stylex.keyframes({ from: { transform: 'translateX(100%)' } })
const toRight = stylex.keyframes({ to: { transform: 'translateX(100%)' } })
const fromLeft = stylex.keyframes({ from: { transform: 'translateX(-100%)' } })
const toLeft = stylex.keyframes({ to: { transform: 'translateX(-100%)' } })

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    zIndex: 40,
    inset: 0,
    backgroundColor: '#0003',
    animationDuration: '0.2s',
    animationFillMode: 'both',
  },
  clear: {
    backgroundColor: 'transparent',
  },
  centred: {
    zIndex: 90,
    display: 'grid',
    placeItems: 'center',
    padding: 18,
    backgroundColor: '#0005',
  },
  fadeIn: {
    animationName: fadeIn,
  },
  fadeOut: {
    animationName: fadeOut,
  },
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.panel,
    outline: 'none',
    animationDuration: '0.25s',
    animationTimingFunction: 'ease',
    animationFillMode: 'both',
  },
  right: {
    right: 0,
  },
  left: {
    left: 0,
  },
  fromRight: {
    animationName: fromRight,
  },
  toRight: {
    animationName: toRight,
  },
  fromLeft: {
    animationName: fromLeft,
  },
  toLeft: {
    animationName: toLeft,
  },
  dialog: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    outline: 'none',
  },
  card: {
    position: 'relative',
    width: 'min(420px, 100%)',
    padding: '34px 34px 30px',
    backgroundColor: colors.panel,
    boxShadow: '0 12px 40px #0004',
    outline: 'none',
  },
  close: {
    display: 'grid',
    placeItems: 'center',
    width: 44,
    height: 44,
    padding: 0,
    borderWidth: 0,
    backgroundColor: colors.panel,
    fontSize: 18,
    outlineColor: colors.blue,
  },
  cardClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    backgroundColor: 'transparent',
    fontSize: 23,
  },
})

export const cardText = stylex.create({
  title: {
    margin: 0,
    fontSize: 27,
    fontWeight: 400,
    letterSpacing: '-0.03em',
  },
  copy: {
    margin: '13px 0 25px',
    color: colors.muted,
    fontSize: 13,
  },
})

const className = (...rules: stylex.StyleXStyles[]) => stylex.props(...rules).className ?? ''

/** A full-height panel that slides in from one side of the window. */
export function Sheet({
  label,
  isOpen,
  side = 'right',
  dimmed = true,
  style,
  children,
  onClose,
}: {
  label: string
  isOpen: boolean
  side?: 'left' | 'right'
  /** Dims the page behind the sheet. */
  dimmed?: boolean
  style?: stylex.StyleXStyles
  children: ReactNode
  onClose: () => void
}) {
  const right = side === 'right'

  return (
    <ModalOverlay
      isOpen={isOpen}
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className={({ isEntering, isExiting }) =>
        className(
          styles.overlay,
          !dimmed && styles.clear,
          isEntering && styles.fadeIn,
          isExiting && styles.fadeOut,
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          className(
            styles.sheet,
            right ? styles.right : styles.left,
            style,
            isEntering && (right ? styles.fromRight : styles.fromLeft),
            isExiting && (right ? styles.toRight : styles.toLeft),
          )
        }
      >
        <Dialog aria-label={label} {...stylex.props(styles.dialog)}>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

/** A small centred dialog with a close button. */
export function CardDialog({
  labelledBy,
  isOpen,
  closeLabel,
  children,
  onClose,
}: {
  labelledBy: string
  isOpen: boolean
  closeLabel: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className={({ isEntering, isExiting }) =>
        className(
          styles.overlay,
          styles.centred,
          isEntering && styles.fadeIn,
          isExiting && styles.fadeOut,
        )
      }
    >
      <Modal>
        <Dialog aria-labelledby={labelledBy} {...stylex.props(styles.card)}>
          <CloseButton label={closeLabel} style={styles.cardClose} onPress={onClose} />
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

export function CloseButton({
  label,
  style,
  onPress,
}: {
  label: string
  style?: stylex.StyleXStyles
  onPress: () => void
}) {
  return (
    <Button aria-label={label} onPress={onPress} {...stylex.props(styles.close, style)}>
      <span aria-hidden="true">×</span>
    </Button>
  )
}
