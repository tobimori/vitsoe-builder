import { useEffect, useRef } from 'react'
import type { PartsListLine, ValidationIssue } from '../domain/types'
import { catalogPriceSource } from '../data/catalog'
import { CloseIcon, IconButton } from './Controls'

export function PartsPanel({
  open,
  lines,
  issues,
  onClose,
}: {
  open: boolean
  lines: PartsListLine[]
  issues: ValidationIssue[]
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'),
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
  const priced = lines.filter((line) => line.unitPriceEur !== undefined)
  const total = priced.reduce((sum, line) => sum + line.quantity * (line.unitPriceEur ?? 0), 0)
  const money = (value: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
  return (
    <div
      ref={panelRef}
      className={`parts-panel ${open ? 'open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Parts list"
      aria-hidden={!open}
    >
      <header>
        <div>
          <p className="eyebrow">Your plan</p>
          <h2>Parts list</h2>
        </div>
        <IconButton label="Close parts list" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </header>
      <div className="parts-scroll">
        {issues.length > 0 && (
          <div className="issue-list">
            {issues.map((issue, index) => (
              <p className={issue.severity} key={`${issue.code}-${index}`}>
                <span>{issue.severity === 'error' ? '!' : 'i'}</span>
                {issue.message}
              </p>
            ))}
          </div>
        )}
        <div className="parts-lines">
          <div className="parts-columns">
            <span>Part</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Subtotal</span>
          </div>
          {lines.map((line) => (
            <div key={line.id}>
              <span>
                {line.label}
                {line.note && <small>{line.note}</small>}
              </span>
              <span>{line.quantity}</span>
              <span>{line.unitPriceEur === undefined ? '—' : money(line.unitPriceEur)}</span>
              <span>
                {line.unitPriceEur === undefined ? '—' : money(line.quantity * line.unitPriceEur)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <footer>
        <div>
          <span>Known subtotal</span>
          <strong>{money(total)}</strong>
        </div>
        {priced.length < lines.length && (
          <p>
            {lines.length - priced.length} line{lines.length - priced.length === 1 ? '' : 's'}{' '}
            unpriced and excluded from the subtotal.
          </p>
        )}
        <p>
          {catalogPriceSource.name}, Germany, August 2026. Prices include{' '}
          {Math.round(catalogPriceSource.vatRate * 100)}% VAT. Final specification and installation
          requirements are confirmed by Vitsœ.
        </p>
        <p>
          H-post price bands, where available, use the{' '}
          <a href="https://www.vitsoe.com/de/606/components" target="_blank" rel="noreferrer">
            current German components page
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
