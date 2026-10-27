import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { labelled } from './buttons'
import { claudeAt } from './claude-version'

const engine = (on: On) => on('ui.render', ($, e) => {
  const { Text } = $.ui.resolve(e)
  return <Text>engine</Text>
})

const inApp = (on: On) => {
  mock.env(on, { HOME: '/home/demo' })
  on('session.root', () => ({ value: '/home/demo/app' }))
  claudeAt(on, '2.1.295')
}

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

  test(`toolResults shown puts the result Claude Code draws in a block on the right under its row on ${surface}`, async ($, on) => {
    engine(on)
    inApp(on)
    const ui = await $.ui.mount(skillResult)
    expect(await asideIn(ui)).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
    await ui.unmount()
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
