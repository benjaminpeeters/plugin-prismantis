import { expect, test } from 'claude-code/testing'

import { resolveStyle } from '../hooks/theme'

const row = { plugin: 'prismantis', surface: 'terminal' as const, component: 'ToolUse' as const, props: { tool_use_id: 'w-1', tool: 'Bash', input: { command: 'ls' }, output: { stdout: 'a' }, isRunning: false, isErrored: false, isInterrupted: false }, viewport: { columns: 160, rows: 40 } }

const edge = async (ui: { findAll: (q: { type: 'Box' }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Box' })).find(box => box.props.justifyContent === 'flex-end')?.props.width

test('toolWidth lines tool rows up on the right edge of that many columns', { options: { toolWidth: '100' } }, async $ => {
  const ui = await $.ui.mount(row)
  expect(await edge(ui)).toBe(100)
  await ui.unmount()
})

test('toolWidth wider than the window keeps the window\'s edge', { options: { toolWidth: '300' } }, async $ => {
  const ui = await $.ui.mount(row)
  expect(await edge(ui)).toBe(160)
  await ui.unmount()
})

test('toolWidth empty, the default, lines tool rows up on the window\'s edge', async $ => {
  const ui = await $.ui.mount(row)
  expect(await edge(ui)).toBe('100%')
  await ui.unmount()
})

test('an invalid toolWidth fails loudly, naming the option', () => {
  for (const toolWidth of ['wide', '30', '80.5', '500']) {
    expect(() => resolveStyle({ toolWidth })).toThrow(/toolWidth must be empty or a whole number of columns from 40 to 400/)
  }
  expect(resolveStyle({ toolWidth: '120' }).toolWidth).toBe(120)
  expect(resolveStyle({}).toolWidth).toBeNull()
})
