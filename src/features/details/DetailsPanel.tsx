import { useEditor, useSelectedItem } from '../../editor/editor'
import { ItemInspector } from '../inspector/ItemInspector'
import { SupportInspector } from '../inspector/SupportInspector'
import { PositionSection, RoomSection } from '../room/RoomSections'
import { BaySection } from '../system/BaySection'
import { FinishSection } from '../system/FinishSection'
import { MountingSection } from '../system/MountingSection'
import { StructureSection } from '../system/StructureSection'
import { TrackSection } from '../system/TrackSection'

/** The properties of the selection, or of the whole system and its room. */
export function DetailsPanel() {
  const selection = useEditor((context) => context.selection)
  const item = useSelectedItem()

  if (item) return <ItemInspector item={item} />
  if (selection?.type === 'support') return <SupportInspector supportIndex={selection.index} />

  return (
    <>
      <MountingSection />
      <BaySection />
      <FinishSection />
      <TrackSection />
      <StructureSection />
      <RoomSection />
      <PositionSection />
    </>
  )
}
