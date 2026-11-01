import * as stylex from '@stylexjs/stylex'
import { Button, FileTrigger } from 'react-aria-components'
import { catalog } from '../../domain/catalog/catalog'
import { parsePlan } from '../../domain/plan/codec'
import { editor, selectors } from '../../editor/editor'

async function importPlan(file: File | undefined) {
  if (!file) return

  const plan = parsePlan(await file.text(), catalog)
  if (plan) editor.trigger.load({ plan, notice: 'Plan imported.' })
  else editor.trigger.notify({ notice: 'This file is not a valid 606 plan.' })
}

function exportPlan() {
  const plan = selectors.plan.get()
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }),
  )
  const anchor = Object.assign(document.createElement('a'), {
    href: url,
    download: `${plan.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`,
  })
  anchor.click()
  URL.revokeObjectURL(url)
}

export function PlanFileActions({ style }: { style: stylex.StyleXStyles }) {
  return (
    <>
      <FileTrigger
        acceptedFileTypes={['application/json', '.json']}
        onSelect={(files) => void importPlan(files?.[0])}
      >
        <Button {...stylex.props(style)}>Import</Button>
      </FileTrigger>
      <Button onPress={exportPlan} {...stylex.props(style)}>
        Export
      </Button>
    </>
  )
}
