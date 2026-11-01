import { isWallMounted, totalCentreWidth } from '../../domain/plan/system'
import type { Plan } from '../../domain/plan/types'
import { wallLength } from '../../domain/plan/walls'
import { mm } from '../models/primitives'
import { Dimension } from '../view/Dimension'
import type { ItemPreview, SupportPreview } from './useAssemblyDrag'

/** Pin height, width and depth of the component at its drop position. */
export function ItemGuides({ preview }: { preview: ItemPreview }) {
  const { width, depth, height, x, z, face, tabletop } = preview
  const baseline = Math.max(0.08, height + preview.bottom - 0.08)

  return (
    <group position={[x, 0, z]} rotation={[0, face === 'back' ? Math.PI : 0, 0]}>
      <Dimension
        start={[-width / 2 - 0.14, 0, depth + 0.08]}
        end={[-width / 2 - 0.14, height, depth + 0.08]}
        label={`${tabletop ? 'Tabletop' : 'Pin'} ${Math.round(height * 1000)} mm`}
        labelAlign="left"
      />
      <Dimension
        start={[-width / 2, baseline, depth + 0.08]}
        end={[width / 2, baseline, depth + 0.08]}
        label={`${Math.round(width * 1000)} mm wide`}
      />
      <Dimension
        start={[width / 2 + 0.12, baseline, 0]}
        end={[width / 2 + 0.12, baseline, depth]}
        label={`${Math.round(depth * 1000)} mm deep`}
        labelAlign="right"
      />
    </group>
  )
}

/**
 * Chain dimensions in the run's own axes: from the wall's left corner to the run, the run,
 * and on to the right corner, then the distance from the wall and the ceiling height.
 * While the run is dragged they follow the preview.
 */
export function RunGuides({
  plan,
  preview,
  depth,
  room,
}: {
  plan: Plan
  preview: SupportPreview | null
  /** Distance in front of the supports, in metres; negative for the back face. */
  depth: number
  /** Without the room, only the run's own width is measured. */
  room: boolean
}) {
  const { system } = plan
  const run = totalCentreWidth(plan)
  const offset = preview?.offset ?? system.placement.offset
  const distance = preview?.distance ?? system.placement.distance
  const height = preview?.height ?? system.mountHeight
  const rest = wallLength(plan) - offset - run

  const y = Math.max(0.15, mm(height)) - 0.06
  const left = -mm(run) / 2
  const right = mm(run) / 2
  const wall = -mm(distance)

  return (
    <group>
      <Dimension
        start={[left, y, depth]}
        end={[right, y, depth]}
        label={`${run} mm · ${system.bays.length} bays`}
      />
      {room && (
        <>
          {offset > 0 && (
            <Dimension
              start={[left - mm(offset), y, depth]}
              end={[left, y, depth]}
              label={`${offset} mm`}
            />
          )}
          {rest !== 0 && (
            <Dimension
              start={[right, y, depth]}
              end={[right + mm(rest), y, depth]}
              label={`${rest} mm`}
            />
          )}
          {!isWallMounted(system.mountingType) && distance > 0 && (
            <Dimension
              start={[left - 0.12, 0.012, wall]}
              end={[left - 0.12, 0.012, 0]}
              label={`${distance} mm from the wall`}
            />
          )}
          <Dimension
            start={[right + mm(rest) - 0.08, 0, wall + 0.03]}
            end={[right + mm(rest) - 0.08, mm(plan.room.ceilingHeight), wall + 0.03]}
            label={`${plan.room.ceilingHeight} mm ceiling`}
          />
        </>
      )}
      {preview && system.mountingType === 'wall' && (
        <Dimension
          start={[left - 0.14, 0, 0]}
          end={[left - 0.14, mm(height), 0]}
          label={`Mounting height ${height} mm`}
        />
      )}
    </group>
  )
}
