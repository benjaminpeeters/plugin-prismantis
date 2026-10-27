import { expect, test } from 'claude-code/testing'

const message = (surface: 'terminal' | 'desktop', isSummary: boolean) => ({ plugin: 'prismantis', component: 'AssistantMessage' as const, props: { text: 'Done.', isFirstOfReply: true, ...(isSummary ? { isSummary: true as const } : {}) }, viewport: { columns: 100, rows: 40 }, surface })

const row = (surface: 'terminal' | 'desktop') => ({ plugin: 'prismantis', surface, component: 'ToolUse' as const, props: { tool_use_id: 'i-1', tool: 'Bash', input: { command: 'ls' }, output: { stdout: 'a' }, isRunning: false, isErrored: false, isInterrupted: false }, viewport: { columns: 100, rows: 40 } })

for (const surface of ['terminal', 'desktop'] as const) {
  test(`replyIcon and thinkingIcon mark a reply text and a summary row apart on ${surface}`, { options: { replyIcon: '»', thinkingIcon: '…' } }, async $ => {
    const reply = await $.ui.mount(message(surface, false))
    expect(await reply.find({ type: 'Text', text: /^»$/ })).toBeTruthy()
    await reply.unmount()
    const thinking = await $.ui.mount(message(surface, true))
    expect(await thinking.find({ type: 'Text', text: /^…$/ })).toBeTruthy()
    expect(await thinking.find({ type: 'Text', text: /^»$/ })).toBeUndefined()
    await thinking.unmount()
  })

  test(`toolIcon replaces a finished tool row's status glyph on ${surface}`, { options: { toolIcon: '▪' } }, async $ => {
    const ui = await $.ui.mount(row(surface))
    expect(await ui.find({ type: 'Text', text: /^ ▪$/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`a Nerd Font toolIcon, a private use glyph, gets a space after it on ${surface} to keep it off the edge`, { options: { toolIcon: '' } }, async $ => {
    const ui = await $.ui.mount(row(surface))
    expect(await ui.find({ type: 'Text', text: /^  $/ })).toBeTruthy()
    await ui.unmount()
  })

  test(`the icons default to ● on ${surface}`, async $ => {
    for (const isSummary of [false, true]) {
      const ui = await $.ui.mount(message(surface, isSummary))
      expect(await ui.find({ type: 'Text', text: /^●$/ })).toBeTruthy()
      await ui.unmount()
    }
    const ui = await $.ui.mount(row(surface))
    expect(await ui.find({ type: 'Text', text: /^ ●$/ })).toBeTruthy()
    await ui.unmount()
  })
}
