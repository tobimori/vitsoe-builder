import { useSyncExternalStore } from 'react'

// Matches `media.narrow` in tokens.stylex.ts
const single = window.matchMedia('(max-width: 960px), (max-height: 500px)')

const subscribe = (onChange: () => void) => {
  single.addEventListener('change', onChange)
  return () => single.removeEventListener('change', onChange)
}

/** Tablets and phones show one panel with every tab instead of panels on both sides. */
export function useSinglePanel() {
  return useSyncExternalStore(subscribe, () => single.matches)
}
