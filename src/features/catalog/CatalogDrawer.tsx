import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { Input, SearchField, ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { catalog } from '../../domain/catalog/catalog'
import type { ProductCategory } from '../../domain/catalog/types'
import { editor, useEditor, useSelectedItem } from '../../editor/editor'
import { CloseButton, Sheet } from '../../ui/overlays'
import { text } from '../../ui/text'
import { colors, media } from '../../ui/tokens.stylex'
import { categoryLabels, ProductCard } from './ProductCard'

const styles = stylex.create({
  drawer: {
    top: {
      default: 0,
      [media.mobile]: 28,
    },
    width: {
      default: 'min(920px, calc(100vw - 80px))',
      [media.mobile]: '100%',
    },
  },
  header: {
    display: 'flex',
    flex: 'none',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: {
      default: 96,
      [media.mobile]: 82,
    },
    padding: {
      default: '20px 32px',
      [media.mobile]: '16px 18px',
    },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  title: {
    fontSize: {
      default: 32,
      [media.mobile]: 22,
    },
  },
  tools: {
    flex: 'none',
    padding: {
      default: '24px 32px 0',
      [media.mobile]: '12px 18px 0',
    },
  },
  search: {
    display: 'flex',
    alignItems: 'center',
    height: 45,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#111',
  },
  searchIcon: {
    fontSize: 23,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: '0 12px',
    borderWidth: 0,
    outline: 'none',
    fontSize: 16,
  },
  categories: {
    display: 'flex',
    alignItems: 'center',
    gap: {
      default: 26,
      [media.mobile]: 20,
    },
    height: 54,
    overflowX: 'auto',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  category: {
    flex: 'none',
    height: '100%',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.muted,
    fontSize: 14,
    outlineColor: colors.blue,
  },
  activeCategory: {
    color: '#111',
    boxShadow: 'inset 0 -2px #111',
  },
  results: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: {
      default: '0 32px 60px',
      [media.mobile]: '0 18px 30px',
    },
  },
  empty: {
    padding: '40px 0',
    color: colors.muted,
  },
})

const categories = ['all', ...(Object.keys(categoryLabels) as ProductCategory[])] as const

export function CatalogDrawer() {
  const open = useEditor((context) => context.overlay === 'catalog')
  const activeFace = useEditor((context) => context.activeFace)
  const host = useSelectedItem()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProductCategory | 'all'>('all')

  const term = query.trim().toLowerCase()
  const results = catalog.products.filter(
    (product) =>
      (category === 'all' || product.category === category) &&
      (!term ||
        [
          product.name,
          product.description ?? '',
          ...product.variants.map((variant) => variant.name),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)),
  )

  return (
    <Sheet
      label="606 catalogue"
      isOpen={open}
      style={styles.drawer}
      onClose={() => editor.trigger.open({ overlay: null })}
    >
      <header {...stylex.props(styles.header)}>
        <div>
          <p {...stylex.props(text.eyebrow)}>606 Universal Shelving System</p>
          <h2 {...stylex.props(text.display, styles.title)}>Choose for the {activeFace} face</h2>
        </div>
        <CloseButton
          label="Close catalogue"
          onPress={() => editor.trigger.open({ overlay: null })}
        />
      </header>
      <div {...stylex.props(styles.tools)}>
        <SearchField
          aria-label="Search catalogue"
          value={query}
          onChange={setQuery}
          {...stylex.props(styles.search)}
        >
          <span aria-hidden="true" {...stylex.props(styles.searchIcon)}>
            ⌕
          </span>
          <Input autoFocus placeholder="Search catalogue" {...stylex.props(styles.searchInput)} />
        </SearchField>
        <ToggleButtonGroup
          aria-label="Categories"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[category]}
          onSelectionChange={(keys) =>
            setCategory(categories.find((key) => keys.has(key)) ?? 'all')
          }
          {...stylex.props(styles.categories)}
        >
          {categories.map((key) => (
            <ToggleButton
              id={key}
              key={key}
              className={({ isSelected }) =>
                stylex.props(styles.category, isSelected && styles.activeCategory).className ?? ''
              }
            >
              {key === 'all' ? 'All' : categoryLabels[key]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <div {...stylex.props(styles.results)}>
        {results.map((product) => (
          <ProductCard key={product.id} product={product} host={host} />
        ))}
        {results.length === 0 && (
          <p {...stylex.props(styles.empty)}>No components match that search.</p>
        )}
      </div>
    </Sheet>
  )
}
