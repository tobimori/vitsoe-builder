import * as stylex from '@stylexjs/stylex'
import { useEffect, useState } from 'react'
import { catalog } from '../../domain/catalog/catalog'
import { isWallMounted } from '../../domain/plan/system'
import { editor, selectors, usePlan } from '../../editor/editor'
import { exportPlanUsdz } from '../../scene/export/usdz'
import { ActionButton } from '../../ui/buttons'
import { Icon } from '../../ui/icons'
import { CardDialog } from '../../ui/overlays'
import { text } from '../../ui/text'
import { colors, media, weights } from '../../ui/tokens.stylex'

const styles = stylex.create({
  launch: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    marginTop: 20,
    backgroundColor: {
      default: colors.blue,
      ':hover': colors.blueDark,
    },
    color: '#fff',
    fontWeight: weights.bold,
    textDecoration: 'none',
  },
  compact: {
    width: {
      default: 36,
      [media.touch]: 44,
    },
    padding: 0,
  },
  // Quick Look only opens links that contain an image: https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/
  quickLookImage: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
})

const iOS =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function ArButton({
  compact = false,
  style,
}: {
  /** Only the icon, for the narrow phone header. */
  compact?: boolean
  style?: stylex.StyleXStyles
}) {
  const plan = usePlan()
  const [preparing, setPreparing] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )

  const prepare = async () => {
    setPreparing(true)
    try {
      const model = await exportPlanUsdz(selectors.plan.get(), catalog)
      setUrl(URL.createObjectURL(model))
    } catch {
      editor.trigger.notify({ notice: 'The AR model could not be prepared.' })
    } finally {
      setPreparing(false)
    }
  }

  return (
    <>
      <ActionButton
        variant="secondary"
        aria-label={compact ? 'View in AR' : undefined}
        isDisabled={preparing}
        style={[compact && styles.compact, style]}
        onPress={prepare}
      >
        <Icon name="ar" />
        {!compact && (preparing ? 'Preparing…' : 'View in AR')}
      </ActionButton>
      <CardDialog
        labelledBy="ar-title"
        closeLabel="Close"
        isOpen={url !== null}
        onClose={() => setUrl(null)}
      >
        <h2 id="ar-title" {...stylex.props(text.title)}>
          View in your room
        </h2>
        <p {...stylex.props(text.hint)}>
          {!iOS
            ? 'Open this planner on an iPhone or iPad to place the system in your room, or download the model.'
            : isWallMounted(plan.system.mountingType)
              ? 'Scan the floor and a clear wall, then drag the system onto the wall and adjust its height.'
              : 'Scan a clear area of floor, then place the system at full size.'}
        </p>
        {url && (
          <a
            rel="ar"
            href={iOS ? `${url}#allowsContentScaling=0` : url}
            download={iOS ? undefined : 'vitsoe-606-plan.usdz'}
            {...stylex.props(styles.launch)}
          >
            <img
              alt=""
              src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
              {...stylex.props(styles.quickLookImage)}
            />
            {iOS ? 'Open in AR' : 'Download USDZ model'}
          </a>
        )}
      </CardDialog>
    </>
  )
}
