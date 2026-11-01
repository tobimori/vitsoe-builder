import * as stylex from '@stylexjs/stylex'
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components'
import { editor, useEditor } from '../../editor/editor'
import { colors } from '../../ui/tokens.stylex'
import { RoomSettings } from './RoomSettings'
import { SystemSettings } from './SystemSettings'

const styles = stylex.create({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minHeight: 0,
    backgroundColor: colors.panel,
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    flex: 'none',
    height: 64,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: colors.neutral,
  },
  tab: {
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    color: colors.muted,
    fontSize: 15,
    cursor: 'pointer',
    outline: 'none',
  },
  selectedTab: {
    color: colors.ink,
    '::after': {
      position: 'absolute',
      right: 24,
      bottom: -1,
      left: 24,
      height: 2,
      backgroundColor: colors.ink,
      content: '""',
    },
  },
  focusedTab: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: -2,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBottom: 48,
    outline: 'none',
  },
})

const tabClassName = ({
  isSelected,
  isFocusVisible,
}: {
  isSelected: boolean
  isFocusVisible: boolean
}) =>
  stylex.props(styles.tab, isSelected && styles.selectedTab, isFocusVisible && styles.focusedTab)
    .className ?? ''

export function ConfigurationPanel() {
  const tab = useEditor((context) => context.configurationTab)

  return (
    <Tabs
      aria-label="Configuration"
      selectedKey={tab}
      onSelectionChange={(key) =>
        editor.trigger.setConfigurationTab({ tab: key === 'room' ? 'room' : 'system' })
      }
      {...stylex.props(styles.panel)}
    >
      <TabList aria-label="Edit" {...stylex.props(styles.tabs)}>
        <Tab id="system" className={tabClassName}>
          System
        </Tab>
        <Tab id="room" className={tabClassName}>
          Room
        </Tab>
      </TabList>
      <TabPanel id="system" {...stylex.props(styles.content)}>
        <SystemSettings />
      </TabPanel>
      <TabPanel id="room" {...stylex.props(styles.content)}>
        <RoomSettings />
      </TabPanel>
    </Tabs>
  )
}
