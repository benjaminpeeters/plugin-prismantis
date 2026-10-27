import { record } from './render'

const FLAGS = ['isErrored', 'isInterrupted', 'isRunning', 'isExpanded', 'isSummary', 'isActive', 'isFirstOfReply']

export const renderLine = (component: string, surface: string, requestId: string, props: unknown): string => {
  const p = record(props)
  const origin = record(p.origin).kind
  const calls = Array.isArray(p.calls) ? p.calls.map(c => record(c).tool).filter(t => typeof t === 'string') : []
  const flags = FLAGS.filter(k => p[k] === true)
  return [
    component,
    surface,
    `id=${requestId}`,
    ...(typeof p.tool === 'string' ? [`tool=${p.tool}`] : []),
    ...(calls.length ? [`calls=${calls.join(',')}`] : []),
    ...(typeof origin === 'string' ? [`origin=${origin}`] : []),
    ...(flags.length ? [`flags=${flags.join(',')}`] : []),
    `keys=${Object.keys(p).join(',')}`,
    ...(typeof p.text === 'string' ? [`text=${JSON.stringify(p.text.slice(0, 80))}`] : []),
  ].join(' ')
}
