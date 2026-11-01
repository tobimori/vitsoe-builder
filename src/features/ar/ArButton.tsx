import * as stylex from '@stylexjs/stylex'
import { useEffect, useState } from 'react'
import { Button } from 'react-aria-components'
import { catalog } from '../../domain/catalog/catalog'
import { isWallMounted } from '../../domain/plan/system'
import { editor, selectors, usePlan } from '../../editor/editor'
import { exportPlanUsdz } from '../../scene/export/usdz'
import { CardDialog, cardText } from '../../ui/overlays'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'

const styles = stylex.create({
  launch: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 47,
    backgroundColor: colors.blue,
    color: '#fff',
    textDecoration: 'none',
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

export function ArButton({ style }: { style?: stylex.StyleXStyles }) {
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
      <Button isDisabled={preparing} onPress={prepare} {...stylex.props(style)}>
        {preparing ? 'Preparing…' : 'View in AR'}
      </Button>
      <CardDialog
        labelledBy="ar-title"
        closeLabel="Close AR preview"
        isOpen={url !== null}
        onClose={() => setUrl(null)}
      >
        <p {...stylex.props(text.eyebrow)}>Augmented reality</p>
        <h2 id="ar-title" {...stylex.props(cardText.title)}>
          Your room, your system
        </h2>
        <p {...stylex.props(cardText.copy)}>
          {!iOS
            ? 'Open this planner on an iPhone or iPad to place the system in your room. You can download the AR model here.'
            : isWallMounted(plan.system.mountingType)
              ? 'Point your device at a clear wall, place the system, then adjust its mounting height.'
              : 'Scan a clear area of floor, then place the system at full scale.'}
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
            {iOS ? 'Open in AR' : 'Download USDZ'}
          </a>
        )}
      </CardDialog>
    </>
  )
}
