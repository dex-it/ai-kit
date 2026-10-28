src/shelfwatch/torch_train.py:41 - `shuffle=True` вместе с `sampler` взаимоисключающи: DataLoader бросает ValueError, обучение не стартует - blocker
src/shelfwatch/torch_train.py:63 - нет `optimizer.zero_grad()`: градиенты копятся между батчами, обучение расходится/не сходится - blocker
src/shelfwatch/torch_train.py:110 - `scheduler.step()` без метрики для ReduceLROnPlateau бросает TypeError в конце первой эпохи; режим `--sched plateau` неработоспособен (нужно `step(score)`) - blocker
src/shelfwatch/torch_train.py:110 - OneCycleLR рассчитан на шаг за батч (total_steps=epochs*len(loader)), а шагается раз за эпоху: LR застревает в начале разогрева, расписание не выполняется - major
src/shelfwatch/torch_train.py:69 - в `evaluate` нет `model.eval()`: BatchNorm в train-режиме обновляет running stats на val и даёт зашумлённый macro-F1, метрика неверна и сохранённые статистики загрязнены - major
src/shelfwatch/torch_train.py:98 - `--resume` грузит только веса: optimizer (momentum), scheduler и номер эпохи не сохраняются, `range(epochs)` и расписание начинаются заново, возобновление не продолжает прерванный запуск - major
src/shelfwatch/torch_train.py:111 - чекпоинт `last.pt` перезаписывается напрямую (не атомарно): падение во время записи портит единственный файл, и resume невозможен; лучшая по macro-F1 эпоха не сохраняется, итоговая модель может быть хуже - major
src/shelfwatch/torch_train.py:20 - порядок CLASSES (full, empty, misplaced) не совпадает с алфавитным порядком индексов ImageFolder (empty, full, misplaced): предсказания получат перепутанные имена классов - major
src/shelfwatch/torch_train.py:33 - `DATA_DIR/shelf/train` и `val` не описаны в docs/data.md (там 600 фото без разбиения, разметка YOLO): откуда и как делается сплит неизвестно, возможна утечка между train/val или падение на отсутствующем каталоге - major
src/shelfwatch/torch_train.py:22 - токен загрузки захардкожен в исходниках и попадает в историю git; должен браться из окружения/секретов - major
src/shelfwatch/torch_train.py:123 - `except Exception: pass` глотает ошибки загрузки, ответ не проверяется: экспорт молча не происходит, при этом считается успешным - major
src/shelfwatch/torch_train.py:117 - `torch.save(model)` пикклит весь объект (завязан на код/версии, небезопасная загрузка); экспортировать нужно state_dict; к тому же `export` нигде не вызывается из `fit`/`main`, экспорта фактически нет - major
src/shelfwatch/torch_train.py:83 - `predict` без `torch.no_grad()`: строится граф, растёт память в сервисе разметки - minor
src/shelfwatch/torch_train.py:91 - `torch.load` без `map_location`: чекпоинт, сохранённый на GPU, не загрузится на CPU-машине - minor
src/shelfwatch/torch_train.py:26 - нет аугментаций и фиксации seed для train на 600 фото: быстрое переобучение, невоспроизводимые результаты - minor
src/shelfwatch/torch_train.py:36 - sampler сбалансирован по классам, а val-метрика не проверяет распределение; при пустом классе в train `1/counts` даёт inf - minor
tests/test_torch_train.py:8 - тест вызывает `build_model` со скачиванием весов ImageNet (сеть) и не покрывает обучение, resume, планировщики, evaluate; перечисленные выше блокеры не ловятся - minor
