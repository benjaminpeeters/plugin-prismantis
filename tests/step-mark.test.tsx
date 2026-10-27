import type { On, SessionMessage } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { closeWindow, isStep, openWindow, stepTexts, toolInWindow } from '../hooks/turns'

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

test('a text with a tool call before it in its turn is a step, the answer included; one with none before it is not', () => {
  expect(stepTexts(conversation)).toEqual({ 'Found it, fixing:': true, 'Fixed: the loop was off by one.': true })
})

test('a turn that opens with tool calls and no text makes its first text a step', () => {
  expect(stepTexts([prompt('look'), step(''), results, say('Looked: all fine.')])).toEqual({ 'Looked: all fine.': true })
})

test('a text that is a step in one turn and not in another is never marked; a step in two turns stays one', () => {
  expect(stepTexts([
    prompt('run them'),
    step('Running the tests:'),
    results,
    step('One more look:'),
    results,
    say('Done.'),
    prompt('again'),
    step('Checking:'),
    results,
    step('One more look:'),
    results,
    say('All pass.'),
    prompt('ok'),
    say('Done.'),
  ])).toEqual({ 'One more look:': true, 'All pass.': true })
})

test('a turn window records its start, its first tool call and its end, and a row is a step when drawn after that tool call', () => {
  const opened = openWindow([], 't1', 100)
  expect(openWindow(opened, 't1', 150)).toBe(opened)
  const tooled = toolInWindow(opened, 200)
  expect(toolInWindow(tooled, 300)).toBe(tooled)
  expect(tooled).toEqual([{ turnId: 't1', start: 100, tool: 200 }])
  expect(closeWindow(tooled, 't0', 400)).toBe(tooled)
  const closed = closeWindow(tooled, 't1', 400)
  expect(closed).toEqual([{ turnId: 't1', start: 100, tool: 200, end: 400 }])
  expect(toolInWindow(closed, 500)).toBe(closed)
  expect(isStep(closed, {}, 150, 'x')).toBe(false)
  expect(isStep(closed, {}, 250, 'x')).toBe(true)
  expect(isStep(closed, { x: true }, 50, 'x')).toBe(true)
  expect(isStep(closed, { x: true }, 450, 'y')).toBe(false)
})

test('a new turn closes a window its turn.complete never closed, so its rows take nothing from the old turn', () => {
  const stale = toolInWindow(openWindow([], 't1', 100), 200)
  const windows = closeWindow(toolInWindow(openWindow(stale, 't2', 300), 400), 't2', 500)
  expect(windows).toEqual([{ turnId: 't1', start: 100, tool: 200, end: 300 }, { turnId: 't2', start: 300, tool: 400, end: 500 }])
  expect(isStep(windows, {}, 350, 'x')).toBe(false)
  for (const { start, tool, end } of windows) {
    expect(start <= (tool ?? start)).toBe(true)
    expect((tool ?? start) <= (end ?? Number.POSITIVE_INFINITY)).toBe(true)
  }
})

const transcript = (on: On) => on('session.messages', () => ({ value: conversation }))

const start = async ($: Engine, on: On) => {
  const clock = mock.clock(on, { now: new Date(2026, 9, 26, 9, 30).getTime() })
  transcript(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: 'ok' }))
  mock.env(on, {})
  on('session.start', () => ({ cwd: '/tmp' }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  return clock
}

const complete = ($: Engine, turnId: string) =>
  $.turn.complete({ answer: 'Fixed: the loop was off by one.', durationMs: 5000, isAborted: false, turnId, reason: 'answer' })

for (const surface of ['terminal', 'desktop'] as const) {
  const message = (text: string, props: { isFirstOfReply?: boolean; isSummary?: true } = {}) => ({
    plugin: 'prismantis',
    component: 'AssistantMessage' as const,
    props: { text, isFirstOfReply: false, ...props },
    viewport: { columns: 100, rows: 20 },
    surface,
  })
  const rule = { type: 'Text', text: /^─+$/ } as const
  const ask = (id: string) => ({
    plugin: 'prismantis',
    component: 'ToolUse' as const,
    props: { tool_use_id: id, tool: 'AskUserQuestion', input: { questions: [] }, isRunning: false, isErrored: false, isInterrupted: false },
    viewport: { columns: 100, rows: 20 },
    surface,
  })

  test(`stepMark on ${surface}: a row drawn in a running turn gets its rule from the turn's tool calls, and keeps it when the turn ends`, { options: { stepMark: true } }, async ($, on) => {
    const clock = await start($, on)
    await $.turn.start({ text: 'fix the other loop', turnId: 't1' })
    const opening = await $.ui.mount(message('Looking at it:'))
    await clock.advance(1000)
    await $.tool.call({ tool: 'Read', file_path: '/tmp/a.ts' })
    const answer = await $.ui.mount(message('Fixed it too.'))
    expect(await opening.find(rule)).toBeUndefined()
    expect((await answer.find(rule))?.props.dimColor).toBe(true)
    expect((await answer.find({ type: 'Text', text: /^Fixed it too\.$/ }))?.props.dimColor).toBeUndefined()
    await clock.advance(1000)
    await complete($, 't1')
    expect(await opening.find(rule)).toBeUndefined()
    expect(await answer.find(rule)).toBeTruthy()
    expect(await answer.find({ type: 'Text', text: /^━+$/ })).toBeUndefined()
    await opening.unmount()
    await answer.unmount()
  })

  test(`a subagent's tool call on ${surface} makes no step of the main turn's next row`, { options: { stepMark: true } }, async ($, on) => {
    const clock = await start($, on)
    await $.turn.start({ text: 'look around', turnId: 't1' })
    await $.tool.call({ tool: 'Read', file_path: '/tmp/a.ts', agentId: 'helper' })
    await clock.advance(1000)
    const ui = await $.ui.mount(message('Nothing there.'))
    expect(await ui.find(rule)).toBeUndefined()
    await ui.unmount()
  })

  test(`a row drawn on ${surface} outside any turn takes its mark from the transcript read at session start`, { options: { stepMark: true } }, async ($, on) => {
    await start($, on)
    const opening = await $.ui.mount(message('I\'ll read the file first:'))
    expect(await opening.find(rule)).toBeUndefined()
    await opening.unmount()
    const later = await $.ui.mount(message('Found it, fixing:'))
    expect(await later.find(rule)).toBeTruthy()
    await later.unmount()
    const answer = await $.ui.mount(message('Fixed: the loop was off by one.'))
    expect(await answer.find(rule)).toBeTruthy()
    await answer.unmount()
  })

  test(`a row drawn on ${surface} before a turn starts keeps its mark through that turn`, { options: { stepMark: true } }, async ($, on) => {
    const clock = await start($, on)
    const ui = await $.ui.mount(message('Found it, fixing:'))
    await clock.advance(1000)
    await $.turn.start({ text: 'and the other loop?', turnId: 't1' })
    await $.tool.call({ tool: 'Read', file_path: '/tmp/a.ts' })
    expect(await ui.find(rule)).toBeTruthy()
    await complete($, 't1')
    expect(await ui.find(rule)).toBeTruthy()
    await ui.unmount()
  })

  test(`a summary row on ${surface} is always a step: ruled and dimmed, live too`, { options: { stepMark: true } }, async ($, on) => {
    await start($, on)
    await $.turn.start({ text: 'think first', turnId: 't1' })
    const summary = await $.ui.mount(message('Weighing the glyphs, picking a thin rule.', { isSummary: true }))
    expect(await summary.find(rule)).toBeTruthy()
    expect((await summary.find({ type: 'Text', text: /^Weighing the glyphs/ }))?.props.dimColor).toBe(true)
    await summary.unmount()
  })

  test(`the rule on ${surface} sits on its own line above the message, so the bullet stays on the text`, { options: { stepMark: true } }, async ($, on) => {
    await start($, on)
    const ui = await $.ui.mount(message('Fixed: the loop was off by one.', { isFirstOfReply: true }))
    const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text ?? '')
    expect(texts.indexOf('●')).toBeGreaterThan(texts.findIndex(text => /^─+$/.test(text)))
    await ui.unmount()
  })

  test(`stepMark off on ${surface}, the default, leaves every message as it was`, async ($, on) => {
    const clock = await start($, on)
    await $.turn.start({ text: 'fix it', turnId: 't1' })
    await $.tool.call({ tool: 'Read', file_path: '/tmp/a.ts' })
    await clock.advance(1000)
    const step = await $.ui.mount(message('Found it, fixing:'))
    expect(await step.find(rule)).toBeUndefined()
    await step.unmount()
    const summary = await $.ui.mount(message('Weighing the glyphs.', { isSummary: true }))
    expect(await summary.find(rule)).toBeUndefined()
    expect((await summary.find({ type: 'Text', text: /^Weighing the glyphs/ }))?.props.dimColor).toBeUndefined()
    await summary.unmount()
  })

  test(`stepMark on ${surface} draws a thin rule above a question row with askAlign left`, { options: { stepMark: true } }, async ($, on) => {
    await start($, on)
    const left = await $.ui.mount(ask('q-1'))
    expect((await left.find(rule))?.props.dimColor).toBe(true)
    await left.unmount()
  })

  test(`stepMark on ${surface} draws no rule above a question row with askAlign right, which sits with the tool rows`, { options: { stepMark: true, askAlign: 'right' } }, async ($, on) => {
    await start($, on)
    const ui = await $.ui.mount(ask('q-2'))
    expect(await ui.find(rule)).toBeUndefined()
    await ui.unmount()
  })

  test(`stepMark off on ${surface} draws no rule above a question row`, async ($, on) => {
    await start($, on)
    const ui = await $.ui.mount(ask('q-3'))
    expect(await ui.find(rule)).toBeUndefined()
    await ui.unmount()
  })
}
