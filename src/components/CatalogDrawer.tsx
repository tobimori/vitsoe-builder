import { useEffect, useMemo, useRef, useState } from 'react'
import { priceForVariant } from '../data/catalog'
import { isAccessory, resolveItemFinish } from '../domain/products'
import type { BuilderDocument, CatalogProduct, Face, ProductCategory } from '../domain/types'
import { CatalogPreview } from '../scene/ComponentPreview'
import { CloseIcon, IconButton } from './Controls'

const categoryLabels: Record<ProductCategory, string> = {
  shelves: 'Shelves',
  cabinets: 'Cabinets',
  tables: 'Tables',
  accessories: 'Accessories',
}

export function CatalogDrawer({
  open,
  document: builderDocument,
  catalog,
  bayWidth,
  availableBayWidths,
  activeFace,
  selectedHostProductId,
  onClose,
  onAdd,
}: {
  open: boolean
  document: BuilderDocument
  catalog: CatalogProduct[]
  bayWidth: 667 | 912
  availableBayWidths: (667 | 912)[]
  activeFace: Face
  selectedHostProductId?: string
  onClose: () => void
  onAdd: (productId: string, variantId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProductCategory | 'all'>('all')
  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    return catalog.filter(
      (product) =>
        (category === 'all' || product.category === category) &&
        (!term ||
          `${product.name} ${product.description ?? ''} ${product.variants.map((variant) => variant.name).join(' ')}`
            .toLowerCase()
            .includes(term)),
    )
  }, [catalog, category, query])
  const drawerRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !drawerRef.current) return
      const focusable = [
        ...drawerRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]'),
      ]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', trapFocus)
    return () => window.removeEventListener('keydown', trapFocus)
  }, [open])

  return (
    <div className={`drawer-layer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <button
        className="drawer-scrim"
        type="button"
        aria-label="Close catalogue"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="catalog-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="606 catalogue"
      >
        <header className="drawer-header">
          <div>
            <p className="eyebrow">606 Universal Shelving System</p>
            <h2>Choose for the {activeFace} face</h2>
          </div>
          <IconButton label="Close catalogue" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </header>
        <div className="catalog-tools">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search catalogue"
            />
          </label>
          <div className="category-filter" role="list" aria-label="Categories">
            <button
              className={category === 'all' ? 'active' : ''}
              type="button"
              onClick={() => setCategory('all')}
            >
              All
            </button>
            {(Object.keys(categoryLabels) as ProductCategory[]).map((key) => (
              <button
                className={category === key ? 'active' : ''}
                type="button"
                key={key}
                onClick={() => setCategory(key)}
              >
                {categoryLabels[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="catalog-results">
          {results.map((product) => {
            const previewVariant =
              product.variants.find((variant) =>
                variant.bayCentres?.some((centre) => availableBayWidths.includes(centre)),
              ) ?? product.variants[0]
            const previewFinish = resolveItemFinish(
              builderDocument,
              {
                productId: product.id,
                variantId: previewVariant.id,
                finishOverride: 'system',
              },
              catalog,
            )

            return (
              <article className="product-card" key={product.id}>
                <div className="product-figure">
                  {open && (
                    <CatalogPreview
                      product={product}
                      variant={previewVariant}
                      finish={previewFinish.finish}
                      frontFinish={previewFinish.frontFinish}
                    />
                  )}
                </div>
                <div className="product-copy">
                  <p className="eyebrow">{categoryLabels[product.category]}</p>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="variant-list">
                    {product.variants.map((variant) => {
                      const resolved = resolveItemFinish(
                        builderDocument,
                        {
                          productId: product.id,
                          variantId: variant.id,
                          finishOverride: 'system',
                        },
                        catalog,
                      )
                      const hostFits =
                        !isAccessory(product) ||
                        Boolean(
                          selectedHostProductId &&
                          product.compatibleHosts?.includes(selectedHostProductId),
                        )
                      const fits =
                        hostFits &&
                        (isAccessory(product)
                          ? variant.width <= (bayWidth === 667 ? 655 : 900)
                          : Boolean(
                              variant.bayCentres?.some((centre) =>
                                availableBayWidths.includes(centre),
                              ),
                            ))
                      const price = priceForVariant(variant, resolved.finish)
                      const priceLabel =
                        price === undefined
                          ? 'price unavailable'
                          : `${price.toLocaleString('de-DE')} €`
                      return (
                        <button
                          type="button"
                          key={variant.id}
                          disabled={!fits}
                          onClick={() => onAdd(product.id, variant.id)}
                        >
                          <span>{variant.name}</span>
                          <small>
                            {variant.width} × {variant.depth} mm · {priceLabel}
                            {!hostFits
                              ? ' · select a compatible host'
                              : fits
                                ? ''
                                : ' · does not fit'}
                          </small>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </article>
            )
          })}
          {results.length === 0 && <p className="empty-state">No components match that search.</p>}
        </div>
      </aside>
    </div>
  )
}
