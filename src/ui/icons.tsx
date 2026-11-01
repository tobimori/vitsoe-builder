const paths = {
  plus: 'M8 2.5v11M2.5 8h11',
  minus: 'M2.5 8h11',
  close: 'M3.5 3.5l9 9M12.5 3.5l-9 9',
  undo: 'M5.5 3.5L2.5 6.5l3 3M2.5 6.5h7a4 4 0 010 8h-3',
  redo: 'M10.5 3.5l3 3-3 3M13.5 6.5h-7a4 4 0 000 8h3',
  chevronDown: 'M3.5 6l4.5 4.5L12.5 6',
  arrowLeft: 'M13.5 8h-11M6.5 4L2.5 8l4 4',
  check: 'M2.5 8.5l3.5 3.5 7.5-8',
  ar: 'M8 2.5l5 2.75v5.5L8 13.5l-5-2.75v-5.5zM8 8l5-2.75M8 8v5.5M8 8L3 5.25',
  chevronRight: 'M6 3.5l4.5 4.5L6 12.5',
  face: 'M3 3.5h10v9H3z',
  bay: 'M3.5 2.5v11M12.5 2.5v11M3.5 6h9M3.5 10.5h9',
  shelves: 'M2.5 7v2.5h11V7',
  cabinets: 'M3 4.5h10v7H3zM6.5 7h3',
  tables: 'M2.5 6.5h11M4.5 6.5v6M11.5 6.5v6',
  accessories: 'M5.5 12.5v-8h1.5v8M5.5 12.5h5',
  support: 'M8 2v12M6.5 4.5h3M6.5 8h3M6.5 11.5h3',
  dimensions: 'M2.5 5v6M13.5 5v6M2.5 8h11',
} as const

export type IconName = keyof typeof paths

/** Line icons on a 16 px grid, drawn in the current text colour. */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      style={{ flex: 'none' }}
    >
      <path d={paths[name]} />
    </svg>
  )
}
