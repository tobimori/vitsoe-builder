import * as stylex from '@stylexjs/stylex'
import { createAtom } from '@xstate/store'
import { useAtom } from '@xstate/store-react'
import { useState, type ReactNode } from 'react'
import { Button } from 'react-aria-components'
import { catalog } from '../../domain/catalog/catalog'
import { parsePlan } from '../../domain/plan/codec'
import type { Plan } from '../../domain/plan/types'
import { usePlan } from '../../editor/editor'
import { library, storedPlan, type SavedPlan } from '../../editor/library'
import { newPlan, openPlan, removePlan } from '../../editor/sync'
import { buildAssembly } from '../../scene/models/assembly'
import { DrawingPreview } from '../../scene/preview/CatalogPreview'
import { ActionButton } from '../../ui/buttons'
import { plural } from '../../ui/format'
import { SheetDialog } from '../../ui/overlays'
import { Tabs } from '../../ui/tabs'
import { text } from '../../ui/text'
import { colors, media, weights } from '../../ui/tokens.stylex'
import { inspirations, type Inspiration } from './inspirations'

/** Whether the library is open; the plan menu and the plan's name open it. */
export const libraryOpen = createAtom(false)

const close = () => libraryOpen.set(false)

type Shelf = 'plans' | 'inspiration'

const PREVIEW = { width: 360, height: 240 }
const PAIRED_PREVIEW = { width: 320, height: 240 }

const styles = stylex.create({
  head: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 20,
    padding: {
      default: '28px 72px 0 32px',
      [media.narrow]: '20px 64px 0 20px',
    },
  },
  tabs: {
    margin: {
      default: '12px 32px 0',
      [media.narrow]: '8px 20px 0',
    },
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: {
      default: '24px 32px 40px',
      [media.narrow]: '20px 20px 32px',
    },
  },
  intro: {
    maxWidth: 620,
    margin: '0 0 24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '32px 24px',
  },
  pairs: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(400px, 100%), 1fr))',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  thumb: {
    display: 'block',
    width: '100%',
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: colors.line,
      ':hover': colors.faint,
    },
    backgroundColor: colors.surface,
    cursor: 'pointer',
    outline: 'none',
  },
  media: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  photoFrame: {
    position: 'relative',
    backgroundColor: colors.surface,
  },
  photo: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbCurrent: {
    borderColor: {
      default: colors.ink,
      ':hover': colors.ink,
    },
  },
  thumbFocused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: colors.blue,
    outlineOffset: 2,
  },
  name: {
    margin: '12px 0 0',
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: weights.bold,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: '19px',
  },
  description: {
    margin: '6px 0 0',
    color: colors.ink,
    fontSize: 13,
    lineHeight: '19px',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0 16px',
    marginTop: 4,
  },
  source: {
    color: colors.muted,
    fontSize: 13,
    textDecoration: {
      default: 'none',
      ':hover': 'underline',
    },
  },
})

const sameDay = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const otherDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

function savedAt(time: number) {
  const date = new Date(time)
  return date.toDateString() === new Date().toDateString()
    ? sameDay.format(date)
    : otherDay.format(date)
}

function summary(plan: Plan) {
  const components = plan.system.items.filter((item) => !item.parentItemId).length
  return `${plural(plan.system.bays.length, 'bay')} · ${plural(components, 'component')}`
}

function Card({
  name,
  meta,
  plan,
  previewKey,
  photo,
  current = false,
  action,
  children,
  onOpen,
}: {
  name: string
  meta: string
  plan: Plan
  previewKey: string
  /** A photograph of the real system, shown beside the drawing of the plan. */
  photo?: { src: string; alt: string }
  current?: boolean
  action: string
  children: ReactNode
  onOpen: () => void
}) {
  const size = photo ? PAIRED_PREVIEW : PREVIEW
  const drawing = (
    <Button
      aria-label={`${action}: ${name}`}
      onPress={onOpen}
      className={({ isFocusVisible }) =>
        stylex.props(
          styles.thumb,
          current && styles.thumbCurrent,
          isFocusVisible && styles.thumbFocused,
        ).className ?? ''
      }
    >
      <DrawingPreview
        cacheKey={`library-${previewKey}`}
        alt=""
        width={size.width}
        height={size.height}
        build={() => buildAssembly(plan, catalog)}
      />
    </Button>
  )

  return (
    <article {...stylex.props(styles.card)}>
      {photo ? (
        <div {...stylex.props(styles.media)}>
          <div {...stylex.props(styles.photoFrame)}>
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              {...stylex.props(styles.photo)}
            />
          </div>
          {drawing}
        </div>
      ) : (
        drawing
      )}
      <h3 {...stylex.props(styles.name)}>{name}</h3>
      <span {...stylex.props(styles.meta)}>{meta}</span>
      {children}
    </article>
  )
}

function SavedPlanCard({ entry, current }: { entry: SavedPlan; current: boolean }) {
  const live = usePlan()
  const [confirming, setConfirming] = useState(false)
  const plan = current ? live : parsePlan(storedPlan(entry.id) ?? '', catalog)
  if (!plan) return null

  const open = () => {
    if (!current) openPlan(entry.id)
    close()
  }

  return (
    <Card
      name={current ? live.name : entry.name}
      meta={current ? 'Open now' : savedAt(entry.saved)}
      plan={plan}
      previewKey={`${entry.id}-${entry.saved}`}
      current={current}
      action="Open"
      onOpen={open}
    >
      <p {...stylex.props(styles.description)}>{summary(plan)}</p>
      <div {...stylex.props(styles.actions)}>
        {confirming ? (
          <>
            <ActionButton variant="danger" onPress={() => removePlan(entry.id)}>
              Delete for good
            </ActionButton>
            <ActionButton variant="link" onPress={() => setConfirming(false)}>
              Keep
            </ActionButton>
          </>
        ) : (
          <>
            {!current && (
              <ActionButton variant="link" onPress={open}>
                Open
              </ActionButton>
            )}
            <ActionButton
              variant="link"
              onPress={() => newPlan(plan, `Copy of ${plan.name} started.`)}
            >
              Copy
            </ActionButton>
            <ActionButton variant="danger" onPress={() => setConfirming(true)}>
              Delete
            </ActionButton>
          </>
        )}
      </div>
    </Card>
  )
}

function InspirationCard({ inspiration }: { inspiration: Inspiration }) {
  const use = () => {
    newPlan(structuredClone(inspiration.plan), `${inspiration.name} added to your plans.`)
    close()
  }

  return (
    <Card
      name={inspiration.name}
      meta={inspiration.room}
      plan={inspiration.plan}
      previewKey={`inspiration-${inspiration.id}`}
      photo={{ src: inspiration.photo, alt: `${inspiration.name}, as photographed` }}
      action="Start a plan from"
      onOpen={use}
    >
      <p {...stylex.props(styles.description)}>{inspiration.description}</p>
      <div {...stylex.props(styles.actions)}>
        <ActionButton variant="link" onPress={use}>
          Use this
        </ActionButton>
        <a
          href={inspiration.source.url}
          target="_blank"
          rel="noreferrer"
          {...stylex.props(styles.source)}
        >
          {inspiration.source.label}
        </a>
      </div>
    </Card>
  )
}

/** The plans saved in this browser, and popular systems to start from. */
export function LibraryDialog() {
  const isOpen = useAtom(libraryOpen)
  const { current, plans } = useAtom(library)
  const [shelf, setShelf] = useState<Shelf>('plans')
  // The plan being edited is saved shortly after it changes; show it before its first save
  const entries = plans.some((entry) => entry.id === current)
    ? plans
    : [{ id: current, name: '', saved: 0 }, ...plans]

  return (
    <SheetDialog label="Library" isOpen={isOpen} onClose={close}>
      <div {...stylex.props(styles.head)}>
        <h2 {...stylex.props(text.display)}>Library</h2>
        <ActionButton
          variant="link"
          onPress={() => {
            newPlan()
            close()
          }}
        >
          New plan
        </ActionButton>
      </div>
      <Tabs
        label="Library"
        value={shelf}
        tabs={[
          { value: 'plans', label: `Your plans (${entries.length})` },
          { value: 'inspiration', label: 'Inspiration' },
        ]}
        style={styles.tabs}
        onChange={setShelf}
      />
      <div {...stylex.props(styles.body)}>
        {shelf === 'plans' ? (
          <>
            <p {...stylex.props(text.body, styles.intro)}>
              Plans are saved in this browser as you work. Share a plan’s link to open it on another
              device.
            </p>
            <div {...stylex.props(styles.grid)}>
              {entries.map((entry) => (
                <SavedPlanCard key={entry.id} entry={entry} current={entry.id === current} />
              ))}
            </div>
          </>
        ) : (
          <>
            <p {...stylex.props(text.body, styles.intro)}>
              Popular 606 systems, rebuilt from photographs in Vitsœ’s gallery and on Are.na. Start
              a plan from one, then make it fit your wall.
            </p>
            <div {...stylex.props(styles.grid, styles.pairs)}>
              {inspirations.map((inspiration) => (
                <InspirationCard key={inspiration.id} inspiration={inspiration} />
              ))}
            </div>
          </>
        )}
      </div>
    </SheetDialog>
  )
}
