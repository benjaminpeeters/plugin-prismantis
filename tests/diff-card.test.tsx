import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { DIFF_PALETTES, DIFFS_TEXT } from '../hooks/diff-palettes'
import { diffTint } from '../hooks/render'
import { PRESETS } from '../hooks/presets'
import { labelled } from './buttons'
import { claudeAt } from './claude-version'

const t = PRESETS['catppuccin-mocha']

const patch = { filePath: '/tmp/app.ts', structuredPatch: [{ oldStart: 4, newStart: 4, lines: [' const a = 1', '-const b = 2', '+const b = 3', '+const c = 4'] }] }

const edit = { plugin: 'prismantis', surface: 'terminal' as const, component: 'ToolResult' as const, props: { tool_use_id: 'd-1', tool: 'Edit', output: patch, isErrored: false }, viewport: { columns: 100, rows: 40 } }

const engine = (on: On) => on('ui.render', ($, e) => {
  const { Text } = $.ui.resolve(e)
  return <Text>engine</Text>
})

const card = async (ui: { findAll: (q: { type: 'Box' }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Box' })).find(box => box.props.borderStyle === 'round')

test('diffWidth full lets a diff card grow to the window instead of fitting its lines', { options: { diffWidth: 'full' } }, async ($, on) => {
  engine(on)
  const ui = await $.ui.mount(edit)
  const column = (await ui.findAll({ type: 'Box' })).find(box => box.props.flexGrow === 1 && box.props.flexDirection === 'column')
  expect(column).toBeTruthy()
  await ui.unmount()
})

test('diffPath puts the file name before the counts', { options: { diffPath: true } }, async ($, on) => {
  engine(on)
  const ui = await $.ui.mount(edit)
  expect(await ui.find({ type: 'Text', text: /app\.ts.*\+2 −1/ })).toBeTruthy()
  await ui.unmount()
})

test('diffBackgroundColor fills the card and the tints mix into it', { options: { diffBackgroundColor: '#202030' } }, async ($, on) => {
  engine(on)
  const ui = await $.ui.mount(edit)
  expect((await card(ui))?.props.backgroundColor).toBe('#202030')
  expect(diffTint(t.codeText, t.diffAdded, undefined, '#202030')).not.toBe(diffTint(t.codeText, t.diffAdded))
  await ui.unmount()
})

test('diffTint sets how much of the diff color tints a changed line', () => {
  const soft = diffTint(t.codeText, t.diffAdded, 0.1)!
  const strong = diffTint(t.codeText, t.diffAdded)!
  const sum = (hex: string) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0)
  expect(sum(soft)).toBeLessThan(sum(strong))
})

for (const diffFold of ['open', 'folded'] as const) {
  test(`diffFold ${diffFold}: a click anywhere on the card toggles it between its head and its lines, no button drawn`, { options: { diffFold } }, async ($, on) => {
    engine(on)
    const ui = await $.ui.mount(edit)
    const lines = async () => !!(await ui.find({ type: 'Text', text: /const c = 4/ }))
    expect(await lines()).toBe(diffFold === 'open')
    const whole = await labelled(ui, diffFold === 'open' ? 'hide' : 'show')
    expect(whole?.props.plain).toBe(true)
    expect(whole?.text).toMatch(/\+2 −1/)
    await ui.press({ key: 'cardfold.rows' })
    expect(await lines()).toBe(diffFold !== 'open')
    await ui.unmount()
  })
}

const write = { plugin: 'prismantis', surface: 'terminal' as const, component: 'ToolResult' as const, props: { tool_use_id: 'w-1', tool: 'Write', output: { type: 'create', filePath: '/home/demo/app/notes.md', content: 'first line\nsecond line\n', structuredPatch: [], originalFile: null }, isErrored: false }, viewport: { columns: 100, rows: 40 } }

const inApp = (on: On) => {
  mock.env(on, { HOME: '/home/demo' })
  on('session.root', () => ({ value: '/home/demo/app' }))
  claudeAt(on, '2.1.295')
}

test('createdStyle card draws a created file as a folded card on its own background, opened by a click', { options: { createdStyle: 'card', diffFold: 'folded', diffBorder: false, diffBackgroundColor: '#1c1c1c', createdBackgroundColor: '#1f231f' } }, async ($, on) => {
  engine(on)
  inApp(on)
  const ui = await $.ui.mount(write)
  expect((await ui.findAll({ type: 'Box' })).some(box => box.props.backgroundColor === '#1f231f')).toBe(true)
  expect(await ui.find({ type: 'Text', text: /Created .*notes\.md \(2 lines\)/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /second line/ })).toBeUndefined()
  await ui.press({ key: 'cardfold.rows' })
  expect(await ui.find({ type: 'Text', text: /second line/ })).toBeTruthy()
  await ui.unmount()
})

const editRow = { plugin: 'prismantis', surface: 'terminal' as const, component: 'ToolUse' as const, props: { tool_use_id: 'd-1', tool: 'Edit', input: { file_path: '/home/demo/app/src/app.ts' }, output: patch, isRunning: false, isErrored: false, isInterrupted: false }, viewport: { columns: 100, rows: 40 } }

test('editRow file highlights the file name and shows the change counts on the row', { options: { editRow: 'file' } }, async ($, on) => {
  engine(on)
  inApp(on)
  const ui = await $.ui.mount(editRow)
  const name = await ui.find({ type: 'Text', text: /^app\.ts$/ })
  expect(name?.props.bold).toBe(true)
  expect(await ui.find({ type: 'Text', text: /^src\/$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^\+2$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^−1$/ })).toBeTruthy()
  await ui.unmount()
})

test('diffToggle row: the Edit row toggles its card, which draws nothing while folded and only its lines when open', { options: { diffToggle: 'row', diffFold: 'folded' } }, async ($, on) => {
  engine(on)
  inApp(on)
  const row = await $.ui.mount(editRow)
  const card = async () => {
    const ui = await $.ui.mount(edit)
    const shown = { lines: !!(await ui.find({ type: 'Text', text: /const c = 4/ })), head: !!(await ui.find({ type: 'Text', text: /^\+2 −1$/ })) }
    await ui.unmount()
    return shown
  }
  expect(await card()).toEqual({ lines: false, head: false })
  const toggle = await labelled(row, 'show diff')
  expect(toggle?.text).toMatch(/Edited/)
  await row.press({ key: 'rowfold.rows' })
  expect(await card()).toEqual({ lines: true, head: false })
  await row.unmount()
})

const FAILED = 'Error: File content has changed since it was last read.'
const failedResult = { ...edit, props: { ...edit.props, tool_use_id: 'f-1', output: FAILED, isErrored: true } }
const failedRow = { ...editRow, props: { ...editRow.props, tool_use_id: 'f-1', output: FAILED, isErrored: true } }

test('editErrors folded hides a failed edit\'s error behind its row until the row is clicked', { options: { diffToggle: 'row', diffFold: 'folded', editErrors: 'folded' } }, async ($, on) => {
  engine(on)
  inApp(on)
  const engineShown = async () => {
    const ui = await $.ui.mount(failedResult)
    const shown = !!(await ui.find({ type: 'Text', text: /^engine$/ }))
    await ui.unmount()
    return shown
  }
  expect(await engineShown()).toBe(false)
  const row = await $.ui.mount(failedRow)
  expect(await row.find({ type: 'Text', text: / failed$/ })).toBeTruthy()
  expect(await labelled(row, 'show error')).toBeTruthy()
  await row.press({ key: 'rowfold.rows' })
  expect(await engineShown()).toBe(true)
  await row.unmount()
})

test('with file links on, a failed edit row still draws as its toggle, its path as text since a Button holds no Link', { options: { diffToggle: 'row', diffFold: 'folded', editErrors: 'folded' } }, async ($, on) => {
  engine(on)
  mock.env(on, { TERM: 'xterm-kitty', HOME: '/home/me', FORCE_HYPERLINK: '1' })
  claudeAt(on, '2.1.289')
  const row = await $.ui.mount({ ...failedRow, props: { ...failedRow.props, input: { file_path: '/home/me/app/src/app.ts' } } })
  expect(await labelled(row, 'show error')).toBeTruthy()
  expect(await row.find({ type: 'Text', text: / failed$/ })).toBeTruthy()
  expect(await row.findAll({ type: 'Link' })).toHaveLength(0)
  await row.unmount()
})

test('editErrors folded leaves the error shown under toolOutput quiet, whose row cannot open it', { options: { diffToggle: 'row', diffFold: 'folded', editErrors: 'folded', toolOutput: 'quiet' } }, async ($, on) => {
  engine(on)
  inApp(on)
  const ui = await $.ui.mount(failedResult)
  expect(await ui.find({ type: 'Text', text: /File content has changed/ })).toBeTruthy()
  await ui.unmount()
})

test('editErrors shown, the default, prints a failed edit\'s error as before', { options: { diffToggle: 'row', diffFold: 'folded' } }, async ($, on) => {
  engine(on)
  inApp(on)
  const ui = await $.ui.mount(failedResult)
  expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeTruthy()
  await ui.unmount()
})

test('createdStyle preview, the default, keeps the created file as it was', async ($, on) => {
  engine(on)
  inApp(on)
  const ui = await $.ui.mount(write)
  expect(await ui.find({ type: 'Text', text: /second line/ })).toBeTruthy()
  expect(await labelled(ui, 'show')).toBeUndefined()
  await ui.unmount()
})

test('/prismantis diffs draws every palette as a full-width card with its options named', async ($, on) => {
  engine(on)
  const run = await $.command.run({ command: 'prismantis', args: 'diffs', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(run.text).toBe(DIFFS_TEXT)
  const ui = await $.ui.mount({ plugin: 'prismantis', surface: 'terminal', component: 'CommandOutput', props: { command: 'prismantis', args: 'diffs', text: DIFFS_TEXT, isErrored: false }, viewport: { columns: 120, rows: 200 } })
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.filter(box => box.props.borderStyle === 'round')).toHaveLength(DIFF_PALETTES.filter(p => p.border !== false).length)
  expect(boxes.filter(box => box.props.backgroundColor === '#1c1c1c')).toHaveLength(DIFF_PALETTES.filter(p => p.diffBackground === '#1c1c1c').length)
  for (const [i, p] of DIFF_PALETTES.entries()) expect(await ui.find({ type: 'Text', text: `${i + 1}. ${p.name}` })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /"diffTint": "0", "diffWordTint": "35", "diffBorder": true/ })).toBeTruthy()
  await ui.unmount()
  const prefixed = await $.ui.mount({ plugin: 'prismantis', surface: 'terminal', component: 'CommandOutput', props: { command: 'prismantis', args: 'diffs', text: `prismantis: ${DIFFS_TEXT}\n`, isErrored: false }, viewport: { columns: 120, rows: 200 } })
  expect(await prefixed.find({ type: 'Text', text: `1. ${DIFF_PALETTES[0]!.name}` })).toBeTruthy()
  await prefixed.unmount()
})

test('diffBorder false drops the border; with a background the card keeps its padding', { options: { diffBorder: false, diffBackgroundColor: '#1c1c1c' } }, async ($, on) => {
  engine(on)
  const ui = await $.ui.mount(edit)
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.filter(box => box.props.borderStyle === 'round')).toHaveLength(0)
  expect(boxes.find(box => box.props.backgroundColor === '#1c1c1c')?.props.paddingX).toBe(1)
  await ui.unmount()
})

test('diffTint 0 leaves changed lines on the card ground while changed words keep a tint', { options: { diffTint: '0', diffWordTint: '40' } }, async ($, on) => {
  engine(on)
  const ui = await $.ui.mount(edit)
  const tintedRows = (await ui.findAll({ type: 'Box' })).filter(box => box.props.flexDirection === 'row' && box.props.backgroundColor !== undefined)
  expect(tintedRows).toHaveLength(0)
  const words = (await ui.findAll({ type: 'Text' })).filter(node => node.props.backgroundColor !== undefined)
  expect(words.length).toBeGreaterThan(0)
  await ui.unmount()
})

test('diffFold none, the default, draws no fold button and every line', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount(edit)
  expect(await labelled(ui, 'hide')).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /const c = 4/ })).toBeTruthy()
  await ui.unmount()
})
