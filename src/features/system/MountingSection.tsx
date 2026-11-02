import * as stylex from '@stylexjs/stylex'
import { catalog } from '../../domain/catalog/catalog'
import { initialPlan } from '../../domain/plan/defaults'
import { changeMountingType } from '../../domain/plan/system'
import type { Plan, PlanItem } from '../../domain/plan/types'
import type { MountingType } from '../../domain/types'
import { editor, usePlan } from '../../editor/editor'
import { buildAssembly } from '../../scene/models/assembly'
import { DrawingPreview } from '../../scene/preview/CatalogPreview'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'
import { TileGroup } from '../../ui/tiles'

const mountings: { value: MountingType; label: string; description: string }[] = [
  {
    value: 'wall',
    label: 'Wall-mounted',
    description: 'E-tracks screwed to a solid wall carry everything.',
  },
  {
    value: 'semi-wall',
    label: 'Semi wall-mounted',
    description:
      'Posts stand on the floor and are tied to the wall, for walls that can’t take the weight.',
  },
  {
    value: 'floor-to-ceiling',
    label: 'Floor-to-ceiling',
    description: 'Posts are held between floor and ceiling. Components can face either side.',
  },
  {
    value: 'freestanding',
    label: 'Freestanding',
    description:
      'Posts stand on feet, with nothing fixed to the wall. Components can face either side.',
  },
]

/** Two bays of shelves, drawn in each mounting type like Vitsœ's system illustrations. */
function sample(mountingType: MountingType): Plan {
  const items = [0, 1].flatMap((bayIndex) =>
    [555, 905, 1255].map((height): PlanItem => ({
      id: `${bayIndex}-${height}`,
      productId: 'shelf',
      variantId: 'steel-667-300',
      bayIndex,
      height,
      face: 'front',
      finish: 'system',
      orientation: 'standard',
    })),
  )

  return changeMountingType(
    {
      ...initialPlan,
      room: { ...initialPlan.room, ceilingHeight: 2200 },
      system: {
        ...initialPlan.system,
        bays: [
          { id: 'left', centreWidth: 667 },
          { id: 'right', centreWidth: 667 },
        ],
        items,
      },
    },
    mountingType,
  )
}

const styles = stylex.create({
  drawing: {
    width: '100%',
  },
})

export function MountingSection() {
  const { mountingType } = usePlan().system
  const current = mountings.find((mounting) => mounting.value === mountingType)

  return (
    <Section title="Mounting">
      <TileGroup
        label="Mounting"
        value={mountingType}
        columns={2}
        options={mountings.map((mounting) => ({
          value: mounting.value,
          label: mounting.label,
          visual: (
            <span {...stylex.props(styles.drawing)}>
              <DrawingPreview
                cacheKey={`mounting-${mounting.value}`}
                alt=""
                width={360}
                height={360}
                build={() => buildAssembly(sample(mounting.value), catalog)}
              />
            </span>
          ),
        }))}
        onChange={(value) => {
          if (value) editor.trigger.changeMountingType({ mountingType: value })
        }}
      />
      <p {...stylex.props(text.hint)}>{current?.description}</p>
    </Section>
  )
}
