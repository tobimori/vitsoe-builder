import { BaySection } from './BaySection'
import { FinishSection } from './FinishSection'
import { PositionSection } from './PositionSection'
import { StructureSection } from './StructureSection'
import { SupportSection } from './SupportSection'
import { TrackSection } from './TrackSection'

export function SystemSettings() {
  return (
    <>
      <SupportSection />
      <FinishSection />
      <BaySection />
      <TrackSection />
      <StructureSection />
      <PositionSection />
    </>
  )
}
