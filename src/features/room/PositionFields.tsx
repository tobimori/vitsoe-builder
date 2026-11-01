import { isWallMounted, totalCentreWidth } from '../../domain/plan/system'
import { acrossRoom, wallLength } from '../../domain/plan/walls'
import { editor, usePlan } from '../../editor/editor'
import { ActionButton } from '../../ui/buttons'
import { FieldRow, NumberField, Segmented, StaticField } from '../../ui/fields'

const walls = [
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'front', label: 'Front' },
] as const

/** The wall the system stands along, and its distances to the corners and the wall. */
export function PositionFields() {
  const plan = usePlan()
  const { mountingType, placement, mountHeight } = plan.system
  const free = wallLength(plan) - totalCentreWidth(plan)
  const centred = Math.round(free / 2)

  const move = (patch: { offset?: number; distance?: number }) =>
    editor.trigger.moveSupports({
      move: { offset: placement.offset, distance: placement.distance, mountHeight, ...patch },
    })

  return (
    <>
      <FieldRow label="Wall">
        <Segmented
          label="Wall"
          value={placement.wall}
          options={walls}
          onChange={(wall) => editor.trigger.moveToWall({ wall })}
        />
      </FieldRow>
      <NumberField
        label="From left corner"
        value={placement.offset}
        min={0}
        max={wallLength(plan)}
        onChange={(offset) => move({ offset })}
      />
      <NumberField
        label="From right corner"
        value={free - placement.offset}
        min={0}
        max={wallLength(plan)}
        onChange={(rest) => move({ offset: free - rest })}
      />
      {mountingType === 'semi-wall' && (
        <StaticField label="From the wall" value={`${placement.distance} mm, by the brackets`} />
      )}
      {!isWallMounted(mountingType) && (
        <NumberField
          label="From the wall"
          value={placement.distance}
          min={0}
          max={acrossRoom(plan)}
          onChange={(distance) => move({ distance })}
        />
      )}
      <FieldRow label="">
        <ActionButton
          variant="link"
          isDisabled={placement.offset === centred}
          onPress={() => move({ offset: centred })}
        >
          Centre on the wall
        </ActionButton>
      </FieldRow>
    </>
  )
}
