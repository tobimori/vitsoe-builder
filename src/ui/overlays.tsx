import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import { ActionButton } from './buttons'
import { Icon } from './icons'
import { colors } from './tokens.stylex'

const fadeIn = stylex.keyframes({ from: { opacity: 0 } })
const fadeOut = stylex.keyframes({ to: { opacity: 0 } })
const styles = stylex.create({
  overlay: {
    position: 'fixed',
    zIndex: 40,
    inset: 0,
    backgroundColor: 'rgb(0 0 0 / 0.18)',
    animationDuration: '0.2s',
    animationFillMode: 'both',
  },
  centred: {
    zIndex: 90,
    display: 'grid',
    placeItems: 'center',
    padding: 20,
  },
  fadeIn: {
    animationName: fadeIn,
  },
  fadeOut: {
    animationName: fadeOut,
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
    width: 'min(400px, 100%)',
    padding: 28,
    backgroundColor: colors.surface,
    outline: 'none',
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
})

const className = (...rules: stylex.StyleXStyles[]) => stylex.props(...rules).className ?? ''

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
          <CloseButton label={closeLabel} style={styles.close} onPress={onClose} />
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
    <ActionButton variant="icon" aria-label={label} style={style} onPress={onPress}>
      <Icon name="close" />
    </ActionButton>
  )
}
