import { toRow, fromRow } from './rows.js'

export function createStore(db = new Map()) {
  return {
    save(x) { db.set(x.id, toRow(x)) },
    load(id) { return fromRow(db.get(id)) },
    all() { return [...db.values()].map(fromRow) },
  }
}
