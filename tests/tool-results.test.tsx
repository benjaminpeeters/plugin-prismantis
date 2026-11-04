import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { agentDefinition, continuesLaunch } from '../hooks/render'
import { labelled } from './buttons'
import { claudeAt } from './claude-version'

const engine = (on: On) => on('ui.render', ($, e) => {
  const { Text } = $.ui.resolve(e)
  return <Text>engine</Text>
})

const inApp = (on: On, messages: unknown[] = [], agents: unknown[] = []) => {
  mock.env(on, { HOME: '/home/demo' })
  on('session.root', () => ({ value: '/home/demo/app' }))
  on('session.messages', () => ({ value: messages as never }))
  on('agent.list', () => ({ value: agents as never }))
  claudeAt(on, '2.1.295')
}

const SUBAGENTS = [{ id: 'a1b2', type: 'general-purpose', description: 'Look around', status: 'completed' }]

const QUESTIONS = [{
  question: 'Which scope should I review?',
  header: 'Scope',
  multiSelect: false,
  options: [{ label: 'This session', description: 'The files this session edited.' }, { label: 'Everything', description: 'All changes.' }],
}]

const ASKED = { questions: QUESTIONS, answers: { 'Which scope should I review?': 'This session' }, annotations: { 'Which scope should I review?': { notes: 'keep it small' } } }

const asideIn = async (ui: { findAll: (q: { type: 'Box' }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Box' })).some(node => node.props.justifyContent === 'flex-end')

for (const surface of ['terminal', 'desktop'] as const) {
  const view = { plugin: 'prismantis', surface, viewport: { columns: 120, rows: 40 } }
  const skillRow = { ...view, component: 'ToolUse' as const, props: { tool_use_id: 's-1', tool: 'Skill', input: { skill: 'demo' }, output: { success: true }, isRunning: false, isErrored: false, isInterrupted: false } }
  const skillResult = { ...view, component: 'ToolResult' as const, props: { tool_use_id: 's-1', tool: 'Skill', output: { success: true }, isErrored: false } }
  const askRow = { ...view, component: 'ToolUse' as const, props: { tool_use_id: 'a-1', tool: 'AskUserQuestion', input: { questions: QUESTIONS }, output: ASKED, isRunning: false, isErrored: false, isInterrupted: false } }
  const askResult = { ...view, component: 'ToolResult' as const, props: { tool_use_id: 'a-1', tool: 'AskUserQuestion', output: ASKED, isErrored: false } }

  test(`an AskUserQuestion row keeps its name and says what was asked and answered, on the left with askIcon in the reply gutter on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(askRow)
    expect(await row.find({ type: 'Text', text: /^AskUserQuestion$/ })).toBeTruthy()
    expect(await row.find({ type: 'Text', text: /^Scope: This session$/ })).toBeTruthy()
    expect(await row.find({ type: 'Text', text: /^\?$/ })).toBeTruthy()
    expect(await asideIn(row)).toBe(false)
    await row.unmount()
    const asking = await $.ui.mount({ ...askRow, props: { ...askRow.props, output: undefined, isRunning: true } })
    expect(await asking.find({ type: 'Text', text: /^Scope$/ })).toBeTruthy()
    await asking.unmount()
  })

  test(`askAlign right puts the AskUserQuestion row with the other tool rows, askIcon after it on ${surface}`, { options: { askAlign: 'right' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(askRow)
    expect(await asideIn(row)).toBe(true)
    expect(await row.find({ type: 'Text', text: /^ \?$/ })).toBeTruthy()
    await row.unmount()
    const answers = await $.ui.mount(askResult)
    expect(await asideIn(answers)).toBe(true)
    await answers.unmount()
  })

  const agentRow = { ...view, component: 'ToolUse' as const, props: { tool_use_id: 'g-1', tool: 'Agent', input: { description: 'Review the diff', prompt: 'Review it.' }, output: { status: 'completed' }, isRunning: false, isErrored: false, isInterrupted: false } }
  const agentResult = { ...view, component: 'ToolResult' as const, props: { tool_use_id: 'g-1', tool: 'Agent', output: { status: 'completed' }, isErrored: false } }
  const peer = { ...view, component: 'UserMessage' as const, props: { text: 'beta: version 0.35.2\nmore', origin: { kind: 'peer' as const }, from: { name: 'general-purpose' }, isExpanded: false } }

  test(`a subagent row sits on the right by default, agentIcon and the whole text in agentColor blue, not dimmed (agentTint row) on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(agentRow)
    expect(await asideIn(row)).toBe(true)
    expect((await row.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('blue')
    const verb = await row.find({ type: 'Text', text: /^Delegated$/ })
    expect(verb?.props.color).toBe('blue')
    expect(verb?.props.dimColor).toBe(false)
    expect((await row.find({ type: 'Text', text: /^Review the diff$/ }))?.props.color).toBe('blue')
    await row.unmount()
  })

  test(`agentTint icon colors the glyph alone and dims the text like other tool rows on ${surface}`, { options: { agentTint: 'icon' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(agentRow)
    expect((await row.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('blue')
    const verb = await row.find({ type: 'Text', text: /^Delegated$/ })
    expect(verb?.props.color).toBeUndefined()
    expect(verb?.props.dimColor).toBe(true)
    await row.unmount()
  })

  test(`agentTint icon leaves a subagent's message text uncolored, its reply glyph in agentColor on ${surface}`, { options: { agentTint: 'icon' } }, async ($, on) => {
    engine(on)
    inApp(on, [], SUBAGENTS)
    const message = await $.ui.mount(peer)
    expect((await message.find({ type: 'Text', text: /^ «$/ }))?.props.color).toBe('blue')
    expect(await message.find({ type: 'Text', text: /^from subagent: general-purpose · beta: version 0\.35\.2$/ })).toBeTruthy()
    expect((await message.find({ type: 'Text', text: /^ · beta: version 0\.35\.2$/ }))?.props.color).toBeUndefined()
    expect((await message.find({ type: 'Text', text: /^from subagent: $/ }))?.props.color).toBeUndefined()
    await message.unmount()
  })

  test(`agentTint none leaves the glyph in the usual tool row colors and the text uncolored on ${surface}`, { options: { agentTint: 'none', numberColor: '#00aa00' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(agentRow)
    expect((await row.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('#00aa00')
    expect((await row.find({ type: 'Text', text: /^Delegated$/ }))?.props.color).toBeUndefined()
    await row.unmount()
    const notice = await $.ui.mount({ ...view, component: 'UserMessage', props: { text: 'Agent "Count files" finished', origin: { kind: 'task-notification' }, task: { status: 'completed' }, isExpanded: false } })
    expect((await notice.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('#00aa00')
    await notice.unmount()
  })

  test(`agentIcon replaces toolIcon on a subagent row on ${surface}`, { options: { agentIcon: '@' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(agentRow)
    expect(await row.find({ type: 'Text', text: /^ @$/ })).toBeTruthy()
    await row.unmount()
  })

  const sendRow = { ...view, component: 'ToolUse' as const, props: { tool_use_id: 'm-1', tool: 'SendMessage', input: { to: 'a1b2', summary: 'Ask beta for the default', message: 'Follow-up 1' }, output: { success: true }, isRunning: false, isErrored: false, isInterrupted: false } }

  test(`a SendMessage to one of this session's agents reads to subagent: with its type in bold and its summary, agentIcon in agentColor on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on, [], SUBAGENTS)
    const row = await $.ui.mount(sendRow)
    expect(await asideIn(row)).toBe(true)
    expect(await row.find({ type: 'Text', text: /^to subagent: general-purpose · Ask beta for the default$/ })).toBeTruthy()
    expect((await row.find({ type: 'Text', text: /^general-purpose$/ }))?.props.bold).toBe(true)
    expect((await row.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('blue')
    await row.unmount()
  })

  test(`a message from one of this session's agents reads from subagent: with its type in bold, agentReplyIcon in agentColor on the right on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on, [], SUBAGENTS)
    const ui = await $.ui.mount(peer)
    expect(await asideIn(ui)).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^from subagent: general-purpose · beta: version 0\.35\.2$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /^general-purpose$/ }))?.props.bold).toBe(true)
    expect((await ui.find({ type: 'Text', text: /^ «$/ }))?.props.color).toBe('blue')
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
    await ui.unmount()
  })

  const fromSession = { ...peer, props: { ...peer.props, text: 'review stage: 7 of 7 jobs submitted', from: { name: 'plugin-prismantis-d8' } } }
  const toSession = { ...sendRow, props: { ...sendRow.props, tool_use_id: 'm-2', input: { to: 'plugin-prismantis-d8', summary: 'Ask for its status', message: 'Where are you?' } } }

  test(`a message from another session reads from session: with its name in bold, sessionReplyIcon in sessionColor on the right on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on, [], SUBAGENTS)
    const ui = await $.ui.mount(fromSession)
    expect(await asideIn(ui)).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^from session: plugin-prismantis-d8 · review stage: 7 of 7 jobs submitted$/ })).toBeTruthy()
    const head = await ui.find({ type: 'Text', text: /^from session: $/ })
    expect(head?.props.color).toBe('magenta')
    expect(head?.props.bold).toBeFalsy()
    expect((await ui.find({ type: 'Text', text: /^ · review stage: 7 of 7 jobs submitted$/ }))?.props.color).toBe('magenta')
    expect((await ui.find({ type: 'Text', text: /^plugin-prismantis-d8$/ }))?.props.bold).toBe(true)
    expect((await ui.find({ type: 'Text', text: /^ ⇠$/ }))?.props.color).toBe('magenta')
    await ui.unmount()
  })

  test(`a SendMessage to another session reads to session: with its name in bold, sessionIcon in sessionColor on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on, [], SUBAGENTS)
    const row = await $.ui.mount(toSession)
    expect(await row.find({ type: 'Text', text: /^to session: plugin-prismantis-d8 · Ask for its status$/ })).toBeTruthy()
    expect((await row.find({ type: 'Text', text: /^ ⇢$/ }))?.props.color).toBe('magenta')
    await row.unmount()
  })

  test(`sessionAlign left puts session rows with Claude's replies while subagent rows stay right, and sessionTint none drops their color on ${surface}`, { options: { sessionAlign: 'left', sessionTint: 'none' } }, async ($, on) => {
    engine(on)
    inApp(on, [], SUBAGENTS)
    const session = await $.ui.mount(fromSession)
    expect(await asideIn(session)).toBe(false)
    expect((await session.find({ type: 'Text', text: /^from session: $/ }))?.props.color).toBeUndefined()
    await session.unmount()
    const agent = await $.ui.mount(peer)
    expect(await asideIn(agent)).toBe(true)
    await agent.unmount()
  })

  test(`a failed send to a session draws its quiet failure on the sessionAlign side, not the agentAlign one, on ${surface}`, { options: { sessionAlign: 'left', toolOutput: 'quiet' } }, async ($, on) => {
    engine(on)
    inApp(on, [], SUBAGENTS)
    const row = await $.ui.mount(toSession)
    expect(await asideIn(row)).toBe(false)
    await row.unmount()
    const failure = await $.ui.mount({ ...view, component: 'ToolResult', props: { tool_use_id: toSession.props.tool_use_id, tool: 'SendMessage', output: 'No session named plugin-prismantis-d8', isErrored: true } })
    expect(await failure.find({ type: 'Text', text: /No session named/ })).toBeTruthy()
    expect(await asideIn(failure)).toBe(false)
    await failure.unmount()
  })

  test(`a message from one of this session's agents follows agentAlign left, and the expanded view keeps Claude Code's drawing on ${surface}`, { options: { agentAlign: 'left' } }, async ($, on) => {
    engine(on)
    inApp(on, [], SUBAGENTS)
    const ui = await $.ui.mount(peer)
    expect(await asideIn(ui)).toBe(false)
    expect((await ui.find({ type: 'Text', text: /^general-purpose$/ }))?.props.color).toBe('blue')
    await ui.unmount()
    const open = await $.ui.mount({ ...peer, props: { ...peer.props, isExpanded: true } })
    expect(await open.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await open.unmount()
  })

  test(`a subagent's finished notice uses agentIcon and agentColor and follows agentAlign, a shell's keeps toolIcon on ${surface}`, { options: { agentAlign: 'left' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const agent = await $.ui.mount({ ...view, component: 'UserMessage', props: { text: 'Agent "Count files" finished', origin: { kind: 'task-notification' }, task: { status: 'completed', durationMs: 9000 }, isExpanded: false } })
    expect(await asideIn(agent)).toBe(false)
    expect((await agent.find({ type: 'Text', text: /^»$/ }))?.props.color).toBe('blue')
    await agent.unmount()
    const shell = await $.ui.mount({ ...view, component: 'UserMessage', props: { text: 'Background command "npm test" completed', origin: { kind: 'task-notification' }, task: { status: 'completed' }, isExpanded: false } })
    expect(await asideIn(shell)).toBe(true)
    expect(await shell.find({ type: 'Text', text: /^ ●$/ })).toBeTruthy()
    await shell.unmount()
  })

  test(`agentAlign left puts a subagent row and its result with Claude's replies, the glyph in the gutter and the name in agentColor on ${surface}`, { options: { agentAlign: 'left', agentColor: '#3366ff' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(agentRow)
    expect(await asideIn(row)).toBe(false)
    expect((await row.find({ type: 'Text', text: /^»$/ }))?.props.color).toBe('#3366ff')
    expect((await row.find({ type: 'Text', text: /^Delegated$/ }))?.props.color).toBe('#3366ff')
    await row.unmount()
    const result = await $.ui.mount(agentResult)
    expect(await asideIn(result)).toBe(false)
    expect(await result.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await result.unmount()
  })

  test(`a failed subagent row keeps the failure color, not agentColor, and agentColor empty uses the accent on ${surface}`, { options: { agentColor: '', accentColor: '#ff8800', codeFlagColor: '#ff0000' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const done = await $.ui.mount(agentRow)
    expect((await done.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('#ff8800')
    await done.unmount()
    const failed = await $.ui.mount({ ...agentRow, props: { ...agentRow.props, tool_use_id: 'g-2', isErrored: true } })
    expect((await failed.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('#ff0000')
    await failed.unmount()
  })

  test(`a row asking several questions counts them, then names each with its answer on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const two = [...QUESTIONS, { ...QUESTIONS[0]!, question: 'Run the tests?', header: 'Tests' }]
    const row = await $.ui.mount({ ...askRow, props: { ...askRow.props, input: { questions: two }, output: { ...ASKED, questions: two } } })
    expect(await row.find({ type: 'Text', text: /^2 questions · Scope: This session · Tests$/ })).toBeTruthy()
    await row.unmount()
    const answers = await $.ui.mount({ ...askResult, props: { ...askResult.props, output: { ...ASKED, questions: two } } })
    expect(await answers.find({ type: 'Text', text: /^1\/2 Scope$/ })).toBeTruthy()
    expect(await answers.find({ type: 'Text', text: /^2\/2 Tests$/ })).toBeTruthy()
    expect(await answers.find({ type: 'Text', text: /^– no answer$/ })).toBeTruthy()
    await answers.unmount()
  })

  test(`the answers of a question show each option with its description, the pick marked, and the note on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(askResult)
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^Scope$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^✓$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /^This session$/ }))?.props.color).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^Which scope should I review\?$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /^The files this session edited\.$/ }))?.props.dimColor).toBe(true)
    expect((await ui.find({ type: 'Text', text: /^Everything$/ }))?.props.dimColor).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^2\.$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^All changes\.$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^note: keep it small$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`a multi-select answer marks each picked option, a label with a comma included, and its typed part as the next option, trimmed on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const several = [{ ...QUESTIONS[0]!, multiSelect: true, options: [{ label: 'Left, with replies' }, { label: 'Numbering' }, { label: 'Notes' }] }]
    const output = { questions: several, answers: { [QUESTIONS[0]!.question]: 'Left, with replies, Numbering,  my own words' } }
    const ui = await $.ui.mount({ ...askResult, props: { ...askResult.props, output } })
    expect((await ui.findAll({ type: 'Text', text: /^✓$/ })).length).toBe(3)
    expect((await ui.find({ type: 'Text', text: /^Left, with replies$/ }))?.props.dimColor).toBe(false)
    expect((await ui.find({ type: 'Text', text: /^Notes$/ }))?.props.dimColor).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^4\.$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^my own words$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^your own answer$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`a long answer is cut to 40 characters in the folded row, and the row text sits in a shrinking box so it stays one line on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const long = 'word '.repeat(30).trim()
    const row = await $.ui.mount({ ...askRow, props: { ...askRow.props, output: { ...ASKED, answers: { [QUESTIONS[0]!.question]: long } } } })
    expect(await row.find({ type: 'Text', text: new RegExp(`^Scope: ${long.slice(0, 39)}…$`) })).toBeTruthy()
    expect((await row.findAll({ type: 'Box' })).some(node => node.props.flexShrink === 1)).toBe(true)
    await row.unmount()
  })

  test(`a declined question says so in its row and lists what was asked on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount({ ...askRow, props: { ...askRow.props, output: undefined, isErrored: true, isInterrupted: true } })
    expect(await row.find({ type: 'Text', text: /^ declined$/ })).toBeTruthy()
    await row.unmount()
    const ui = await $.ui.mount({ ...askResult, props: { ...askResult.props, output: 'The user declined.', isErrored: true } })
    expect(await ui.find({ type: 'Text', text: /^Declined$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^Scope$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`toolResults shown leaves a result Claude Code draws as it draws it, since Claude Code refuses a sized box above its own drawing, on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(skillResult)
    expect(await asideIn(ui)).toBe(false)
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await ui.unmount()
  })

  const launched = { ...agentResult, props: { ...agentResult.props, tool_use_id: 'g-3', output: { status: 'async_launched', agentId: 'a-1' } } }

  const launchRow = { ...agentRow, props: { ...agentRow.props, tool_use_id: 'g-3', input: { description: 'Count files', prompt: 'Count.', subagent_type: 'general-purpose', run_in_background: true }, output: { status: 'async_launched', agentId: 'a-1' } } }

  test(`a background launch reads as Claude Code's own line in agentColor, its type and description below in the plain text color with no branch glyph on the right, as a subagent row on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(launchRow)
    expect(await asideIn(row)).toBe(true)
    expect((await row.find({ type: 'Text', text: /^background agents launched \(↓ to manage\)$/ }))?.props.color).toBe('blue')
    expect(await row.find({ type: 'Text', text: /└/ })).toBeUndefined()
    const branch = await row.find({ type: 'Text', text: /^general-purpose \(Count files\) {2}$/ })
    expect(branch?.props.color).toBeUndefined()
    expect(branch?.props.dimColor).toBe(false)
    expect((await row.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('blue')
    expect(await row.find({ type: 'Text', text: /^Delegated$/ })).toBeUndefined()
    await row.unmount()
  })

  test(`with agentAlign left a background launch sits with the replies, its branch under it on ${surface}`, { options: { agentAlign: 'left' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(launchRow)
    expect(await asideIn(row)).toBe(false)
    expect(await row.find({ type: 'Text', text: /^└ general-purpose \(Count files\)$/ })).toBeTruthy()
    await row.unmount()
  })

  test(`a background launch's result draws nothing, as its row says it, and ctrl+o shows Claude Code's own on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(launched)
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
    await ui.unmount()
    const open = await $.ui.mount({ ...launched, props: { ...launched.props, isExpanded: true } })
    expect(await open.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await open.unmount()
  })

  test(`a foreground Agent call keeps the Delegated row on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(agentRow)
    expect(await row.find({ type: 'Text', text: /^Delegated$/ })).toBeTruthy()
    expect(await row.find({ type: 'Text', text: /background agents launched/ })).toBeUndefined()
    await row.unmount()
  })

  test(`an Agent call asked to run in the background whose output says it ran to completion keeps the Delegated row on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount({ ...launchRow, props: { ...launchRow.props, tool_use_id: 'f-0', output: { status: 'completed' } } })
    expect(await row.find({ type: 'Text', text: /^Delegated$/ })).toBeTruthy()
    expect(await row.find({ type: 'Text', text: /background agents launched/ })).toBeUndefined()
    await row.unmount()
  })

  test(`a background Agent call that failed, was interrupted or is still running keeps the Delegated row with its ending, not a launch row, on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    for (const [id, state] of [['f-1', { isErrored: true }], ['f-2', { isInterrupted: true }], ['f-3', { isRunning: true, output: undefined }]] as const) {
      const row = await $.ui.mount({ ...launchRow, props: { ...launchRow.props, tool_use_id: id, ...state } })
      expect(await row.find({ type: 'Text', text: /^Delegated$/ })).toBeTruthy()
      expect(await row.find({ type: 'Text', text: /background agents launched/ })).toBeUndefined()
      await row.unmount()
    }
  })

  test(`toolResults folded hides a result behind its row until the row is clicked on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const shown = async () => {
      const ui = await $.ui.mount(skillResult)
      const found = !!(await ui.find({ type: 'Text', text: /^engine$/ }))
      await ui.unmount()
      return found
    }
    expect(await shown()).toBe(false)
    const row = await $.ui.mount(skillRow)
    expect(await labelled(row, 'show result')).toBeTruthy()
    await row.press({ key: 'rowfold.rows' })
    expect(await shown()).toBe(true)
    expect(await labelled(row, 'hide result')).toBeTruthy()
    await row.unmount()
  })

  test(`toolResults folded still shows a failed call's result, and its row carries no toggle on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...skillResult, props: { ...skillResult.props, isErrored: true } })
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await ui.unmount()
    const row = await $.ui.mount({ ...skillRow, props: { ...skillRow.props, isErrored: true } })
    expect(await labelled(row, 'show result')).toBeUndefined()
    await row.unmount()
  })

  test(`shell output and edit diffs keep their own drawing on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...skillResult, props: { ...skillResult.props, tool: 'Bash', output: { stdout: 'a', stderr: '', interrupted: false } } })
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    expect(await asideIn(ui)).toBe(false)
    await ui.unmount()
  })

  test(`outside toolStyle chat a result is left as Claude Code draws it on ${surface}`, { options: { toolStyle: 'tree-dim', toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(skillResult)
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    expect(await asideIn(ui)).toBe(false)
    await ui.unmount()
  })

  const notice = { ...view, component: 'UserMessage' as const, props: { text: 'Agent "Commit the fork" finished', origin: { kind: 'task-notification' as const }, task: { status: 'completed', durationMs: 129000 }, isExpanded: false } }

  test(`a task notification draws as a tool row on the right: its summary, its duration, a glyph colored by how it ended on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(notice)
    expect(await asideIn(ui)).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^Agent "Commit the fork" finished · 2m 9s$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`outside toolStyle chat a task notification is left as Claude Code draws it on ${surface}`, { options: { toolStyle: 'tree-dim' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(notice)
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`askColor colors a question row's glyph, its name and its questions' headers on ${surface}`, { options: { askColor: '#ff8800' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(askRow)
    expect((await row.find({ type: 'Text', text: /^\?$/ }))?.props.color).toBe('#ff8800')
    expect((await row.find({ type: 'Text', text: /^AskUserQuestion$/ }))?.props.color).toBe('#ff8800')
    await row.unmount()
    const answers = await $.ui.mount(askResult)
    expect((await answers.find({ type: 'Text', text: /^Scope$/ }))?.props.color).toBe('#ff8800')
    await answers.unmount()
  })

  test(`askColor unset uses the accent color for the glyph, the name and the headers, while picked answers keep the number color on ${surface}`, { options: { accentColor: '#ff8800', numberColor: '#00aa00' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(askRow)
    expect((await row.find({ type: 'Text', text: /^\?$/ }))?.props.color).toBe('#ff8800')
    expect((await row.find({ type: 'Text', text: /^AskUserQuestion$/ }))?.props.color).toBe('#ff8800')
    await row.unmount()
    const answers = await $.ui.mount(askResult)
    expect((await answers.find({ type: 'Text', text: /^Scope$/ }))?.props.color).toBe('#ff8800')
    expect((await answers.find({ type: 'Text', text: /^This session$/ }))?.props.color).toBe('#00aa00')
    await answers.unmount()
  })

  test(`a failed question that you did not decline shows its error, unfolded, not as a decline on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount({ ...askRow, props: { ...askRow.props, output: undefined, isErrored: true } })
    expect(await row.find({ type: 'Text', text: /^ failed$/ })).toBeTruthy()
    await row.unmount()
    const ui = await $.ui.mount({ ...askResult, props: { ...askResult.props, output: 'Invalid input', isErrored: true } })
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^Declined$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`a declined question folds like its answers with toolResults folded on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount({ ...askRow, props: { ...askRow.props, output: undefined, isErrored: true, isInterrupted: true } })
    expect(await labelled(row, 'show result')).toBeTruthy()
    await row.unmount()
    const ui = await $.ui.mount({ ...askResult, props: { ...askResult.props, output: 'User rejected tool use', isErrored: true } })
    expect(await ui.find({ type: 'Text', text: /^Declined$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`a result under an expanded group stays shown with toolResults folded, as its row has no toggle on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const group = await $.ui.mount({ ...view, component: 'ToolGroup', props: { calls: [{ ...skillRow.props }], isActive: false, isExpanded: true } })
    await group.unmount()
    const ui = await $.ui.mount(skillResult)
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`a multi-select pick matches whole options only, so Test is not picked with Tests on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const several = [{ ...QUESTIONS[0]!, multiSelect: true, options: [{ label: 'Test' }, { label: 'Tests' }] }]
    const output = { questions: several, answers: { [QUESTIONS[0]!.question]: 'Tests' } }
    const ui = await $.ui.mount({ ...askResult, props: { ...askResult.props, output } })
    expect((await ui.findAll({ type: 'Text', text: /^✓$/ })).length).toBe(1)
    expect((await ui.find({ type: 'Text', text: /^Test$/ }))?.props.dimColor).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^your own answer$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`with toolResults folded, the expanded view (ctrl+o) shows a result and its row carries no toggle on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount({ ...skillRow, props: { ...skillRow.props, isExpanded: true } })
    expect(await labelled(row, 'show result')).toBeUndefined()
    await row.unmount()
    const ui = await $.ui.mount({ ...skillResult, props: { ...skillResult.props, isExpanded: true } })
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`a declined question is recognised from its result alone, drawn before its row on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...askResult, props: { ...askResult.props, tool_use_id: 'a-2', output: 'User rejected tool use', isErrored: true } })
    expect(await ui.find({ type: 'Text', text: /^Declined$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`a blank answer counts as no answer on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...askResult, props: { ...askResult.props, output: { ...ASKED, answers: { [QUESTIONS[0]!.question]: '  ' } } } })
    expect(await ui.find({ type: 'Text', text: /^✓$/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^– no answer$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`the folded row clips a long answer by terminal cells, never inside a wide glyph on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const wide = '日本語'.repeat(20)
    const row = await $.ui.mount({ ...askRow, props: { ...askRow.props, output: { ...ASKED, answers: { [QUESTIONS[0]!.question]: wide } } } })
    const shown = (await row.find({ type: 'Text', text: /^Scope: / }))?.text ?? ''
    expect(shown.endsWith('…')).toBe(true)
    expect(shown.length).toBe('Scope: '.length + 19 + 1)
    await row.unmount()
  })

  test(`a decline told only by its output gets the row toggle and folds its result alike with toolResults folded on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount({ ...askRow, props: { ...askRow.props, tool_use_id: 'a-3', output: 'User rejected tool use', isErrored: true } })
    expect(await labelled(row, 'show result')).toBeTruthy()
    expect(await row.find({ type: 'Text', text: /^ declined$/ })).toBeTruthy()
    await row.unmount()
    const ui = await $.ui.mount({ ...askResult, props: { ...askResult.props, tool_use_id: 'a-3', output: 'User rejected tool use', isErrored: true } })
    expect(await ui.find({ type: 'Text', text: /^Declined$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`an interrupted call's row and result agree: a toggle on the row, the result folded with toolResults folded on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount({ ...skillRow, props: { ...skillRow.props, tool_use_id: 's-9', isErrored: true, isInterrupted: true } })
    expect(await labelled(row, 'show result')).toBeTruthy()
    await row.unmount()
    const ui = await $.ui.mount({ ...skillResult, props: { ...skillResult.props, tool_use_id: 's-9', isErrored: true } })
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`a blank answer leaves the row's header without a colon on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount({ ...askRow, props: { ...askRow.props, output: { ...ASKED, answers: { [QUESTIONS[0]!.question]: ' ' } } } })
    expect(await row.find({ type: 'Text', text: /^Scope$/ })).toBeTruthy()
    await row.unmount()
  })

  test(`an Edit row still running, before its output exists, draws as prismantis's row on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...view, component: 'ToolUse', props: { tool_use_id: 'e-1', tool: 'Edit', input: { file_path: '/home/demo/app/src/a.ts', old_string: 'a', new_string: 'b' }, isRunning: true, isErrored: false, isInterrupted: false } })
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^Edited$/ })).toBeTruthy()
    await ui.unmount()
  })
}

const terminal = { plugin: 'prismantis', surface: 'terminal' as const, viewport: { columns: 120, rows: 40 } }
const running = (id: string, tool: string, input: Record<string, unknown>) =>
  ({ ...terminal, component: 'ToolUse' as const, props: { tool_use_id: id, tool, input, isRunning: true, isErrored: false, isInterrupted: false } })
const hintFor = (id: string) => ({ ...terminal, component: 'ToolProgress' as const, props: { tool_use_id: id, kind: 'background_hint' as const, hint: '(ctrl+b to run in background)' } })

const hintAside = async ($: Engine, row: ReturnType<typeof running>) => {
  const drawn = await $.ui.mount(row)
  await drawn.unmount()
  const ui = await $.ui.mount(hintFor(row.props.tool_use_id))
  const found = { aside: await asideIn(ui), engine: !!(await ui.find({ type: 'Text', text: /^engine$/ })), hint: !!(await ui.find({ type: 'Text', text: /^\(ctrl\+b to run in background\)$/ })) }
  await ui.unmount()
  return found
}

test('the run-in-background hint sits on the right under a shell row on the right', async ($, on) => {
  engine(on)
  inApp(on)
  expect(await hintAside($, running('h-1', 'Bash', { command: 'npm test' }))).toEqual({ aside: true, engine: false, hint: true })
})

test('the run-in-background hint of a subagent row sits on the right with its row by default', async ($, on) => {
  engine(on)
  inApp(on)
  expect(await hintAside($, running('h-5', 'Agent', { description: 'Review', prompt: 'Review it.' }))).toEqual({ aside: true, engine: false, hint: true })
})

test('with agentAlign left the run-in-background hint of a subagent row is left as Claude Code draws it, a shell row keeping it on the right', { options: { agentAlign: 'left' } }, async ($, on) => {
  engine(on)
  inApp(on)
  expect(await hintAside($, running('h-2', 'Agent', { description: 'Review', prompt: 'Review it.' }))).toEqual({ aside: false, engine: true, hint: false })
  expect(await hintAside($, running('h-3', 'Bash', { command: 'npm test' }))).toEqual({ aside: true, engine: false, hint: true })
})

test('outside toolStyle chat the run-in-background hint is left as Claude Code draws it', { options: { toolStyle: 'tree-dim' } }, async ($, on) => {
  engine(on)
  inApp(on)
  expect(await hintAside($, running('h-4', 'Bash', { command: 'npm test' }))).toEqual({ aside: false, engine: true, hint: false })
})

test('a hint for a call never drawn is left as Claude Code draws it', async ($, on) => {
  engine(on)
  inApp(on)
  const ui = await $.ui.mount(hintFor('h-unknown'))
  expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
  await ui.unmount()
})

const agentFiles = (on: On, files: Record<string, string>) => {
  const dirs = new Set(Object.keys(files).map(p => p.slice(0, p.lastIndexOf('/'))))
  on('fs.exists', (_, e) => ({ value: e.path in files || dirs.has(e.path) }))
  on('fs.list', (_, e) => ({ value: Object.keys(files).filter(p => p.slice(0, p.lastIndexOf('/')) === e.path).map(p => ({ name: p.slice(p.lastIndexOf('/') + 1), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }))
  on('fs.read', (_, e) => (e.path in files ? { value: files[e.path]! } : { deny: `no such file ${e.path}` }))
}

const COLORED = {
  '/home/demo/.claude/plugins/installed_plugins.json': JSON.stringify({ version: 2, plugins: { 'feature-dev@official': [{ installPath: '/home/demo/.claude/plugins/cache/feature-dev/1.0.1' }] } }),
  '/home/demo/.claude/plugins/cache/feature-dev/1.0.1/agents/code-explorer.md': '---\nname: code-explorer\ndescription: Explores.\ncolor: yellow\n---\nYou explore.',
  '/home/demo/.claude/agents/weekly-news.md': '---\nname: weekly-news\ncolor: pink\n---\nNews.',
  '/home/demo/.claude/agents/plain.md': '---\nname: plain\n---\nNo color.',
}

const wide = { ...terminal, viewport: { columns: 140, rows: 40 } }

const launchCall = (id: string, description: string, type = 'general-purpose') => ({ tool_use_id: id, tool: 'Agent', input: { description, prompt: 'Go.', subagent_type: type, run_in_background: true }, result: { status: 'async_launched' } })

const launchOf = (id: string, type: string, description = 'Look around') => {
  const { result, ...call } = launchCall(id, description, type)
  return { ...wide, component: 'ToolUse' as const, props: { ...call, output: result, isRunning: false, isErrored: false, isInterrupted: false } }
}

test('an agent definition gives its name and its color as Claude Code draws it; no name falls back to the file, an unknown color to none', () => {
  expect(agentDefinition('---\nname: code-explorer\ncolor: yellow\n---\nbody', 'x.md')).toEqual({ name: 'code-explorer', color: '#ca8a04' })
  expect(agentDefinition('---\ncolor: "Pink"\n---\n', 'critic.md')).toEqual({ name: 'critic', color: '#c46686' })
  expect(agentDefinition('---\nname: a\ncolor: teal\n---\n', 'a.md')).toEqual({ name: 'a' })
  expect(agentDefinition('no frontmatter', 'b.md')).toEqual({ name: 'b' })
})

test('a background launch draws its agent type as a badge in the color its definition sets, a plugin agent and a user agent alike', async ($, on) => {
  engine(on)
  inApp(on)
  agentFiles(on, COLORED)
  const plugin = await $.ui.mount(launchOf('c-1', 'feature-dev:code-explorer'))
  const badge = await plugin.find({ type: 'Text', text: /^feature-dev:code-explorer$/ })
  expect(badge?.props.backgroundColor).toBe('#ca8a04')
  expect(badge?.props.color).toBe('#000000')
  await plugin.unmount()
  const user = await $.ui.mount(launchOf('c-2', 'weekly-news'))
  expect((await user.find({ type: 'Text', text: /^weekly-news$/ }))?.props.backgroundColor).toBe('#c46686')
  await user.unmount()
})

test('an agent whose definition sets no color, or that has no definition, draws its type plain', async ($, on) => {
  engine(on)
  inApp(on)
  agentFiles(on, COLORED)
  for (const [id, type] of [['c-3', 'plain'], ['c-4', 'general-purpose']] as const) {
    const ui = await $.ui.mount(launchOf(id, type))
    const name = await ui.find({ type: 'Text', text: new RegExp(`^${type}$`) })
    expect(name).toBeTruthy()
    expect(name?.props.backgroundColor).toBeUndefined()
    await ui.unmount()
  }
})

const peerFrom = (name: string) => ({ ...wide, component: 'UserMessage' as const, props: { text: 'explorer: 24 files', origin: { kind: 'peer' as const }, from: { name }, isExpanded: false } })

test('a message from a colored agent of this session draws its sender as the same badge', async ($, on) => {
  engine(on)
  inApp(on, [], [{ id: 'a-1', type: 'feature-dev:code-explorer', description: 'Look', status: 'completed' }])
  agentFiles(on, COLORED)
  const ui = await $.ui.mount(peerFrom('feature-dev:code-explorer'))
  expect((await ui.find({ type: 'Text', text: /^feature-dev:code-explorer$/ }))?.props.backgroundColor).toBe('#ca8a04')
  expect(await ui.find({ type: 'Text', text: /^from subagent: feature-dev:code-explorer · explorer: 24 files$/ })).toBeTruthy()
  await ui.unmount()
})

test('a session named like an agent type that is not one of this session\'s agents draws as a session, with no badge', async ($, on) => {
  engine(on)
  inApp(on)
  agentFiles(on, COLORED)
  const ui = await $.ui.mount(peerFrom('weekly-news'))
  expect((await ui.find({ type: 'Text', text: /^weekly-news$/ }))?.props.backgroundColor).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^from session: weekly-news · explorer: 24 files$/ })).toBeTruthy()
  await ui.unmount()
})

test('a row keeps the direction it was first drawn with once its subagent leaves the agent list', async ($, on) => {
  engine(on)
  const agents: unknown[] = [{ id: 'a-7', type: 'feature-dev:code-explorer', description: 'Look', status: 'completed' }]
  inApp(on, [], agents)
  const first = await $.ui.mount({ ...peerFrom('feature-dev:code-explorer'), requestId: 'u-1' })
  expect(await first.find({ type: 'Text', text: /^from subagent: / })).toBeTruthy()
  await first.unmount()
  agents.length = 0
  const again = await $.ui.mount({ ...peerFrom('feature-dev:code-explorer'), requestId: 'u-1' })
  expect(await again.find({ type: 'Text', text: /^from subagent: / })).toBeTruthy()
  await again.unmount()
})

test('a symlinked agent definition gives its color like a regular file', async ($, on) => {
  engine(on)
  inApp(on)
  const files: Record<string, string> = { '/home/demo/.claude/agents/linked.md': '---\nname: linked\ncolor: green\n---\nLinked.' }
  on('fs.exists', (_, e) => ({ value: e.path in files || e.path === '/home/demo/.claude/agents' }))
  on('fs.list', (_, e) => ({ value: e.path === '/home/demo/.claude/agents' ? [{ name: 'linked.md', kind: 'other' as const, size: 0, mtimeMs: 0, isLink: true }] : [] }))
  on('fs.read', (_, e) => (e.path in files ? { value: files[e.path]! } : { deny: `no such file ${e.path}` }))
  const ui = await $.ui.mount(launchOf('c-9', 'linked'))
  expect((await ui.find({ type: 'Text', text: /^linked$/ }))?.props.backgroundColor).toBe('#16a34a')
  await ui.unmount()
})

test('a finished notice is a subagent row when its call was an Agent call, whatever its words', async ($, on) => {
  engine(on)
  inApp(on)
  const launch = await $.ui.mount(launchOf('t-1', 'general-purpose'))
  await launch.unmount()
  const notice = await $.ui.mount({ ...wide, component: 'UserMessage', props: { text: 'Subagent "Count files" is done', origin: { kind: 'task-notification' }, task: { status: 'completed', toolUseId: 't-1' }, isExpanded: false } })
  expect((await notice.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('blue')
  await notice.unmount()
})

const turn = (...messages: { role: 'user' | 'assistant'; text: string; toolUses?: ReturnType<typeof launchCall>[] }[]) => messages.map(m => ({ toolUses: [], ...m }))

test('a launch continues the run when the row above it is another launch, with no text between', () => {
  const messages = turn(
    { role: 'assistant', text: 'Launching three.', toolUses: [launchCall('l-1', 'one')] },
    { role: 'user', text: '' },
    { role: 'assistant', text: '', toolUses: [launchCall('l-2', 'two')] },
    { role: 'user', text: '' },
    { role: 'assistant', text: 'And a third, after some words.', toolUses: [launchCall('l-3', 'three')] },
  )
  expect(continuesLaunch(messages, 'l-1')).toBe(false)
  expect(continuesLaunch(messages, 'l-2')).toBe(true)
  expect(continuesLaunch(messages, 'l-3')).toBe(false)
  expect(continuesLaunch(turn({ role: 'assistant', text: 'Words, then two.', toolUses: [launchCall('l-6', 'a'), launchCall('l-7', 'b')] }), 'l-7')).toBe(true)
  expect(continuesLaunch(messages, 'l-9')).toBeUndefined()
})

test('a launch after a shell call or a prompt starts a new run', () => {
  const messages = turn(
    { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'b-1', tool: 'Bash', input: { command: 'ls' } } as unknown as ReturnType<typeof launchCall>] },
    { role: 'user', text: '' },
    { role: 'assistant', text: '', toolUses: [launchCall('l-4', 'four')] },
    { role: 'user', text: 'a prompt' },
    { role: 'assistant', text: '', toolUses: [launchCall('l-5', 'five')] },
  )
  expect(continuesLaunch(messages, 'l-4')).toBe(false)
  expect(continuesLaunch(messages, 'l-5')).toBe(false)
})

test('a launch that continues a run draws only its type and description, no header; the first one keeps the header', async ($, on) => {
  engine(on)
  inApp(on, turn(
    { role: 'assistant', text: 'Launching two.', toolUses: [launchCall('r-1', 'first')] },
    { role: 'user', text: '' },
    { role: 'assistant', text: '', toolUses: [launchCall('r-2', 'second')] },
  ))
  const first = await $.ui.mount(launchOf('r-1', 'general-purpose', 'first'))
  expect(await first.find({ type: 'Text', text: /^background agents launched \(↓ to manage\)$/ })).toBeTruthy()
  await first.unmount()
  const second = await $.ui.mount(launchOf('r-2', 'general-purpose', 'second'))
  expect(await second.find({ type: 'Text', text: /background agents launched/ })).toBeUndefined()
  expect(await second.find({ type: 'Text', text: /^general-purpose \(second\) {2}$/ })).toBeTruthy()
  await second.unmount()
})

test('a subagent that has left the agent list still counts as a subagent when it was seen launching', async ($, on) => {
  engine(on)
  const agents: unknown[] = []
  inApp(on, [], agents)
  const launch = await $.ui.mount(launchOf('k-1', 'feature-dev:code-explorer'))
  await launch.unmount()
  const reply = await $.ui.mount({ ...peerFrom('feature-dev:code-explorer'), requestId: 'u-9' })
  expect(await reply.find({ type: 'Text', text: /^from subagent: feature-dev:code-explorer · / })).toBeTruthy()
  await reply.unmount()
})

test('a finished notice tied to the SendMessage that resumed a subagent is a subagent row', async ($, on) => {
  engine(on)
  inApp(on, [], [{ id: 'a-5', type: 'general-purpose', description: 'Look', status: 'completed' }])
  const send = await $.ui.mount({ ...wide, component: 'ToolUse', props: { tool_use_id: 's-5', tool: 'SendMessage', input: { to: 'a-5', summary: 'Follow-up' }, output: { success: true, resumedAgentId: 'a-5' }, isRunning: false, isErrored: false, isInterrupted: false } })
  await send.unmount()
  const notice = await $.ui.mount({ ...wide, component: 'UserMessage', props: { text: 'Agent "Look" finished', origin: { kind: 'task-notification' }, task: { status: 'completed', toolUseId: 's-5' }, isExpanded: false } })
  expect((await notice.find({ type: 'Text', text: /^ »$/ }))?.props.color).toBe('blue')
  await notice.unmount()
})

test('a send that reports success false says failed, its glyph in the failure color', async ($, on) => {
  engine(on)
  inApp(on)
  const ui = await $.ui.mount({ ...wide, component: 'ToolUse', props: { tool_use_id: 's-6', tool: 'SendMessage', input: { to: 'gone-session', summary: 'Ping' }, output: { success: false, message: 'No agent named gone-session is reachable.' }, isRunning: false, isErrored: false, isInterrupted: false } })
  expect(await ui.find({ type: 'Text', text: /^to session: gone-session · Ping failed$/ })).toBeTruthy()
  await ui.unmount()
})

const headHover = async (ui: { find: (q: { type: 'Text'; text: RegExp }) => Promise<unknown> }) => {
  const line = await ui.find({ type: 'Text', text: /^from session: cage-2026-11-03-2 · pong from cage-2026-11-03-2$/ }) as { children?: { hover?: Record<string, unknown> }[] } | undefined
  return line?.children?.[0]?.hover
}

for (const surface of ['terminal', 'desktop'] as const) {
  const surfaced = { ...wide, surface }
  const sessionPing = { ...surfaced, component: 'UserMessage' as const, props: { text: 'pong from cage-2026-11-03-2\nsecond line', origin: { kind: 'peer' as const }, from: { name: 'cage-2026-11-03-2' }, isExpanded: false } }
  const sentPing = { ...surfaced, component: 'ToolUse' as const, props: { tool_use_id: `s-9-${surface}`, tool: 'SendMessage', input: { to: 'cage-2026-11-03-2', summary: 'Ping', message: 'Please reply pong.' }, output: { success: true }, isRunning: false, isErrored: false, isInterrupted: false } }

  test(`talkPreview false ends a message row at the name on ${surface}`, { options: { talkPreview: false } }, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(sessionPing)
    expect(await ui.find({ type: 'Text', text: /^from session: cage-2026-11-03-2$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /pong from/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`clicking a message row opens the whole message under it and clicking again closes it on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...sessionPing, requestId: 'u-click' })
    expect(await labelled(ui, 'show message')).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^pong from cage-2026-11-03-2\nsecond line$/ })).toBeUndefined()
    await ui.press({ key: 'msgfold.rows' })
    expect(await ui.find({ type: 'Text', text: /^pong from cage-2026-11-03-2\nsecond line$/ })).toBeTruthy()
    expect(await labelled(ui, 'hide message')).toBeTruthy()
    await ui.press({ key: 'msgfold.rows' })
    expect(await ui.find({ type: 'Text', text: /^pong from cage-2026-11-03-2\nsecond line$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`clicking a SendMessage row opens the message that was sent, and its folded result with it, on ${surface}`, { options: { toolResults: 'folded' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const row = await $.ui.mount(sentPing)
    await row.press({ key: 'msgfold.rows' })
    expect(await row.find({ type: 'Text', text: /^Please reply pong\.$/ })).toBeTruthy()
    await row.unmount()
    const result = await $.ui.mount({ ...surfaced, component: 'ToolResult', props: { tool_use_id: sentPing.props.tool_use_id, tool: 'SendMessage', output: { success: true }, isErrored: false } })
    expect(await result.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await result.unmount()
  })

  test(`a SendMessage with no message text keeps the usual row toggle, not a message toggle, on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...sentPing, props: { ...sentPing.props, tool_use_id: `s-10-${surface}`, input: { to: 'cage-2026-11-03-2', summary: 'Ping' } } })
    expect(await labelled(ui, 'show message')).toBeUndefined()
    await ui.unmount()
  })

  test(`talkMessageColor plain draws the message text in the usual text color, the head and name keeping the row color, on ${surface}`, { options: { talkMessageColor: 'plain', codeTextColor: '#dddddd' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(sessionPing)
    expect((await ui.find({ type: 'Text', text: /^ · pong from cage-2026-11-03-2$/ }))?.props.color).toBe('#dddddd')
    expect((await ui.find({ type: 'Text', text: /^from session: $/ }))?.props.color).toBe('magenta')
    await ui.unmount()
  })

  test(`an opened message sits on the edit card background on ${surface}`, { options: { diffBackgroundColor: '#202030' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...sessionPing, requestId: 'u-bg' })
    await ui.press({ key: 'msgfold.rows' })
    expect((await ui.findAll({ type: 'Box' })).find(b => b.props.backgroundColor === '#202030')).toBeTruthy()
    await ui.unmount()
  })

  test(`hovering a message row in a hex color softens that color toward the background, keeping its hue, on ${surface}`, { options: { sessionColor: '#d6409f' } }, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...sessionPing, requestId: 'u-hex' })
    const hover = await headHover(ui)
    expect(hover?.dimColor).toBeUndefined()
    expect(hover?.color).toMatch(/^#[0-9a-f]{6}$/)
    expect(hover?.color).not.toBe('#d6409f')
    await ui.unmount()
  })

  test(`hovering a message row in a named color falls back to the terminal dim on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount({ ...sessionPing, requestId: 'u-named' })
    expect((await headHover(ui))?.dimColor).toBe(true)
    await ui.unmount()
  })
}

test('two subagent replies drawn at once after a reload both wait for the one transcript scan', async ($, on) => {
  engine(on)
  inApp(on, [{ role: 'assistant', text: '', toolUses: [{ tool_use_id: 'x-2', tool: 'Agent', input: { subagent_type: 'feature-dev:code-explorer', description: 'Look', prompt: 'Look.' }, agentId: 'a-r', result: { status: 'async_launched', agentId: 'a-r' } }] }])
  const [a, b] = await Promise.all([$.ui.mount({ ...peerFrom('feature-dev:code-explorer'), requestId: 'u-a' }), $.ui.mount({ ...peerFrom('feature-dev:code-explorer'), requestId: 'u-b' })])
  expect(await a.find({ type: 'Text', text: /^from subagent: / })).toBeTruthy()
  expect(await b.find({ type: 'Text', text: /^from subagent: / })).toBeTruthy()
  await a.unmount()
  await b.unmount()
})

test('a foreground Agent call is remembered too, so its replies stay subagent rows once it leaves the agent list', async ($, on) => {
  engine(on)
  inApp(on)
  const call = await $.ui.mount({ ...wide, component: 'ToolUse', props: { tool_use_id: 'f-9', tool: 'Agent', input: { subagent_type: 'feature-dev:code-reviewer', description: 'Review', prompt: 'Review.' }, output: { status: 'completed' }, isRunning: false, isErrored: false, isInterrupted: false } })
  await call.unmount()
  const reply = await $.ui.mount({ ...peerFrom('feature-dev:code-reviewer'), requestId: 'u-fg' })
  expect(await reply.find({ type: 'Text', text: /^from subagent: feature-dev:code-reviewer · / })).toBeTruthy()
  await reply.unmount()
})

test('after a reload a subagent missing from the agent list is still found through its Agent call in the transcript', async ($, on) => {
  engine(on)
  inApp(on, [{ role: 'assistant', text: '', toolUses: [{ tool_use_id: 'x-1', tool: 'Agent', input: { subagent_type: 'feature-dev:code-explorer', description: 'Look', prompt: 'Look.' }, agentId: 'a-old' }] }])
  const ui = await $.ui.mount({ ...peerFrom('feature-dev:code-explorer'), requestId: 'u-old' })
  expect(await ui.find({ type: 'Text', text: /^from subagent: feature-dev:code-explorer · / })).toBeTruthy()
  await ui.unmount()
})

test('after a reload a SendMessage to a subagent id is found through the Agent call that spawned it', async ($, on) => {
  engine(on)
  inApp(on, [{ role: 'assistant', text: '', toolUses: [{ tool_use_id: 'x-3', tool: 'Agent', input: { subagent_type: 'feature-dev:code-explorer', description: 'Look', prompt: 'Look.' }, agentId: 'a-gone' }] }])
  const ui = await $.ui.mount({ ...wide, component: 'ToolUse', props: { tool_use_id: 'm-gone', tool: 'SendMessage', input: { to: 'a-gone', summary: 'Go on', message: 'Go on.' }, output: { success: true }, isRunning: false, isErrored: false, isInterrupted: false } })
  expect(await ui.find({ type: 'Text', text: /^to subagent: feature-dev:code-explorer · Go on$/ })).toBeTruthy()
  await ui.unmount()
})

test('a transcript scan that failed is tried again on the next row, not kept failed', async ($, on) => {
  engine(on)
  mock.env(on, { HOME: '/home/demo' })
  on('session.root', () => ({ value: '/home/demo/app' }))
  on('agent.list', () => ({ value: [] as never }))
  claudeAt(on, '2.1.295')
  let reads = 0
  on('session.messages', () => {
    reads += 1
    if (reads === 1) throw new Error('transcript not ready')
    return { value: [{ role: 'assistant', text: '', toolUses: [{ tool_use_id: 'x-4', tool: 'Agent', input: { subagent_type: 'feature-dev:code-explorer', description: 'Look', prompt: 'Look.' }, agentId: 'a-4' }] }] as never }
  })
  const first = await $.ui.mount({ ...peerFrom('feature-dev:code-explorer'), requestId: 'u-4a' }).catch(() => undefined)
  await first?.unmount()
  const ui = await $.ui.mount({ ...peerFrom('feature-dev:code-explorer'), requestId: 'u-4b' })
  expect(await ui.find({ type: 'Text', text: /^from subagent: feature-dev:code-explorer · / })).toBeTruthy()
  expect(reads).toBe(2)
  await ui.unmount()
})
