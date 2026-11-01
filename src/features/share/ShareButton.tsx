import * as stylex from '@stylexjs/stylex'
import { useRef, useState, type ReactNode } from 'react'
import { Button } from 'react-aria-components'
import { buildPlanUrl } from '../../domain/plan/share'
import { editor, selectors } from '../../editor/editor'
import { CardDialog, cardText } from '../../ui/overlays'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'

const styles = stylex.create({
  input: {
    width: '100%',
    height: 45,
    padding: '0 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: '#f4f4f2',
    color: '#222',
  },
  select: {
    width: '100%',
    minHeight: 47,
    marginTop: 12,
    borderWidth: 0,
    backgroundColor: colors.blue,
    color: '#fff',
    fontSize: 14,
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

export function ShareButton({
  style,
  children,
}: {
  style?: stylex.StyleXStyles
  children: ReactNode
}) {
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
    if (await copyText(url)) editor.trigger.notify({ notice: 'Share link copied.' })
    else setFallbackUrl(url)
  }

  const selectLink = () => {
    input.current?.focus()
    input.current?.select()
  }

  return (
    <>
      <Button onPress={share} {...stylex.props(style)}>
        {children}
      </Button>
      <CardDialog
        labelledBy="share-title"
        closeLabel="Close share link"
        isOpen={fallbackUrl !== null}
        onClose={() => setFallbackUrl(null)}
      >
        <p {...stylex.props(text.eyebrow)}>Share this plan</p>
        <h2 id="share-title" {...stylex.props(cardText.title)}>
          Copy this link
        </h2>
        <p {...stylex.props(cardText.copy)}>
          Your browser blocked automatic copying. Select the link and copy it.
        </p>
        <input
          ref={input}
          aria-label="Share link"
          readOnly
          autoFocus
          value={fallbackUrl ?? ''}
          onFocus={(event) => event.currentTarget.select()}
          {...stylex.props(styles.input)}
        />
        <Button onPress={selectLink} {...stylex.props(styles.select)}>
          Select link
        </Button>
      </CardDialog>
    </>
  )
}
