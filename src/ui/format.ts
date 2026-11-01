const euros = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export function formatPrice(value: number | undefined) {
  return value === undefined ? '–' : euros.format(value)
}

export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
