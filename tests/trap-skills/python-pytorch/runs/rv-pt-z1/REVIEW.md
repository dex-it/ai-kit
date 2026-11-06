src/shelfwatch/torch_train.py:41 - shuffle=True вместе с sampler: DataLoader бросает ValueError, обучение не стартует вообще - blocker
src/shelfwatch/torch_train.py:62 - нет optimizer.zero_grad(): градиенты копятся между батчами, SGD расходится, модель не обучится - blocker
src/shelfwatch/torch_train.py:110 - scheduler.step() без метрики для ReduceLROnPlateau (--sched plateau): TypeError после первой эпохи; plateau-вариант неработоспособен - blocker
src/shelfwatch/torch_train.py:110 - OneCycleLR рассчитан на epochs*len(loader) шагов, а шагает раз за эпоху: LR застревает в разгоне (~начало цикла), расписание не отрабатывает, качество хуже ожидаемого - major
src/shelfwatch/torch_train.py:69 - evaluate без model.eval(): BatchNorm в train-режиме обновляет статистики на val и даёт шумный macro-F1; выбор модели по такой метрике ненадёжен, веса в чекпоинте портятся - major
src/shelfwatch/torch_train.py:98 - --resume грузит только веса: оптимизатор (momentum), планировщик и номер эпохи теряются, цикл идёт с эпохи 0 на полные epochs и расписание стартует заново; это не возобновление - major
src/shelfwatch/torch_train.py:98 - torch.load без map_location: чекпоинт, сохранённый на GPU, не откроется на машине без CUDA; при отсутствии last.pt --resume падает с невнятной ошибкой - minor
src/shelfwatch/torch_train.py:111 - чекпоинт пишется прямо в last.pt без атомарной записи: падение во время torch.save оставляет битый файл и теряет предыдущую эпоху; лучшая по macro-F1 модель не сохраняется, итог - последняя эпоха - minor
src/shelfwatch/torch_train.py:20 - CLASSES захардкожен ["full","empty","misplaced"], а ImageFolder сортирует папки по алфавиту (empty, full, misplaced): индексы предсказаний перепутаны, сервис разметки выдаст неверные имена классов - major
src/shelfwatch/torch_train.py:33 - ожидается ImageFolder shelf/train и shelf/val, а docs/data.md описывает shelf/ как 600 фото с YOLO-разметкой без разбиения и папок классов: код не запустится на описанных данных, а способ разбиения (и риск утечки между train/val) не определён - major
src/shelfwatch/torch_train.py:26 - нет аугментаций на train и фиксации seed при 600 фото: быстрое переобучение, невоспроизводимые прогоны - minor
src/shelfwatch/torch_train.py:83 - predict без torch.no_grad(): строится граф, лишняя память и время на инференсе в сервисе; выход с requires_grad - minor
src/shelfwatch/torch_train.py:115 - export нигде не вызывается (ни из fit, ни из main): экспорта в хранилище по описанию MR не происходит - major
src/shelfwatch/torch_train.py:117 - torch.save(model) пикл всего объекта вместо state_dict: загрузка привязана к путям классов/версии torch и небезопасна с weights_only=True, несовместима с load_checkpoint - major
src/shelfwatch/torch_train.py:123 - except Exception: pass глотает любые ошибки загрузки: модель не доехала до хранилища, а процесс завершается успешно без следа в логах - major
src/shelfwatch/torch_train.py:22 - токен загрузки зашит в исходник (даже тестовый): при замене на реальный попадёт в git; брать из окружения/секрет-хранилища - minor
src/shelfwatch/torch_train.py:118 - загрузка по http без Content-Type, весь файл читается в память read_bytes - minor
src/shelfwatch/torch_train.py:112 - logging не настроен (нет basicConfig в main): log.info не выводится, прогресс обучения не виден - minor
tests/test_torch_train.py:6 - build_model качает ImageNet-веса из сети, тест хрупок/падает офлайн в CI; обучение, resume, планировщики и evaluate тестами не покрыты (баги выше не поймаются) - minor
