import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { buildPlanUrl } from '../../domain/plan/share'
import { editor, selectors } from '../../editor/editor'
import { ActionButton } from '../../ui/buttons'
import { CardDialog } from '../../ui/overlays'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'

const styles = stylex.create({
  input: {
    width: '100%',
    height: 32,
    margin: '16px 0 12px',
    padding: '0 10px',
    borderWidth: 0,
    backgroundColor: colors.band,
  },
})

/** The Clipboard API needs a secure context, so older browsers fall back to a selection copy. */
async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const input = Object.assign(document.createElement('textarea'), { value, readOnly: true })
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.append(input)
    input.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      input.remove()
    }
  }
}

export function ShareButton({ style }: { style?: stylex.StyleXStyles }) {
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const share = async () => {
    let url: string
    try {
      url = buildPlanUrl(selectors.plan.get(), window.location.href)
    } catch {
      editor.trigger.notify({ notice: 'This plan is too large to share as a link.' })
      return
    }
    if (await copyText(url))
      editor.trigger.notify({ notice: 'Link copied. Anyone with it sees this plan.' })
    else setFallbackUrl(url)
  }

  return (
    <>
      <ActionButton variant="primary" style={style} onPress={share}>
        Share
      </ActionButton>
      <CardDialog
        labelledBy="share-title"
        closeLabel="Close"
        isOpen={fallbackUrl !== null}
        onClose={() => setFallbackUrl(null)}
      >
        <h2 id="share-title" {...stylex.props(text.title)}>
          Share this plan
        </h2>
        <p {...stylex.props(text.hint)}>Your browser blocked copying. Copy the link yourself.</p>
        <input
          ref={input}
          aria-label="Share link"
          readOnly
          autoFocus
          value={fallbackUrl ?? ''}
          onFocus={(event) => event.currentTarget.select()}
          {...stylex.props(styles.input)}
        />
        <ActionButton
          variant="primary"
          onPress={() => {
            input.current?.focus()
            input.current?.select()
          }}
        >
          Select link
        </ActionButton>
      </CardDialog>
    </>
  )
}
