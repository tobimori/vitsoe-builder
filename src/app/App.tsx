import * as stylex from '@stylexjs/stylex'
import {
  LeftPanel,
  PhoneHeader,
  PhonePanel,
  PhoneTotal,
  RightPanel,
} from '../features/panel/Panels'
import { Stage } from '../features/stage/Stage'
import { colors, media } from '../ui/tokens.stylex'
import { useSinglePanel } from '../ui/useSinglePanel'

const styles = stylex.create({
  shell: {
    display: 'grid',
    gridTemplateAreas: {
      default: '"left stage right"',
      [media.single]: '"header header" "stage panel"',
      [media.stacked]: '"header" "stage" "panel"',
    },
    gridTemplateColumns: {
      default: '300px minmax(0, 1fr) 320px',
      [media.compact]: '264px minmax(0, 1fr) 288px',
      [media.single]: 'minmax(0, 1fr) 340px',
      [media.stacked]: 'minmax(0, 1fr)',
    },
    gridTemplateRows: {
      default: 'minmax(0, 1fr)',
      [media.single]: '56px minmax(0, 1fr)',
      [media.stacked]: '56px minmax(240px, 44%) minmax(0, 1fr)',
    },
    width: '100%',
    height: '100%',
    // The page reaches under the notch and home indicator; the controls stay clear of them
    paddingTop: 'env(safe-area-inset-top)',
    paddingRight: 'env(safe-area-inset-right)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    backgroundColor: colors.surface,
  },
})

export function App() {
  const single = useSinglePanel()

  return (
    <div {...stylex.props(styles.shell)}>
      {single ? <PhoneHeader /> : <LeftPanel />}
      <Stage />
      {single ? (
        <>
          <PhoneTotal />
          <PhonePanel />
        </>
      ) : (
        <RightPanel />
      )}
    </div>
  )
}
