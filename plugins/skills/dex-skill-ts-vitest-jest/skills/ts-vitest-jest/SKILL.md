---
name: ts-vitest-jest
description: Vitest/Jest unit-тесты - мок модуля не подхватывается или переменная в фабрике мока недоступна из-за hoisting vi.mock/jest.mock. Активируется при vitest, jest, vi.mock, jest.mock, vi.hoisted, mock, hoisting, unit test, Cannot access before initialization
---

# Vitest / Jest - ловушки unit-тестирования

### Переменная в factory мока - недоступна из-за hoisting
Плохо: `const fn = vi.fn(); vi.mock('./api', () => ({ get: fn }))` -> `ReferenceError: Cannot access 'fn' before initialization`
Правильно: `const { fn } = vi.hoisted(() => ({ fn: vi.fn() })); vi.mock('./api', () => ({ get: fn }))`
Почему: `vi.mock`/`jest.mock` всплывают в начало файла до объявлений. Factory выполняется раньше, чем создана переменная. `vi.hoisted` поднимает её вместе с моком
