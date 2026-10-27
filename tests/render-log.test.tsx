import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { renderLine } from '../hooks/render-log'

test('a render line names the component, tool, origin, flags, prop names and the start of the text', () => {
  expect(renderLine('ToolResult', 'terminal', 'r-1', { tool: 'Skill', isErrored: true, output: {} })).toBe('ToolResult terminal id=r-1 tool=Skill flags=isErrored keys=tool,isErrored,output')
  expect(renderLine('UserMessage', 'terminal', 'u-1', { text: 'Agent "x" finished', origin: { kind: 'task-notification' } })).toBe('UserMessage terminal id=u-1 origin=task-notification keys=text,origin text="Agent \\"x\\" finished"')
  expect(renderLine('ToolGroup', 'terminal', 'g-1', { calls: [{ tool: 'Read' }, { tool: 'Bash' }] })).toBe('ToolGroup terminal id=g-1 calls=Read,Bash keys=calls')
})

const engine = (on: On) => on('ui.render', ($, e) => {
  const { Text } = $.ui.resolve(e)
  return <Text>engine</Text>
})

const row = { plugin: 'prismantis', surface: 'terminal' as const, component: 'ToolResult' as const, props: { tool_use_id: 's-1', tool: 'Skill', output: {}, isErrored: false }, viewport: { columns: 100, rows: 40 } }

test('renderLog writes the elements it sees to the session\'s log under ~/.claude/debug, after half a second', { options: { renderLog: true } }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 27, 12, 0) })
  mock.env(on, { HOME: '/home/demo' })
  on('session.id', () => ({ value: 'sess-1' }))
  const writes: { path: string; text: string }[] = []
  on('fs.write', (_$, e) => {
    writes.push(e)
    return { value: undefined }
  })
  engine(on)
  await (await $.ui.mount(row)).unmount()
  expect(writes).toEqual([])
  await clock.advance(600)
  expect(writes.length).toBe(1)
  expect(writes[0]?.path).toBe('/home/demo/.claude/debug/prismantis-render-sess-1.log')
  expect(writes[0]?.text).toMatch(/^2026-10-27T12:00:00\.000Z ToolResult terminal id=\S+ tool=Skill keys=tool_use_id,tool,output,isErrored\n$/)
})

test('renderLog off, the default, writes nothing', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 27, 12, 0) })
  const writes: unknown[] = []
  on('fs.write', (_$, e) => {
    writes.push(e)
    return { value: undefined }
  })
  engine(on)
  await (await $.ui.mount(row)).unmount()
  await clock.advance(600)
  expect(writes).toEqual([])
})

test('renderLog reports a failed write once, then stops logging', { options: { renderLog: true } }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 27, 12, 0) })
  mock.env(on, {})
  on('session.id', () => ({ value: 'sess-1' }))
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined }
  })
  engine(on)
  await (await $.ui.mount(row)).unmount()
  await clock.advance(600)
  await (await $.ui.mount({ ...row, props: { ...row.props, tool: 'Agent' } })).unmount()
  await clock.advance(600)
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toMatch(/could not write ~\/\.claude\/debug\/prismantis-render-<session id>\.log, so it stops: HOME is not set/)
})
