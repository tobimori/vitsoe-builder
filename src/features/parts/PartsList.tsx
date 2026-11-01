import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { productPriceSource } from '../../domain/catalog/products'
import { partsTotal } from '../../domain/pricing/parts'
import { selectors } from '../../editor/editor'
import { formatPrice, plural } from '../../ui/format'
import { text } from '../../ui/text'
import { colors, weights } from '../../ui/tokens.stylex'

const styles = stylex.create({
  list: {
    padding: '16px 20px 32px',
  },
  issues: {
    marginBottom: 20,
    padding: '12px 14px',
    backgroundColor: colors.notice,
  },
  issue: {
    margin: 0,
    fontSize: 13,
    lineHeight: '19px',
  },
  nextIssue: {
    marginTop: 6,
  },
  error: {
    color: colors.red,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    lineHeight: '20px',
  },
  cell: {
    padding: '10px 0',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    textAlign: 'left',
    verticalAlign: 'top',
  },
  head: {
    paddingTop: 0,
    paddingBottom: 8,
    color: colors.muted,
    fontSize: 13,
    fontWeight: 400,
  },
  figure: {
    paddingLeft: 12,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  note: {
    display: 'block',
    marginTop: 2,
  },
  total: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 20,
    fontSize: 17,
    lineHeight: '24px',
    fontWeight: weights.bold,
  },
  link: {
    color: colors.blue,
  },
})

/** Every part with its price, the problems to solve first, and the total. */
export function PartsList() {
  const lines = useAtom(selectors.parts)
  const issues = useAtom(selectors.issues)
  const unpriced = lines.filter((line) => line.unitPriceEur === undefined).length

  return (
    <div {...stylex.props(styles.list)}>
      {issues.length > 0 && (
        <div {...stylex.props(styles.issues)}>
          {issues.map((issue, index) => (
            <p
              key={`${issue.code}-${index}`}
              {...stylex.props(
                styles.issue,
                index > 0 && styles.nextIssue,
                issue.severity === 'error' && styles.error,
              )}
            >
              {issue.message}
            </p>
          ))}
        </div>
      )}
      <table {...stylex.props(styles.table)}>
        <thead>
          <tr>
            <th {...stylex.props(styles.cell, styles.head)}>Part</th>
            <th {...stylex.props(styles.cell, styles.head, styles.figure)}>Qty</th>
            <th {...stylex.props(styles.cell, styles.head, styles.figure)}>Price</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td {...stylex.props(styles.cell)}>
                {line.label}
                <span {...stylex.props(text.small, styles.note)}>
                  {line.unitPriceEur !== undefined && line.quantity > 1
                    ? `${formatPrice(line.unitPriceEur)} each`
                    : null}
                  {line.unitPriceEur !== undefined && line.quantity > 1 && line.note ? '. ' : null}
                  {line.note}
                </span>
              </td>
              <td {...stylex.props(styles.cell, styles.figure)}>{line.quantity}</td>
              <td {...stylex.props(styles.cell, styles.figure)}>
                {formatPrice(
                  line.unitPriceEur === undefined ? undefined : line.quantity * line.unitPriceEur,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div {...stylex.props(styles.total)}>
        <span>Total</span>
        <span {...stylex.props(text.numeric)}>{formatPrice(partsTotal(lines))}</span>
      </div>
      <p {...stylex.props(text.hint)}>
        {unpriced > 0 &&
          `${plural(unpriced, 'part')} without a price ${unpriced === 1 ? 'is' : 'are'} not included. `}
        {productPriceSource.name}, Germany, including {Math.round(productPriceSource.vatRate * 100)}
        % VAT. Vitsœ confirms the final specification.{' '}
        <a
          href="https://www.vitsoe.com/de/606/components"
          target="_blank"
          rel="noreferrer"
          {...stylex.props(styles.link)}
        >
          Current prices
        </a>
      </p>
    </div>
  )
}
