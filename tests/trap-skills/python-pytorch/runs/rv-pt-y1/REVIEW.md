src/shelfwatch/torch_train.py:41 - `shuffle=True` вместе с `sampler=` взаимоисключающи: DataLoader бросает ValueError при создании, обучение не стартует ни в одном режиме - blocker
src/shelfwatch/torch_train.py:61 - нет `optimizer.zero_grad()`: градиенты копятся между батчами, шаги неверные, обучение расходится или не сходится - blocker
src/shelfwatch/torch_train.py:110 - `ReduceLROnPlateau.step()` вызван без метрики (нужен `score`): TypeError на первой эпохе при `--sched plateau` - blocker
src/shelfwatch/torch_train.py:110 - OneCycleLR рассчитан на `epochs * len(train_loader)` шагов, а `step()` вызывается раз в эпоху: LR остаётся в начале прогрева, расписание не выполняется, модель недообучена - major
src/shelfwatch/torch_train.py:69 - `evaluate` без `model.eval()`: BatchNorm работает в train-режиме и портит running stats валидационными батчами, macro-F1 шумит и чекпоинт хуже - major
src/shelfwatch/torch_train.py:20 - `CLASSES` не в алфавитном порядке, а `ImageFolder` сортирует папки (empty, full, misplaced): индексы модели не совпадают с именами, сервис разметки выдаст перепутанные метки full/empty - major
src/shelfwatch/torch_train.py:86 - чекпоинт хранит только веса: при `--resume` теряются optimizer (momentum), scheduler и номер эпохи, цикл `range(epochs)` стартует с 0 и расписание начинается заново; возобновление не продолжает прогон - major
src/shelfwatch/torch_train.py:115 - `export` нигде не вызывается (ни из `fit`, ни из `main`): заявленный экспорт в хранилище не работает - major
src/shelfwatch/torch_train.py:123 - `except Exception: pass` глотает ошибку и статус ответа не проверяется: неудачная загрузка остаётся незамеченной, модель не в хранилище при «успехе» - major
src/shelfwatch/torch_train.py:22 - токен загрузки в исходниках (в git-истории навсегда); при реальном значении утечёт, ротация только через правку кода; брать из окружения - major
src/shelfwatch/torch_train.py:117 - `torch.save(model)` пиклит весь класс: файл привязан к версии torch/torchvision и коду, грузится только с `weights_only=False` (исполнение произвольного кода из хранилища); сохранять state_dict - major
src/shelfwatch/torch_train.py:65 - `loss.item()` на каждом батче синхронизирует CPU с GPU и тормозит обучение (дисциплина); копить тензор `total += loss.detach()` и читать раз за эпоху - major
src/shelfwatch/torch_train.py:83 - `predict` без `torch.no_grad()`/`inference_mode`: строится граф, лишняя память на каждом вызове из сервиса, результат с `requires_grad` - minor
src/shelfwatch/torch_train.py:91 - `torch.load` без `map_location`: чекпоинт с GPU не загрузится на CPU-машине - minor
src/shelfwatch/torch_train.py:111 - `last.pt` перезаписывается напрямую каждую эпоху: сбой во время записи портит единственный чекпоинт; лучшей по F1 модели нет - minor
src/shelfwatch/torch_train.py:33 - ожидает `shelf/train` и `shelf/val`, а в docs/data.md `shelf/` описан без разбиения (600 фото); без документированного сплита (по магазину/полке) возможна утечка и завышенный F1 - minor
src/shelfwatch/torch_train.py:26 - одинаковый transform без аугментаций для train на 600 фото: быстрое переобучение - minor
tests/test_torch_train.py:6 - один тест на `predict`; нет проверок цикла обучения, resume, планировщиков (ошибки выше прошли бы), `build_model` тянет предобученные веса из сети - minor
