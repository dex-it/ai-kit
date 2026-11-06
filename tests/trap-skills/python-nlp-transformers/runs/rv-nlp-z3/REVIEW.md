src/shelfwatch/finetune.py:7 - модуль на верхнем уровне импортирует peft и bitsandbytes, а classify_batch/load_for_serving живут в нём же; в образе сервиса разметки без peft импорт упадёт с ImportError, сервис не запустится - blocker
src/shelfwatch/finetune.py:106 - сохраняется только LoRA-адаптер, базовая модель подтягивается по имени: без peft адаптер не загрузить, а сеть/кэш HF в проде не гарантированы; нужен merge_and_unload и сохранение целой модели (4-бит bitsandbytes на CPU тоже не работает) - blocker
src/shelfwatch/finetune.py:57 - токенизатор и модель загружаются с диска на каждый вызов classify_batch: сотни мс на запрос, p95 50 мс недостижим - blocker
src/shelfwatch/finetune.py:59 - padding="max_length" на 512 для любой пачки: на CPU каждый отзыв считается как 512 токенов, бюджет 50 мс p95 нарушен; нужен динамический padding и меньший max_length - major
src/shelfwatch/finetune.py:57 - токенизатор берётся из BERT без [PRODUCT]/[SHOP], а модель обучена с расширенным словарём и токенизатор нигде не сохранён (стр. 52): спец-токены разобьются на куски, предсказания в проде деградируют - major
src/shelfwatch/finetune.py:36 - заморожена вся base_model, включая эмбеддинги: новые строки [PRODUCT]/[SHOP] остаются случайными и не обучаются, учится только голова, смысла в добавленных токенах нет и качество будет низким - major
src/shelfwatch/finetune.py:27 - max_length без truncation=True игнорируется (только предупреждение); отзывы до 600 токенов превысят 512 BERT и упадут с ошибкой индексации позиций - major
src/shelfwatch/finetune.py:51 - Trainer без processing_class и data collator: батчи разной длины не паддятся, обучение упадёт на сборке батча, токенизатор не сохранится с чекпоинтами - major
src/shelfwatch/finetune.py:45 - 20 эпох без early stopping на небольшой выборке: переобучение и лишнее время GPU; выбор лучшей модели только по eval_loss, без macro-F1 - minor
src/shelfwatch/finetune.py:66 - tokenizer(words) без is_split_into_words=True: список слов трактуется как батч, word_ids() без индекса падает/возвращает неверное выравнивание, NER-данные не соберутся - major
src/shelfwatch/finetune.py:72 - метка B-* копируется на каждое подслово (и в align_labels, и в encode_for_ner); у продолжений должна быть I-* или -100, иначе сущности дробятся и обучение/метрика искажаются; функция дублирует логику encode_for_ner - minor
src/shelfwatch/finetune.py:80 - learning_rate=1e-3 для полного дообучения BERT: веса разойдутся, модель выдаст константу/NaN - major
src/shelfwatch/finetune.py:82 - warmup_steps=0.1 задан как доля, а параметр означает шаги: прогрев фактически нулевой или ошибка валидации; нужен warmup_ratio - minor
src/shelfwatch/finetune.py:85 - train_ner не сохраняет ни модель, ни токенизатор (нет save_pretrained): результат обучения потеряется - major
src/shelfwatch/finetune.py:22 - токен HF захардкожен в коде (пусть и заглушка) и передаётся в from_pretrained: невалидный токен даёт 401 даже на публичных моделях, настоящий уйдёт в историю git; брать из окружения - minor
src/shelfwatch/finetune.py:89 - load_in_4bit без bnb_4bit_quant_type="nf4", compute dtype и prepare_model_for_kbit_training (стр. 92): это неполноценный QLoRA, обучение нестабильнее и хуже по качеству - minor
src/shelfwatch/finetune.py:91 - LoRA r=4 только на q_proj: ёмкости мало для сводки; цикла обучения сводчика в MR нет, заявленный QLoRA не воспроизводим - minor
src/shelfwatch/finetune.py:98 - у Qwen2.5-Instruct промпт без chat template: сводки будут низкого качества и непредсказуемого формата - minor
src/shelfwatch/finetune.py:99 - max_length=1000 включает длину промпта (вместо max_new_tokens), а decode (стр. 100) декодирует gen[0] целиком вместе с промптом: в «сводку» попадает исходный отзыв, генерация может быть чрезмерно длинной - major
src/shelfwatch/finetune.py:6 - datasets импортируется, но отсутствует в зависимостях pyproject.toml: на чистой установке модуль не импортируется, тесты падают - major
tests/test_finetune.py:4 - тест проверяет только тривиальную маску align_labels; токенизация, encode_for_ner, сервисная загрузка и p95 не покрыты, ошибки выше пройдут CI - minor
