src/shelfwatch/torch_train.py:41 - `shuffle=True` вместе с `sampler` взаимоисключающи: DataLoader бросит ValueError, обучение не стартует ни в одном режиме - blocker
src/shelfwatch/torch_train.py:61 - нет `optimizer.zero_grad()`: градиенты копятся между батчами, шаги всё сильнее искажаются, модель расходится или не учится - blocker
src/shelfwatch/torch_train.py:110 - `ReduceLROnPlateau.step()` вызывается без метрики: TypeError на первой же эпохе при `--sched plateau`; нужно `scheduler.step(score)` - blocker
src/shelfwatch/torch_train.py:110 - OneCycleLR рассчитан на шаг после каждого батча (`total_steps=epochs*len(loader)`), а шагается раз в эпоху: LR застревает в начале разогрева, расписание не отрабатывает - major
src/shelfwatch/torch_train.py:69 - `evaluate` не вызывает `model.eval()`: BatchNorm в train-режиме, running stats портятся валидацией, macro-F1 шумный, а сохранённый чекпоинт и экспорт содержат испорченные статистики - major
src/shelfwatch/torch_train.py:98 - `--resume` грузит только веса: оптимизатор (momentum), планировщик и номер эпохи не сохраняются, цикл идёт с эпохи 0 с начальным LR, расписание перезапускается - major
src/shelfwatch/torch_train.py:115 - `export` нигде не вызывается (ни из `fit`, ни из `main`): заявленный экспорт модели в хранилище не работает - major
src/shelfwatch/torch_train.py:123 - `except Exception: pass` и непроверенный ответ: неудачная загрузка (сеть, 401, 5xx) молча проходит, в хранилище окажется старая модель без каких-либо следов в логах - major
src/shelfwatch/torch_train.py:117 - `torch.save(model)` пикли́т весь объект: файл привязан к путям классов и версии torch, не загрузится с `weights_only=True`; нужен state_dict - major
src/shelfwatch/torch_train.py:20 - CLASSES = full/empty/misplaced, а ImageFolder индексирует папки по алфавиту (empty, full, misplaced): индексы 0 и 1 перепутаны, `predict` выдаст в разметке неверные названия классов - major
src/shelfwatch/torch_train.py:33 - ожидает `shelf/train` и `shelf/val` в формате ImageFolder, а docs/data.md описывает `shelf/` как 600 фото без разбиения и структуры по классам, с YOLO-разметкой; если папок нет, FileNotFoundError, если разбиение делается вручную - риск утечки между train и val (на 600 снимках оценка нестабильна) - major
src/shelfwatch/torch_train.py:22 - токен загрузки зашит в исходник (сейчас тестовая заглушка): настоящий ключ попадёт в историю git; брать из окружения - minor
src/shelfwatch/torch_train.py:91 - `torch.load` без `map_location`: чекпоинт, сохранённый на GPU, не загрузится на машине без CUDA - minor
src/shelfwatch/torch_train.py:83 - `predict` без `torch.no_grad()`: на инференсе строится граф, лишняя память и время - minor
src/shelfwatch/torch_train.py:26 - нет аугментаций и фиксации seed при обучении на 600 фото: быстрое переобучение, результаты не воспроизводятся между запусками - minor
src/shelfwatch/torch_train.py:111 - чекпоинт всегда перезаписывает last.pt, лучшая по macro-F1 эпоха не сохраняется: при переобучении лучшая модель теряется - minor
tests/test_torch_train.py:8 - `build_model()` скачивает предобученные веса из сети: тест нестабилен и падает в оффлайн CI; цикл обучения, resume и планировщики тестами не покрыты (баги выше не пойманы) - minor
