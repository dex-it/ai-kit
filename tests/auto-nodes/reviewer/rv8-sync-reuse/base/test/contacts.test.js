import test from 'node:test'
import assert from 'node:assert/strict'
import { importContacts } from '../src/crm/contacts.js'
import { memoryStore } from '../src/util/store.js'

test('контакты собираются со всех страниц', async () => {
  const pages = { null: { items: [{ email: 'A@x.ru' }], next: 't2' }, t2: { items: [{ email: 'b@x.ru' }], next: null } }
  const store = memoryStore()
  assert.equal(await importContacts({ contacts: async ({ pageToken }) => pages[pageToken] }, store), 2)
  assert.ok(store.get('a@x.ru'))
})
