import type { On, SessionMessage } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { markTurns } from '../hooks/turns'

const prompt = (text: string): SessionMessage => ({ role: 'user', text, toolUses: [] })
const results: SessionMessage = { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 'r1', text: 'ok', isError: false }] }
const step = (text: string): SessionMessage => ({ role: 'assistant', text, toolUses: [{ tool_use_id: 'r1', tool: 'Read', input: {} }] })
const say = (text: string): SessionMessage => ({ role: 'assistant', text, toolUses: [] })

const conversation = [
  prompt('fix the bug'),
  step('I\'ll read the file first:'),
  results,
  step(''),
  results,
  step('Found it, fixing:'),
  results,
  say('Fixed: the loop was off by one.'),
  prompt('thanks'),
  say('You\'re welcome.'),
]

test('a turn\'s last text is its answer, its first its opening step, the others steps; a turn with no step records nothing', () => {
  expect(markTurns(conversation)).toEqual({
    'I\'ll read the file first:': 'first',
    'Found it, fixing:': 'step',
    'Fixed: the loop was off by one.': 'answer',
  })
})

test('a text written in more than one turn is never marked, whatever its role in each', () => {
  expect(markTurns([
    prompt('run them'),
    step('Running the tests:'),
    results,
    step('One more look:'),
    results,
    say('Done.'),
    prompt('again'),
    step('Running the tests:'),
    results,
    say('All pass.'),
    prompt('ok'),
    say('Done.'),
  ])).toEqual({ 'One more look:': 'step', 'All pass.': 'answer' })
})

test('a turn whose last message calls a tool, as when it is interrupted, has no answer', () => {
  expect(markTurns([
    prompt('fix it'),
    step('Checking:'),
    results,
    step('Now the fix:'),
    prompt('[Request interrupted by user for tool use]'),
  ])).toEqual({ 'Checking:': 'first', 'Now the fix:': 'step' })
  expect(markTurns([
    prompt('fix it'),
    step('Checking:'),
    results,
    step('Now the fix:'),
    results,
    say(''),
  ])).toEqual({ 'Checking:': 'first', 'Now the fix:': 'step' })
})

const transcript = (on: On) => on('session.messages', () => ({ value: conversation }))

const finish = async ($: Engine, on: On) => {
  const clock = mock.clock(on, { now: new Date(2026, 9, 26, 9, 30).getTime() })
  transcript(on)
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  await $.turn.complete({ answer: 'Fixed: the loop was off by one.', durationMs: 5000, isAborted: false, turnId: 't1', reason: 'answer' })
  return clock
}

for (const surface of ['terminal', 'desktop'] as const) {
  const message = (text: string, props: { isFirstOfReply?: boolean; isSummary?: true } = {}) => ({
    plugin: 'prismantis',
    component: 'AssistantMessage' as const,
    props: { text, isFirstOfReply: false, ...props },
    viewport: { columns: 100, rows: 20 },
    surface,
  })

  test(`answerMark on ${surface}: once the turn ends, a rule sits above its answer and its step lines draw dim`, { options: { answerMark: true } }, async ($, on) => {
    await finish($, on)
    const answer = await $.ui.mount(message('Fixed: the loop was off by one.'))
    expect(await answer.find({ type: 'Text', text: /^━+$/ })).toBeTruthy()
    await answer.unmount()
    const step = await $.ui.mount(message('Found it, fixing:'))
    expect((await step.find({ type: 'Text', text: /^Found it, fixing:$/ }))?.props.dimColor).toBe(true)
    expect(await step.find({ type: 'Text', text: /^━+$/ })).toBeUndefined()
    await step.unmount()
    const alone = await $.ui.mount(message('You\'re welcome.'))
    expect(await alone.find({ type: 'Text', text: /^━+$/ })).toBeUndefined()
    await alone.unmount()
  })

  test(`stepMark on ${surface}: every step line but the turn's first gets a dim thin rule; the answer keeps its heavy one`, { options: { stepMark: true, answerMark: true } }, async ($, on) => {
    await finish($, on)
    const first = await $.ui.mount(message('I\'ll read the file first:'))
    expect(await first.find({ type: 'Text', text: /^─+$/ })).toBeUndefined()
    await first.unmount()
    const later = await $.ui.mount(message('Found it, fixing:'))
    expect((await later.find({ type: 'Text', text: /^─+$/ }))?.props.dimColor).toBe(true)
    await later.unmount()
    const answer = await $.ui.mount(message('Fixed: the loop was off by one.'))
    expect(await answer.find({ type: 'Text', text: /^─+$/ })).toBeUndefined()
    expect(await answer.find({ type: 'Text', text: /^━+$/ })).toBeTruthy()
    await answer.unmount()
  })

  test(`stepMark alone on ${surface} marks steps without dimming them or ruling the answer`, { options: { stepMark: true } }, async ($, on) => {
    await finish($, on)
    const later = await $.ui.mount(message('Found it, fixing:'))
    expect(await later.find({ type: 'Text', text: /^─+$/ })).toBeTruthy()
    expect((await later.find({ type: 'Text', text: /^Found it, fixing:$/ }))?.props.dimColor).toBeUndefined()
    await later.unmount()
    const answer = await $.ui.mount(message('Fixed: the loop was off by one.'))
    expect(await answer.find({ type: 'Text', text: /^━+$/ })).toBeUndefined()
    await answer.unmount()
  })

  test(`a summary row on ${surface} counts as a step line: dimmed and ruled, never ruled as an answer`, { options: { stepMark: true, answerMark: true } }, async ($, on) => {
    await finish($, on)
    const summary = await $.ui.mount(message('Weighing the glyphs, picking a heavy rule for the answer.', { isSummary: true }))
    expect(await summary.find({ type: 'Text', text: /^─+$/ })).toBeTruthy()
    expect((await summary.find({ type: 'Text', text: /^Weighing the glyphs/ }))?.props.dimColor).toBe(true)
    await summary.unmount()
  })

  test(`the rule on ${surface} sits on its own line above the message, so the bullet stays on the text`, { options: { answerMark: true } }, async ($, on) => {
    await finish($, on)
    const ui = await $.ui.mount(message('Fixed: the loop was off by one.', { isFirstOfReply: true }))
    const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text ?? '')
    expect(texts.indexOf('●')).toBeGreaterThan(texts.findIndex(text => /^━+$/.test(text)))
    await ui.unmount()
  })

  test(`a message drawn on ${surface} while a turn runs stays unmarked until that turn ends, even with an earlier turn's text`, { options: { stepMark: true, answerMark: true } }, async ($, on) => {
    on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
    await finish($, on)
    await $.prompt.submit({ text: 'and the other loop?', wait: false, origin: { kind: 'composer' } })
    const ui = await $.ui.mount(message('Found it, fixing:'))
    expect(await ui.find({ type: 'Text', text: /^─+$/ })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /^Found it, fixing:$/ }))?.props.dimColor).toBeUndefined()
    await $.turn.complete({ answer: 'Fixed: the loop was off by one.', durationMs: 5000, isAborted: false, turnId: 't2', reason: 'answer' })
    expect(await ui.find({ type: 'Text', text: /^─+$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`a message drawn on ${surface} before a turn starts keeps its marks while that turn runs`, { options: { stepMark: true, answerMark: true } }, async ($, on) => {
    on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
    const clock = await finish($, on)
    const ui = await $.ui.mount(message('Found it, fixing:'))
    await clock.advance(1000)
    await $.prompt.submit({ text: 'and the other loop?', wait: false, origin: { kind: 'composer' } })
    expect(await ui.find({ type: 'Text', text: /^─+$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`answerMark off on ${surface}, the default, leaves every message as it was`, async ($, on) => {
    await finish($, on)
    const answer = await $.ui.mount(message('Fixed: the loop was off by one.'))
    expect(await answer.find({ type: 'Text', text: /^━+$/ })).toBeUndefined()
    await answer.unmount()
    const step = await $.ui.mount(message('Found it, fixing:'))
    expect((await step.find({ type: 'Text', text: /^Found it, fixing:$/ }))?.props.dimColor).toBeUndefined()
    await step.unmount()
  })
}
