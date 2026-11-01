import * as stylex from '@stylexjs/stylex'
import { CatalogDrawer } from '../features/catalog/CatalogDrawer'
import { ConfigurationPanel } from '../features/configuration/ConfigurationPanel'
import { Header } from '../features/header/Header'
import { MobileConfiguration } from '../features/mobile/MobileConfiguration'
import { MobileNav } from '../features/mobile/MobileNav'
import { Notice } from '../features/notice/Notice'
import { PartsPanel } from '../features/parts/PartsPanel'
import { Stage } from '../features/stage/Stage'
import { colors, media } from '../ui/tokens.stylex'

const styles = stylex.create({
  shell: {
    display: 'grid',
    gridTemplate: {
      default: '88px minmax(0, 1fr) / 360px minmax(0, 1fr)',
      [media.compact]: '88px minmax(0, 1fr) / 286px minmax(0, 1fr)',
      [media.mobile]: '58px minmax(0, 1fr) 58px / 1fr',
    },
    width: '100%',
    height: '100%',
    paddingBottom: {
      default: 0,
      [media.mobile]: 'env(safe-area-inset-bottom)',
    },
    backgroundColor: colors.canvas,
  },
  configuration: {
    display: {
      default: 'block',
      [media.mobile]: 'none',
    },
    minHeight: 0,
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: colors.line,
    backgroundColor: colors.panel,
  },
})

export function App() {
  return (
    <main {...stylex.props(styles.shell)}>
      <Header />
      <aside aria-label="Configuration" {...stylex.props(styles.configuration)}>
        <ConfigurationPanel />
      </aside>
      <Stage />
      <MobileNav />
      <MobileConfiguration />
      <CatalogDrawer />
      <PartsPanel />
      <Notice />
    </main>
  )
}
