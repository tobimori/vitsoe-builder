import * as stylex from '@stylexjs/stylex'
import { useEffect } from 'react'
import { editor, useEditor } from '../../editor/editor'
import { media } from '../../ui/tokens.stylex'

const styles = stylex.create({
  region: {
    position: 'fixed',
    zIndex: 80,
    bottom: {
      default: 28,
      [media.mobile]: 74,
    },
    left: '50%',
    maxWidth: 'calc(100vw - 32px)',
    transform: 'translateX(-50%)',
  },
  notice: {
    padding: '10px 15px',
    backgroundColor: '#222',
    color: '#fff',
    boxShadow: '0 3px 14px #0004',
    fontSize: 12,
  },
})

export function Notice() {
  const notice = useEditor((context) => context.notice)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => editor.trigger.notify({ notice: null }), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <div role="status" {...stylex.props(styles.region)}>
      {notice && <div {...stylex.props(styles.notice)}>{notice}</div>}
    </div>
  )
}
