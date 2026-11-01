import * as stylex from '@stylexjs/stylex'
import type { ProductVariant } from '../../domain/catalog/types'
import { isDecorHost } from '../../domain/catalog/families'
import { DECOR_COUNT_LIMITS, decorFitsSurface } from '../../domain/decor/decor'
import type { PlanItem, ShelfDecor } from '../../domain/plan/types'
import { SelectField } from '../../ui/fields'
import { colors } from '../../ui/tokens.stylex'

const styles = stylex.create({
  editor: {
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.divider,
  },
  heading: {
    margin: '0 0 4px',
    fontSize: 15,
    fontWeight: 500,
  },
  note: {
    margin: '9px 0 0',
    color: colors.muted,
    fontSize: 12,
    lineHeight: 1.4,
  },
})

const arrangements = [
  { value: 'upright', label: 'Upright' },
  { value: 'stacked', label: 'Stacked' },
] as const

const positions = [
  { value: 'left', label: 'Left' },
  { value: 'centre', label: 'Centre' },
  { value: 'right', label: 'Right' },
] as const

export function DecorEditor({
  item,
  variant,
  onChange,
}: {
  item: PlanItem
  variant: ProductVariant
  onChange: (item: PlanItem) => void
}) {
  if (!isDecorHost(item) && !item.decor) return null

  const { decor } = item
  const fits = (kind: ShelfDecor['kind']) =>
    decorFitsSurface(
      { ...item, decor: { kind, arrangement: 'upright', count: 1, position: 'centre' } },
      variant,
    )
  const vinylFits = fits('vinyl')
  const booksFit = fits('art-books')

  const setKind = (kind: ShelfDecor['kind'] | 'none') => {
    if (kind === 'none') {
      const { decor: _, ...rest } = item
      onChange(rest)
      return
    }
    onChange({
      ...item,
      decor: {
        kind,
        arrangement: decor?.arrangement ?? 'upright',
        count: Math.min(decor?.count ?? (kind === 'vinyl' ? 8 : 4), DECOR_COUNT_LIMITS[kind]),
        position: decor?.position ?? 'centre',
      },
    })
  }

  const setDecor = (patch: Partial<ShelfDecor>) => {
    if (decor) onChange({ ...item, decor: { ...decor, ...patch } })
  }

  return (
    <section aria-labelledby="decor-heading" {...stylex.props(styles.editor)}>
      <h3 id="decor-heading" {...stylex.props(styles.heading)}>
        Decor
      </h3>
      <SelectField
        label="Contents"
        value={decor?.kind ?? 'none'}
        options={[
          { value: 'none', label: 'None' },
          { value: 'vinyl', label: 'Vinyl records', disabled: !vinylFits },
          { value: 'art-books', label: 'TASCHEN art books', disabled: !booksFit },
        ]}
        onChange={setKind}
      />
      {decor && (
        <>
          <SelectField
            label="Arrangement"
            value={decor.arrangement}
            options={arrangements}
            onChange={(arrangement) => setDecor({ arrangement })}
          />
          <SelectField
            label="Quantity"
            value={decor.count}
            options={Array.from({ length: DECOR_COUNT_LIMITS[decor.kind] }, (_, index) => ({
              value: index + 1,
              label: String(index + 1),
            }))}
            onChange={(count) => setDecor({ count })}
          />
          <SelectField
            label="Placement"
            value={decor.position}
            options={positions}
            onChange={(position) => setDecor({ position })}
          />
        </>
      )}
      {!vinylFits && !booksFit && (
        <p {...stylex.props(styles.note)}>
          This surface is too shallow for the available display objects.
        </p>
      )}
      {!vinylFits && booksFit && (
        <p {...stylex.props(styles.note)}>Vinyl needs a 360 mm deep shelf.</p>
      )}
      {decor?.kind === 'vinyl' && item.productId === 'shelf' && variant.width > 655 && (
        <p {...stylex.props(styles.note)}>
          For record storage, Vitsœ recommends the 655 × 360 mm shelf.
        </p>
      )}
    </section>
  )
}
