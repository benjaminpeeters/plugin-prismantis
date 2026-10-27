import type { SessionMessage } from 'claude-code'

import type { TurnWindow } from '../types'
import { withRecord } from './clock'

type Turn = { texts: { text: string; afterTool: boolean }[]; hasTools: boolean }

const KEEP = 500

const turnsOf = (messages: readonly SessionMessage[]): Turn[] => {
  const turns: Turn[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      if (m.text.trim() && !m.toolResults?.length) turns.push({ texts: [], hasTools: false })
      continue
    }
    const turn = turns[turns.length - 1]
    if (!turn) continue
    const text = m.text.trim()
    if (text) turn.texts.push({ text, afterTool: turn.hasTools })
    if (m.toolUses.length) turn.hasTools = true
  }
  return turns
}

export const stepTexts = (messages: readonly SessionMessage[]): Record<string, true> => {
  const steps = new Set<string>()
  const others = new Set<string>()
  for (const turn of turnsOf(messages).slice(-KEEP)) for (const { text, afterTool } of turn.texts) (afterTool ? steps : others).add(text)
  const marks: Record<string, true> = {}
  for (const text of steps) if (!others.has(text)) marks[text] = true
  return marks
}

const isOpen = (window: TurnWindow | undefined): window is TurnWindow => window !== undefined && window.end === undefined

const withLast = (windows: TurnWindow[], last: TurnWindow): TurnWindow[] => [...windows.slice(0, -1), last]

export const openWindow = (windows: TurnWindow[], turnId: string, at: number): TurnWindow[] => {
  const last = windows[windows.length - 1]
  if (isOpen(last) && last.turnId === turnId) return windows
  return withRecord(isOpen(last) ? withLast(windows, { ...last, end: at }) : windows, { turnId, start: at })
}

export const toolInWindow = (windows: TurnWindow[], at: number): TurnWindow[] => {
  const last = windows[windows.length - 1]
  return isOpen(last) && last.tool === undefined ? withLast(windows, { ...last, tool: at }) : windows
}

export const closeWindow = (windows: TurnWindow[], turnId: string, at: number): TurnWindow[] => {
  const last = windows[windows.length - 1]
  return isOpen(last) && last.turnId === turnId ? withLast(windows, { ...last, end: at }) : windows
}

export const isStep = (windows: readonly TurnWindow[], steps: Readonly<Record<string, true>>, drawnAt: number, text: string): boolean => {
  const window = windows.findLast(w => w.start <= drawnAt && (w.end === undefined || drawnAt <= w.end))
  if (window) return window.tool !== undefined && window.tool <= drawnAt
  return Object.hasOwn(steps, text)
}
