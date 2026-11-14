# QA: на этикетке «Страховка: undefined EUR»

- Стенд: stage, shipping-api и label-worker на образе `{{sha12:K4_HEAD}}` (выкат 2026-10-06 10:30)
- Тестировала: Мария Иванова (QA), 2026-10-06 10:55 UTC
- x-request-id: qa-1055-e9

## Шаги

1. `POST /shipments` `{"weight":1,"postcode":"50667","declaredValue":900}` - ответ 201.
2. Этикетка отправления из label-worker.

## Ожидаемое

Строка «Страховка: 9.00 EUR» (`declaredValue` - центы EUR, docs/api.md).

## Фактическое

Строка «Страховка: undefined EUR».
