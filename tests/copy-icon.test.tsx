import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { labelled } from './buttons'
import { recordCopies, recordToasts } from './clipboard-env'

const message = (text: string, surface: 'terminal' | 'desktop' = 'terminal') => ({
  plugin: 'prismantis',
  component: 'AssistantMessage' as const,
  props: { text, isFirstOfReply: true },
  viewport: { columns: 100, rows: 40 },
  surface,
})

const footer = { plugin: 'prismantis', surface: 'terminal' as const, component: 'TurnDuration' as const, props: { word: 'Cogitated', durationMs: 354000 } }

const finish = async ($: Engine, on: On, answer: string) => {
  mock.clock(on, { now: new Date(2026, 9, 10, 18, 31).getTime() })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  await $.turn.complete({ answer, durationMs: 354000, isAborted: false, turnId: 't1', reason: 'answer' })
}

test('turnWord replaces the footer word and drops the ✻', { options: { turnWord: 'Ran', clock: '24h' } }, async ($, on) => {
  await finish($, on, 'Done.')
  const ui = await $.ui.mount(footer)
  expect(await ui.find({ type: 'Text', text: /^Ran for 5m 54s · 18:31$/ })).toBeTruthy()
  await ui.unmount()
})

test('replyCopy footer puts an icon on the turn footer that copies that turn\'s whole answer', { options: { replyCopy: 'footer',copyIcon: '' } }, async ($, on) => {
  const copies = recordCopies(on)
  const toasts = recordToasts(on)
  await finish($, on, 'First part.\n\nSecond part.')
  const ui = await $.ui.mount(footer)
  const icon = await labelled(ui, 'copy reply')
  expect(icon?.props.plain).toBe(true)
  expect(icon?.text).toBe('')
  await ui.press({ key: 'turn.copy' })
  expect(copies).toEqual(['First part.\n\nSecond part.'])
  expect(toasts).toEqual(['Copied the reply'])
  await ui.unmount()
})

test('a footer whose turn was never seen has no copy icon', { options: { replyCopy: 'footer' } }, async ($, on) => {
  mock.clock(on, { now: new Date(2026, 9, 10, 18, 31).getTime() })
  const ui = await $.ui.mount(footer)
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test('replyCopy message, the default, leaves the footer without a copy icon', async ($, on) => {
  await finish($, on, 'Done.')
  const ui = await $.ui.mount(footer)
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test('with replyCopy footer a terminal reply has no copy-reply button of its own; on desktop it keeps one', { options: { replyCopy: 'footer' } }, async $ => {
  const text = 'One.\n\nTwo.'
  const terminal = await $.ui.mount(message(text))
  expect(await labelled(terminal, '⧉ copy reply')).toBeUndefined()
  await terminal.unmount()
  const desktop = await $.ui.mount(message(text, 'desktop'))
  expect(await labelled(desktop, '⧉ copy reply')).toBeTruthy()
  await desktop.unmount()
})

test('copyButtonStyle icon: a marker with one action is that action, the icon copies on click, no menu opens', { options: { copyButtonStyle: 'icon',copyIcon: '' } }, async ($, on) => {
  const copies = recordCopies(on)
  recordToasts(on)
  const ui = await $.ui.mount(message('Before.\n\n- one\n- two'))
  const icon = (await ui.findAll({ type: 'Button' })).find(button => button.props.plain && button.text === '')
  expect(icon).toBeTruthy()
  await ui.press({ key: String(icon!.props.key ?? '') })
  expect(copies).toEqual(['- one\n- two'])
  await ui.unmount()
})
