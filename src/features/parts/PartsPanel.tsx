import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { productPriceSource } from '../../domain/catalog/products'
import { partsTotal } from '../../domain/pricing/parts'
import { editor, selectors, useEditor } from '../../editor/editor'
import { CloseButton, Sheet } from '../../ui/overlays'
import { text } from '../../ui/text'
import { colors, media } from '../../ui/tokens.stylex'

const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

const styles = stylex.create({
  panel: {
    width: 'min(440px, 100vw)',
    boxShadow: '-5px 0 20px #0002',
  },
  header: {
    display: 'flex',
    flex: 'none',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: {
      default: 96,
      [media.mobile]: 80,
    },
    padding: {
      default: '20px 32px',
      [media.mobile]: '15px 20px',
    },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: {
      default: '24px 32px',
      [media.mobile]: 20,
    },
  },
  issues: {
    marginBottom: 24,
  },
  issue: {
    display: 'flex',
    gap: 10,
    margin: '0 0 7px',
    padding: 10,
    backgroundColor: '#f2f1ef',
    fontSize: 11,
  },
  errorIssue: {
    color: '#8e2413',
  },
  badge: {
    display: 'grid',
    flex: 'none',
    placeItems: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#777',
    color: '#fff',
  },
  errorBadge: {
    backgroundColor: colors.red,
  },
  line: {
    display: 'grid',
    gridTemplateColumns: 'minmax(130px, 1fr) 28px 64px 76px',
    gap: 8,
    padding: '12px 0',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.divider,
    fontSize: 10,
  },
  columns: {
    padding: '6px 0',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontSize: 8,
  },
  figure: {
    textAlign: 'right',
    color: colors.muted,
  },
  note: {
    display: 'block',
    marginTop: 3,
    color: colors.muted,
    fontSize: 8,
    lineHeight: 1.3,
  },
  footer: {
    flex: 'none',
    padding: {
      default: '22px 32px 30px',
      [media.mobile]: '17px 20px calc(20px + env(safe-area-inset-bottom))',
    },
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  total: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: 500,
  },
  footnote: {
    margin: '12px 0 0',
    color: colors.muted,
    fontSize: 10,
  },
})

export function PartsPanel() {
  const open = useEditor((context) => context.overlay === 'parts')
  const lines = useAtom(selectors.parts)
  const issues = useAtom(selectors.issues)
  const unpriced = lines.filter((line) => line.unitPriceEur === undefined).length
  const close = () => editor.trigger.open({ overlay: null })

  return (
    <Sheet label="Parts list" isOpen={open} dimmed={false} style={styles.panel} onClose={close}>
      <header {...stylex.props(styles.header)}>
        <div>
          <p {...stylex.props(text.eyebrow)}>Your plan</p>
          <h2 {...stylex.props(text.display)}>Parts list</h2>
        </div>
        <CloseButton label="Close parts list" onPress={close} />
      </header>
      <div {...stylex.props(styles.scroll)}>
        {issues.length > 0 && (
          <div {...stylex.props(styles.issues)}>
            {issues.map((issue, index) => {
              const error = issue.severity === 'error'
              return (
                <p
                  key={`${issue.code}-${index}`}
                  {...stylex.props(styles.issue, error && styles.errorIssue)}
                >
                  <span
                    aria-hidden="true"
                    {...stylex.props(styles.badge, error && styles.errorBadge)}
                  >
                    {error ? '!' : 'i'}
                  </span>
                  {issue.message}
                </p>
              )
            })}
          </div>
        )}
        <div role="table" aria-label="Parts">
          <div role="row" {...stylex.props(styles.line, styles.columns)}>
            <span role="columnheader">Part</span>
            <span role="columnheader" {...stylex.props(styles.figure)}>
              Qty
            </span>
            <span role="columnheader" {...stylex.props(styles.figure)}>
              Unit
            </span>
            <span role="columnheader" {...stylex.props(styles.figure)}>
              Subtotal
            </span>
          </div>
          {lines.map((line) => (
            <div role="row" key={line.id} {...stylex.props(styles.line)}>
              <span role="cell">
                {line.label}
                {line.note && <small {...stylex.props(styles.note)}>{line.note}</small>}
              </span>
              <span role="cell" {...stylex.props(styles.figure)}>
                {line.quantity}
              </span>
              <span role="cell" {...stylex.props(styles.figure)}>
                {line.unitPriceEur === undefined ? '—' : money.format(line.unitPriceEur)}
              </span>
              <span role="cell" {...stylex.props(styles.figure)}>
                {line.unitPriceEur === undefined
                  ? '—'
                  : money.format(line.quantity * line.unitPriceEur)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <footer {...stylex.props(styles.footer)}>
        <div {...stylex.props(styles.total)}>
          <span>Known subtotal</span>
          <strong {...stylex.props(styles.totalValue)}>{money.format(partsTotal(lines))}</strong>
        </div>
        {unpriced > 0 && (
          <p {...stylex.props(styles.footnote)}>
            {unpriced} line{unpriced === 1 ? '' : 's'} unpriced and excluded from the subtotal.
          </p>
        )}
        <p {...stylex.props(styles.footnote)}>
          {productPriceSource.name}, Germany, August 2026. Prices include{' '}
          {Math.round(productPriceSource.vatRate * 100)}% VAT. Final specification and installation
          requirements are confirmed by Vitsœ.
        </p>
        <p {...stylex.props(styles.footnote)}>
          H-post price bands, where available, use the{' '}
          <a href="https://www.vitsoe.com/de/606/components" target="_blank" rel="noreferrer">
            current German components page
          </a>
          .
        </p>
      </footer>
    </Sheet>
  )
}
