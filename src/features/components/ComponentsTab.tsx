import * as stylex from '@stylexjs/stylex'
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Button, ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { catalog, isAccessory } from '../../domain/catalog/catalog'
import {
  defaultOption,
  productOptions,
  variantForBay,
  type ProductOption,
} from '../../domain/catalog/options'
import type { CatalogProduct } from '../../domain/catalog/types'
import { resolveItemFinish } from '../../domain/plan/finish'
import { isTwoSided } from '../../domain/plan/system'
import type { Plan } from '../../domain/plan/types'
import { editor, useEditor, usePlan } from '../../editor/editor'
import { CatalogPreview } from '../../scene/preview/CatalogPreview'
import { ActionButton } from '../../ui/buttons'
import { Segmented } from '../../ui/fields'
import { formatPrice } from '../../ui/format'
import { Icon } from '../../ui/icons'
import { text } from '../../ui/text'
import { colors, weights } from '../../ui/tokens.stylex'
import { variantFit, variantPrice } from './VariantList'

const categories = [
  { value: 'all', label: 'All' },
  { value: 'shelves', label: 'Shelves' },
  { value: 'cabinets', label: 'Cabinets' },
  { value: 'tables', label: 'Tables' },
] as const

type Category = (typeof categories)[number]['value']

const products = catalog.products.filter((product) => !isAccessory(product))

const styles = stylex.create({
  list: {
    padding: '16px 20px 20px',
  },
  filter: {
    marginBottom: 20,
  },
  categories: {
    display: 'grid',
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '20px 12px',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.ink,
    textAlign: 'left',
    cursor: 'pointer',
    outline: 'none',
  },
  /** A line drawing in a thin square, like the thumbnails on Vitsœ's component pages. */
  figure: {
    display: 'grid',
    placeItems: 'center',
    aspectRatio: '1',
    padding: 8,
    backgroundColor: colors.surface,
    outline: `1px solid ${colors.line}`,
    outlineOffset: -1,
    transitionProperty: 'background-color',
    transitionDuration: '0.15s',
  },
  figureHover: {
    backgroundColor: colors.band,
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: 2,
  },
  name: {
    display: 'block',
    fontSize: 14,
    lineHeight: '19px',
  },
  detail: {
    padding: '16px 20px 20px',
  },
  back: {
    marginBottom: 16,
  },
  hero: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: colors.band,
  },
  description: {
    margin: '8px 0 20px',
  },
  drag: {
    cursor: 'grab',
    touchAction: 'pan-y',
  },
  table: {
    display: 'grid',
    columnGap: 16,
    marginBottom: 20,
  },
  columns: (count: number) => ({
    gridTemplateColumns: `minmax(0, 1fr) repeat(${count}, auto)`,
  }),
  options: {
    display: 'grid',
    gridColumn: '1 / -1',
    gridTemplateColumns: 'subgrid',
  },
  row: {
    display: 'grid',
    gridColumn: '1 / -1',
    gridTemplateColumns: 'subgrid',
    alignItems: 'center',
    padding: '0 8px',
  },
  head: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    color: colors.muted,
    fontSize: 13,
  },
  price: {
    textAlign: 'right',
  },
  option: {
    minHeight: 44,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: 'transparent',
    color: colors.ink,
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
    outline: 'none',
    transitionProperty: 'background-color',
    transitionDuration: '0.15s',
  },
  optionHover: {
    backgroundColor: colors.band,
  },
  optionSelected: {
    backgroundColor: colors.band,
    fontWeight: weights.bold,
  },
  optionDisabled: {
    color: colors.faint,
    cursor: 'default',
  },
  place: {
    width: '100%',
  },
})

/**
 * Starts placing a product when it is dragged out of the catalogue with a mouse or pen.
 * Touch drags scroll the panel instead; a tap opens the product.
 */
function dragIntoView(product: CatalogProduct, option: () => string) {
  return (event: ReactPointerEvent) => {
    if (event.button !== 0 || event.pointerType === 'touch') return
    // Stops the browser from selecting text or dragging the picture as a file
    event.preventDefault()
    const start = { x: event.clientX, y: event.clientY }

    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    const move = (moved: PointerEvent) => {
      if (Math.hypot(moved.clientX - start.x, moved.clientY - start.y) < 6) return
      stop()
      editor.trigger.startPlacing({
        placing: { productId: product.id, option: option(), fromCatalogue: true },
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }
}

/** The bay widths in the system, which decide the widths and prices a product comes in. */
function bayWidths(plan: Plan) {
  return [...new Set(plan.system.bays.map((bay) => bay.centreWidth))].sort((a, b) => a - b)
}

/** An option's price in each bay width, in the columns of the price table. */
function OptionPrices({
  plan,
  product,
  option,
}: {
  plan: Plan
  product: CatalogProduct
  option: ProductOption
}) {
  return bayWidths(plan).map((width) => {
    const variant = variantForBay(option, width)
    return (
      <span key={width} {...stylex.props(styles.price, text.numeric)}>
        {variant ? formatPrice(variantPrice(plan, product, variant)) : '–'}
      </span>
    )
  })
}

function useProductPreview(product: CatalogProduct) {
  const plan = usePlan()
  const variant =
    product.variants.find((entry) => variantFit(plan, product, entry) === null) ??
    product.variants[0]
  const { finish, frontFinish } = resolveItemFinish(
    plan.system.finish,
    { productId: product.id, variantId: variant?.id ?? '', finish: 'system' },
    catalog,
  )
  return variant && { variant, finish, frontFinish }
}

function ProductTile({ product, onPress }: { product: CatalogProduct; onPress: () => void }) {
  const plan = usePlan()
  const preview = useProductPreview(product)
  const prices = product.variants
    .filter((variant) => variantFit(plan, product, variant) === null)
    .map((variant) => variantPrice(plan, product, variant))
    .filter((price) => price !== undefined)
  const from = prices.length > 0 ? Math.min(...prices) : undefined

  const option = defaultOption(product)

  return (
    <Button
      onPress={onPress}
      onPointerDownCapture={option && dragIntoView(product, () => option.key)}
      className={({ isFocusVisible }) =>
        stylex.props(styles.tile, styles.drag, isFocusVisible && styles.focused).className ?? ''
      }
    >
      {({ isHovered }) => (
        <>
          <span {...stylex.props(styles.figure, isHovered && styles.figureHover)}>
            {preview && (
              <CatalogPreview product={product} {...preview} width={280} height={280} drawing />
            )}
          </span>
          <span>
            <span {...stylex.props(styles.name)}>{product.name}</span>
            <span {...stylex.props(text.small)}>
              {from === undefined ? 'Not for this system' : `From ${formatPrice(from)}`}
            </span>
          </span>
        </>
      )}
    </Button>
  )
}

function ProductDetail({ product, onBack }: { product: CatalogProduct; onBack: () => void }) {
  const plan = usePlan()
  const preview = useProductPreview(product)
  const activeFace = useEditor((context) => context.activeFace)
  const placing = useEditor((context) =>
    context.placing?.productId === product.id ? context.placing : null,
  )
  const options = productOptions(product)
  const [chosen, setChosen] = useState(() => defaultOption(product)?.key ?? '')
  const option = placing?.option ?? chosen
  const fits = (entry: ProductOption) =>
    entry.variants.some((variant) => variantFit(plan, product, variant) === null)
  const twoSided = isTwoSided(plan.system.mountingType)
  const name = product.name.toLowerCase()

  const choose = (key: string) => {
    setChosen(key)
    if (placing) editor.trigger.startPlacing({ placing: { productId: product.id, option: key } })
  }

  return (
    <div {...stylex.props(styles.detail)}>
      <ActionButton variant="link" style={styles.back} onPress={onBack}>
        <Icon name="arrowLeft" />
        All components
      </ActionButton>
      <div
        {...stylex.props(styles.hero, styles.drag)}
        onPointerDown={dragIntoView(product, () => option)}
      >
        {preview && <CatalogPreview product={product} {...preview} width={480} height={300} />}
      </div>
      <h2 {...stylex.props(text.title)}>{product.name}</h2>
      <p {...stylex.props(text.body, styles.description)}>{product.description}</p>

      <div {...stylex.props(styles.table, styles.columns(bayWidths(plan).length))}>
        <div {...stylex.props(styles.row, styles.head)}>
          <span>{options.length > 1 ? 'Size' : 'Price'}</span>
          {bayWidths(plan).map((width) => (
            <span key={width} {...stylex.props(styles.price)}>
              {width} bay
            </span>
          ))}
        </div>
        {options.length === 1 && options[0] && (
          <div {...stylex.props(styles.row, styles.option)}>
            <span>{options[0].label || product.name}</span>
            <OptionPrices plan={plan} product={product} option={options[0]} />
          </div>
        )}
        {options.length > 1 && (
          <ToggleButtonGroup
            aria-label="Size"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[option]}
            onSelectionChange={(keys) => {
              const [key] = keys
              if (typeof key === 'string') choose(key)
            }}
            {...stylex.props(styles.options)}
          >
            {options.map((entry) => (
              <ToggleButton
                key={entry.key}
                id={entry.key}
                isDisabled={!fits(entry)}
                className={({ isHovered, isSelected, isDisabled, isFocusVisible }) =>
                  stylex.props(
                    styles.row,
                    styles.option,
                    isHovered && styles.optionHover,
                    isSelected && styles.optionSelected,
                    isDisabled && styles.optionDisabled,
                    isFocusVisible && styles.focused,
                  ).className ?? ''
                }
              >
                <span>{entry.label}</span>
                <OptionPrices plan={plan} product={product} option={entry} />
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </div>

      {placing ? (
        <ActionButton
          variant="secondary"
          style={styles.place}
          onPress={() => editor.trigger.stopPlacing()}
        >
          Done
        </ActionButton>
      ) : (
        <ActionButton
          variant="primary"
          style={styles.place}
          isDisabled={!options.some(fits)}
          onPress={() =>
            editor.trigger.startPlacing({ placing: { productId: product.id, option } })
          }
        >
          Place in view
        </ActionButton>
      )}
      <p {...stylex.props(text.hint)}>
        {placing
          ? `Choose a bay in the view to place a ${name}. Its width follows the bay.`
          : `Place it, or drag the picture into the view.${twoSided ? ` It goes on the ${activeFace} face.` : ''}`}
      </p>
    </div>
  )
}

export function ComponentsTab() {
  const [category, setCategory] = useState<Category>('all')
  const [productId, setProductId] = useState<string | null>(null)
  const product = productId ? catalog.product(productId) : undefined

  if (product) return <ProductDetail product={product} onBack={() => setProductId(null)} />

  const shown = products.filter((entry) => category === 'all' || entry.category === category)

  return (
    <div {...stylex.props(styles.list)}>
      <div {...stylex.props(styles.filter)}>
        <Segmented
          label="Category"
          value={category}
          options={categories}
          style={styles.categories}
          onChange={setCategory}
        />
      </div>
      <div {...stylex.props(styles.grid)}>
        {shown.map((entry) => (
          <ProductTile key={entry.id} product={entry} onPress={() => setProductId(entry.id)} />
        ))}
      </div>
    </div>
  )
}
