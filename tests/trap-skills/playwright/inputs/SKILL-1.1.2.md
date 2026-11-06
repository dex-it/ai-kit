---
name: playwright
description: Playwright E2E - локаторы по роли и подписи вместо CSS, вход без формы в каждом тесте, отладка через Inspector, headed в WSL. Активируется при playwright, e2e, browser automation, locator, getByRole, getByLabel, storageState, логин в тестах, page.pause, PWDEBUG, headed, WSL, X-сервер
---

# Playwright - чек-лист

Пункт называет ситуацию, которую тест проверяет.

- Локаторы по CSS-классам и id вместо роли, подписи и текста
- Вход через UI в каждом тесте

## Отладка и среда

### Дебаг через `console.log`, не Inspector
Плохо: `console.log(await page.content())` для понимания что упало
Правильно: `PWDEBUG=1 npx playwright test ...` или `await page.pause()` в точке интереса
Почему: `page.content()` - стена HTML. Inspector / `page.pause()` - шаги и правка локаторов; `page.pause()` требует headed.

### Headed без X-сервера в WSL
Плохо: `npx playwright test --headed` в WSL без WSLg / VcXsrv
Правильно: запускать headless или включить WSLg (WSL 2, Win 10 19044+ или Win 11)
Почему: headed-браузеру нужен display server; без него Playwright печатает "Looks like you launched a headed browser without having a XServer running" и советует headless или xvfb-run.
