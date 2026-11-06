src/shelfwatch/tune.py:70 - `except Exception: return 1.0` при direction="maximize": любое падение трайла (OOM, NaN, баг) получает максимальный скор, Optuna выберет сломанную конфигурацию как лучшую и скроет ошибки - blocker
src/shelfwatch/tune.py:68 - objective возвращает train-accuracy, а `val` нигде не используется: подбор поощряет переобучение, выбранные гиперпараметры не обобщаются - blocker
src/shelfwatch/tune.py:77 - storage sqlite на абсолютном личном пути `/home/dmitry/...` без study_name/load_if_exists: на CI и у других запуск упадёт, а повторные запуски создают новые безымянные study - major
src/shelfwatch/tune.py:39 - градиентная аккумуляция: loss не делится на accum_steps (эффективный lr в 4 раза больше), а хвост эпохи не кончается step/zero_grad - остаточные градиенты протекают в следующую эпоху/трайл, результаты искажены - major
src/shelfwatch/tune.py:21 - num_workers=0 и нет pin_memory: это и есть заявленные 60% времени в DataLoader, а MR его не чинит (загрузка остаётся в основном процессе, GPU простаивает) - major
src/shelfwatch/tune.py:104 - torch.compile модели не ускоряет узкое место из описания (DataLoader): выигрыша по шагу не будет, зато добавятся время компиляции и риск перекомпиляций - major
src/shelfwatch/tune.py:95 - вывод «GPU загружена на 99%, узких мест нет» противоречит 60% в DataLoader; профиль без schedule/warmup на 100 эпохах пишет гигантский трейс и вносит накладные расходы, выводы ненадёжны - major
src/shelfwatch/tune.py:119 - ветвление по данным `x.abs().sum() > 1e4` в compile: graph break и device-sync на каждый вызов (или перекомпиляции), компиляция роутера бесполезна; к тому же весь батч уходит в одну ветку по сумме - major
src/shelfwatch/tune.py:83 - полная сетка 3^6=729 комбинаций × cv=3 (до 800 деревьев) ≈ 2200 фитов с n_jobs=-1 при многопоточном XGBoost: оверсабскрипшн CPU, многочасовой прогон, без early stopping/random search - major
src/shelfwatch/tune.py:109 - mode="max-autotune" для коротких прогонов на 2-3 минуты: автотюнинг компиляции съест выигрыш, по времени станет медленнее - minor
src/shelfwatch/tune.py:59 - lr в диапазоне 1e-4..0.1 без log=True: почти вся выборка приходится на крупные lr, мелкие значения почти не исследуются; hidden_dim 10..1000 тоже линейно - minor
src/shelfwatch/tune.py:67 - 50 эпох × 100 трайлов без pruner/report и без seed: дорого и невоспроизводимо - minor
src/shelfwatch/tune.py:42 - `.item()` на каждом шаге вызывает синхронизацию GPU и тормозит обучение - minor
tests/test_tune.py:7 - `zeros % N_CLASSES` бессмысленно, тест покрывает только make_loader; objective, accum, tune, compile не проверены - minor
