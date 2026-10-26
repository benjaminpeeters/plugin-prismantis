import type { SessionMessage } from 'claude-code'

import type { TurnMarks, TurnRole } from '../types'

type Turn = { texts: string[]; answered: boolean }

const KEEP = 500

const roleAt = (i: number, steps: number): TurnRole | undefined => {
  if (steps <= 0) return undefined
  if (i >= steps) return 'answer'
  return i === 0 ? 'first' : 'step'
}

const turnsOf = (messages: readonly SessionMessage[]): Turn[] => {
  const turns: Turn[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      if (m.text.trim() && !m.toolResults?.length) turns.push({ texts: [], answered: true })
      continue
    }
    const turn = turns[turns.length - 1]
    if (!turn) continue
    const text = m.text.trim()
    if (text || m.toolUses.length) turn.answered = !m.toolUses.length
    if (text) turn.texts.push(text)
  }
  return turns
}

export const markTurns = (messages: readonly SessionMessage[]): TurnMarks => {
  const turns = turnsOf(messages)
  const seen = new Map<string, { turn: number; role: TurnRole | undefined }>()
  const ambiguous = new Set<string>()
  for (const [t, turn] of turns.slice(-KEEP).entries()) {
    const steps = turn.answered ? turn.texts.length - 1 : turn.texts.length
    for (const [i, text] of turn.texts.entries()) {
      const role = roleAt(i, steps)
      const before = seen.get(text)
      if (before && (before.turn !== t || before.role !== role)) ambiguous.add(text)
      seen.set(text, { turn: t, role })
    }
  }
  const marks: TurnMarks = {}
  for (const [text, { role }] of seen) if (role && !ambiguous.has(text)) marks[text] = role
  return marks
}

export const roleOf = (marks: TurnMarks, text: string): TurnRole | undefined => (Object.hasOwn(marks, text) ? marks[text] : undefined)
