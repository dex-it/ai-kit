src/shelfwatch/tune.py:69 - objective возвращает train_acc, а val не используется: Optuna отбирает самые переобученные конфигурации, лучшие параметры не обобщаются на валидацию - blocker
src/shelfwatch/tune.py:71 - except Exception возвращает 1.0 при direction="maximize": любое падение (OOM, NaN, баг) становится «лучшим» трайлом, study выберет сломанную конфигурацию и скроет ошибки - blocker
src/shelfwatch/tune.py:77 - абсолютный путь sqlite:////home/dmitry/optuna/shelf.db: у других и в CI каталога нет, запуск упадёт; нет study_name/load_if_exists, повторный запуск смешает или сломает исследования; нужно брать путь из paths.py - blocker
src/shelfwatch/tune.py:104 - torch.compile не лечит заявленное узкое место (60% шага в DataLoader): время шага не упадёт, а компиляция добавит накладные расходы; чинить надо загрузку данных - major
src/shelfwatch/tune.py:21 - num_workers=0 без pin_memory/persistent_workers: загрузка идёт в главном процессе и это и есть найденные 60% шага, GPU простаивает - major
src/shelfwatch/tune.py:39 - накопление градиентов: loss не делится на accum_steps, поэтому эффективный lr в 4 раза больше; хвостовые шаги эпохи не доходят до optimizer.step, а градиенты протекают в следующую эпоху - major
src/shelfwatch/tune.py:91 - сетка 3^6=729 комбинаций ×cv=3 (до 800 деревьев) ≈2200 обучений, n_jobs=-1 вместе с внутренними потоками XGBoost даёт оверсабскрайб; без early stopping и без random search прогон займёт часы/дни - major
src/shelfwatch/tune.py:95 - вывод в docstring «GPU 99%, узких мест нет» противоречит описанию MR (60% в DataLoader); загрузка GPU не значит эффективность, вводит в заблуждение - major
src/shelfwatch/tune.py:96 - профилировщик без schedule на 100 эпох: огромный trace и память, искажение замеров; ProfilerActivity.CUDA на машине без GPU бесполезен, run_epoch без синхронизации; trace.json пишется в cwd и не в .gitignore - major
src/shelfwatch/tune.py:119 - ветвление по данным (x.abs().sum() > 1e4) в compile: graph break с синхронизацией GPU→CPU на каждый вызов, ускорения нет; решение принимается по сумме всего батча, поэтому результат зависит от размера батча и состава, а не от объекта - major
src/shelfwatch/tune.py:109 - mode="max-autotune" для прогонов по 2-3 минуты: автотюнинг и компиляция длятся дольше выигрыша, ночной пакет станет медленнее - major
src/shelfwatch/tune.py:59 - lr от 1e-4 до 0.1 без log=True: почти вся выборка в верхнем порядке, нижние значения почти не исследуются - minor
src/shelfwatch/tune.py:60 - hidden_dim 10..1000 линейно, а не по лог-шкале/степеням двух: слабый поиск, неэффективные ширины - minor
src/shelfwatch/tune.py:67 - 50 эпох на трайл × 100 трайлов без pruning, seed и early stopping: дорого и невоспроизводимо - minor
src/shelfwatch/tune.py:42 - .item() на каждом шаге вызывает синхронизацию GPU и замедляет цикл; копить на устройстве - minor
src/shelfwatch/tune.py:64 - модели трайлов не освобождаются (нет del/empty_cache), на GPU возможна утечка памяти за 100 трайлов - minor
src/shelfwatch/tune.py:115 - RoutedNet строит main и rare одной ширины, rare для редких SKU, видимо, обучается без данных и не имеет обучения/тестов - minor
tests/test_tune.py:7 - y = zeros % N_CLASSES бессмысленен, и тест проверяет только форму батча из make_loader; objective, run_epoch, tune_xgb, compile_* не покрыты - minor
