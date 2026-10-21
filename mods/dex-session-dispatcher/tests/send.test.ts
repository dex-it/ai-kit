import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { NO_SEND_REASON, delivery } from '../hooks/dispatch.ts'

describe('отправка сообщения другой сессии', () => {
  it('сборка без send: ответ человеку, не падение', async () => {
    const answer = await delivery(() => undefined)

    assert.deepEqual(answer, { isDelivered: false, reason: NO_SEND_REASON })
  })

  it('send, которого нет как функции, читается так же, как отсутствие', async () => {
    const answer = await delivery(() => {
      throw new TypeError('x is not a function')
    })

    assert.deepEqual(answer, { isDelivered: false, reason: NO_SEND_REASON })
  })

  it('доставлено: isDelivered строго true', async () => {
    assert.deepEqual(await delivery(async () => ({ isDelivered: true })), { isDelivered: true, reason: '' })
    assert.deepEqual(await delivery(async () => ({ isDelivered: 'yes' })), { isDelivered: false, reason: '' })
  })

  it('отказ хоста несёт причину', async () => {
    assert.deepEqual(await delivery(async () => ({ isDelivered: false, reason: 'нет такой сессии' })), {
      isDelivered: false,
      reason: 'нет такой сессии',
    })
  })

  it('другая ошибка - её текст', async () => {
    const answer = await delivery(async () => {
      throw new Error('канал закрыт')
    })

    assert.deepEqual(answer, { isDelivered: false, reason: 'канал закрыт' })
  })
})
