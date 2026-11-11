import { withRetry } from '../lib/retry.js'
import { collectPages } from '../lib/pages.js'

export async function importContacts(crm, store) {
  const contacts = await collectPages((next) => withRetry(() => crm.contacts({ pageToken: next })))
  for (const c of contacts) store.put(c.email.toLowerCase(), c)
  return contacts.length
}
