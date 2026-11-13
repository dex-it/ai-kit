import { encode } from './wire.js'

export function createBus(transport) {
  return {
    emit(evt) {
      const line = encode(evt)
      if (!line) return false
      transport.send(line)
      return true
    },
  }
}
