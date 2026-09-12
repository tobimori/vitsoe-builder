import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const skipNextBlur = useRef(false)
  useEffect(() => setDraft(String(value)), [value])

  const commit = () => {
    const raw = draft.trim() === '' ? Number.NaN : Math.round(Number(draft))
    if (!Number.isFinite(raw)) {
      setDraft(String(value))
      return
    }
    const next = Math.min(
      max ?? Number.POSITIVE_INFINITY,
      Math.max(min ?? Number.NEGATIVE_INFINITY, raw),
    )
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      skipNextBlur.current = true
      commit()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      skipNextBlur.current = true
      setDraft(String(value))
      event.currentTarget.blur()
    }
  }
  return (
    <label className="number-field">
      <span>{label}</span>
      <span className="number-input">
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => {
            if (skipNextBlur.current) {
              skipNextBlur.current = false
              return
            }
            commit()
          }}
          onKeyDown={handleKeyDown}
        />
        <small>mm</small>
      </span>
    </label>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? 'active' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function CloseIcon() {
  return <span aria-hidden="true">×</span>
}
