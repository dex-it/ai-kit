import { accept } from './stream.js'
import { renderFeed } from './feed.js'

export function createConsole(limit = 100) {
  const events = []
  return {
    onLine(line) {
      const evt = accept(line)
      if (!evt) return
      events.push(evt)
      if (events.length > limit) events.shift()
    },
    lines() { return renderFeed(events) },
  }
}
