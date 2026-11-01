import * as stylex from '@stylexjs/stylex'
import { editor, useEditor } from '../../editor/editor'
import { CloseButton, Sheet } from '../../ui/overlays'
import { ConfigurationPanel } from '../configuration/ConfigurationPanel'

const styles = stylex.create({
  sheet: {
    top: 40,
    width: 'min(360px, calc(100vw - 28px))',
  },
  close: {
    position: 'absolute',
    zIndex: 3,
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    fontSize: 24,
  },
})

export function MobileConfiguration() {
  const open = useEditor((context) => context.overlay === 'configuration')
  const close = () => editor.trigger.open({ overlay: null })

  return (
    <Sheet label="Configuration" side="left" isOpen={open} style={styles.sheet} onClose={close}>
      <CloseButton label="Close configuration" style={styles.close} onPress={close} />
      <ConfigurationPanel />
    </Sheet>
  )
}
