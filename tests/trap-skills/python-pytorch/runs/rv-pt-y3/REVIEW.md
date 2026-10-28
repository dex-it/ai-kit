src/shelfwatch/torch_train.py:41 - `shuffle=True` вместе с `sampler=` взаимоисключающи: DataLoader бросит ValueError, обучение не стартует - blocker
src/shelfwatch/torch_train.py:63 - нет `optimizer.zero_grad()`: градиенты копятся между батчами, шаги всё больше искажены, модель расходится или не обучается - blocker
src/shelfwatch/torch_train.py:110 - `ReduceLROnPlateau.step()` без метрики бросает TypeError на первой эпохе при `--sched plateau`; нужен `scheduler.step(score)` - blocker
src/shelfwatch/torch_train.py:110 - OneCycleLR рассчитан на шаг после каждого батча (`total_steps=epochs*len(loader)`), а шаг делается раз в эпоху: LR остаётся около стартового, расписание не отрабатывает, модель обучается хуже - major
src/shelfwatch/torch_train.py:69 - `evaluate` без `model.eval()`: BatchNorm работает в режиме train, считает статистики по батчу и портит running stats; macro-F1 на val искажён, выбор модели по нему ненадёжен - major
src/shelfwatch/torch_train.py:20 - `CLASSES = [full, empty, misplaced]`, а ImageFolder сортирует классы по алфавиту (empty, full, misplaced): индексы разойдутся, потребители будут подписывать предсказания чужими классами - major
src/shelfwatch/torch_train.py:97 - `--resume` грузит только веса: optimizer (momentum), scheduler и номер эпохи не сохранены, цикл идёт с эпохи 0 с полным LR и OneCycle заново; возобновление не продолжает обучение, а портит его - major
src/shelfwatch/torch_train.py:111 - чекпоинт перезаписывается напрямую `torch.save` в last.pt: сбой посреди записи оставит битый файл и убьёт и resume; лучшего по F1 чекпоинта нет, лучшая эпоха теряется - minor
src/shelfwatch/torch_train.py:65 - `loss.item()` на каждом батче: синхронизация CPU с GPU на каждом шаге, простои GPU (дисциплина); копить тензор `total += loss.detach()` и читать раз в эпоху - major
src/shelfwatch/torch_train.py:123 - `except Exception: pass` вокруг загрузки: при сбое сети или 401 экспорт молча «успешен», модель в хранилище не попадает, узнают при деплое - major
src/shelfwatch/torch_train.py:22 - токен загрузки зашит в исходник (значение помечено как тестовое, но схема остаётся): реальный токен попадёт в git; брать из окружения - major
src/shelfwatch/torch_train.py:117 - `torch.save(model)` пикует весь объект: файл завязан на путь класса и версию torch, загрузка требует `weights_only=False` (произвольный код при загрузке чужого файла); экспортировать `state_dict` - minor
src/shelfwatch/torch_train.py:115 - `export` нигде не вызывается ни из `fit`, ни из `main`: заявленный в MR экспорт в хранилище не работает - major
src/shelfwatch/torch_train.py:83 - `predict` без `torch.no_grad()`: на каждый вызов из сервиса строится граф и держится память активаций, на нагрузке растёт потребление памяти - major
src/shelfwatch/torch_train.py:33 - код ждёт `shelf/train` и `shelf/val`, а docs/data.md описывает `shelf/` как 600 фото без разбиения; на данных по документации падает FileNotFoundError, правила сплита не заданы - minor
tests/test_torch_train.py:6 - тест покрывает только `predict`; цикл обучения, resume, планировщики, evaluate не проверены (именно в них находки выше), а `build_model` в тесте тянет веса из сети - minor
