src/shelfwatch/torch_train.py:41 - `shuffle=True` вместе с `sampler` в DataLoader: PyTorch бросает ValueError, обучение не стартует - blocker
src/shelfwatch/torch_train.py:63 - нет `optimizer.zero_grad()` перед `backward()`: градиенты копятся по всем батчам, шаги неверные, потеря расходится - blocker
src/shelfwatch/torch_train.py:110 - `ReduceLROnPlateau.step()` вызван без метрики: TypeError на первой эпохе при `--sched plateau`; нужно `scheduler.step(score)` - blocker
src/shelfwatch/torch_train.py:22 - токен загрузки в хранилище лежит в исходниках (и в git-истории): утечка секрета, токен надо отозвать и брать из окружения - blocker
src/shelfwatch/torch_train.py:110 - `OneCycleLR` рассчитан на шаг после каждого батча (`total_steps=epochs*len(loader)`), а шагает раз в эпоху: LR застревает в начале разгона, расписание не выполняется - major
src/shelfwatch/torch_train.py:73 - `evaluate` не вызывает `model.eval()`: BatchNorm в режиме train на валидации, макро-F1 зашумлён и меняет running stats модели - major
src/shelfwatch/torch_train.py:98 - `--resume` грузит только веса: состояние оптимизатора (momentum), планировщика и номер эпохи не сохраняются, цикл идёт с эпохи 0, OneCycle стартует заново, итоговое число эпох и LR не совпадают с непрерывным запуском - major
src/shelfwatch/torch_train.py:20 - `CLASSES` задан вручную в порядке full/empty/misplaced, а `ImageFolder` индексирует папки по алфавиту (empty/full/misplaced): `predict` и сервис разметки перепутают full и empty - major
src/shelfwatch/torch_train.py:83 - `predict` без `torch.no_grad()`: строится граф автограда, в сервисе растёт память и падает скорость - major
src/shelfwatch/torch_train.py:123 - `except Exception: pass` вокруг загрузки: при отказе хранилища экспорт «успешен», модель в хранилище не попала, никто не узнает - major
src/shelfwatch/torch_train.py:115 - `export` нигде не вызывается (ни из `fit`, ни из `main`): заявленный экспорт в хранилище недостижим - major
src/shelfwatch/torch_train.py:65 - `loss.item()` на каждом батче: синхронизация CPU и GPU на каждой итерации, GPU простаивает; копить тензор `total += loss.detach()` и читать раз в эпоху - minor
src/shelfwatch/torch_train.py:117 - `torch.save(model)` пикирует весь объект: загрузка зависит от путей классов и версии, небезопасна с `weights_only=True`; сохранять `state_dict` - minor
src/shelfwatch/torch_train.py:87 - чекпоинт пишется прямо в `last.pt`: обрыв на записи портит единственный чекпоинт, `--resume` не сработает; писать во временный файл и `os.replace` - minor
src/shelfwatch/torch_train.py:111 - сохраняется только последняя эпоха, лучшей по macro-F1 нет: итоговая модель может быть хуже лучшей - minor
src/shelfwatch/torch_train.py:33 - ждёт `data/shelf/train` и `val`, а docs/data.md описывает `shelf/` как 600 снимков без разбиения: нет кода и описания разбиения, при его отсутствии `ImageFolder` падает - minor
src/shelfwatch/torch_train.py:94 - не заданы seed и детерминизм: метрики между запусками и после resume не воспроизводятся - minor
tests/test_torch_train.py:8 - единственный тест покрывает только форму `predict`; цикл обучения, resume, планировщики и evaluate не проверены, а `build_model` скачивает веса ImageNet из сети - minor
