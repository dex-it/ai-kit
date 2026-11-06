src/shelfwatch/finetune.py:27 - токенизация по одному тексту в цикле, ещё и без truncation (max_length без truncation=True игнорируется): медленная подготовка данных, длинные отзывы дадут последовательности больше 512 и падение на BERT - major
src/shelfwatch/finetune.py:36 - замораживается весь base_model, включая эмбеддинги, после resize_token_embeddings: новые [PRODUCT]/[SHOP] остаются случайными и не обучаются, тональность по ним не выучится, смысл новых токенов теряется - major
src/shelfwatch/finetune.py:42 - дообучение тональности без прогрева (нет warmup_steps): нестабильные первые шаги, возможна деградация предобученных весов - major
src/shelfwatch/finetune.py:45 - 20 эпох при замороженной базе без early stopping и без метрики для load_best_model_at_end: лишнее время обучения и переобучение на голове - minor
src/shelfwatch/finetune.py:52 - сохраняется только модель, токенизатор с [PRODUCT]/[SHOP] не сохраняется: сервис не воспроизведёт словарь, id новых токенов не совпадут с размером эмбеддингов - blocker
src/shelfwatch/finetune.py:57 - classify_batch грузит токенизатор из BERT (без спец-токенов) и модель при каждом вызове: [PRODUCT]/[SHOP] разобьются на подслова, предсказания исказятся, плюс сотни мс на загрузку каждый вызов - blocker
src/shelfwatch/finetune.py:59 - padding="max_length" до 512 на CPU: каждый отзыв считается как 512 токенов, p95 50 мс не выдержать - major
src/shelfwatch/finetune.py:22 - HF_TOKEN захардкожен в коде (сейчас тестовая заглушка): при замене на реальный ключ он уйдёт в репозиторий; брать из окружения - minor
src/shelfwatch/finetune.py:64 - tokenizer(words) без is_split_into_words=True: список слов трактуется как пачка текстов, word_ids() недоступен/неверен, разметка NER сломана - blocker
src/shelfwatch/finetune.py:66 - метка слова копируется на каждое подслово, включая B-метки (B-PROD на всех подсловах): ложные начала сущностей, ошибки на выделении границ; нужны -100 на продолжениях или B->I - major
src/shelfwatch/finetune.py:72 - align_labels копирует метку слова на каждое подслово (B- остаётся на всех), тест это закрепляет: та же ошибка границ сущностей - major
src/shelfwatch/finetune.py:80 - learning_rate=1e-3 для полного дообучения BERT: катастрофическое забывание, расходимость, NER не обучится - blocker
src/shelfwatch/finetune.py:82 - warmup_steps=0.1 допустим (доля из [0, 1)), но отсутствует data collator для паддинга при batch>1 и нет save_strategy/метрик: Trainer упадёт на батчах разной длины - major
src/shelfwatch/finetune.py:89 - QLoRA без bnb_4bit_quant_type="nf4", compute_dtype и prepare_model_for_kbit_training: хуже качество и нестабильность обучения 4-битной базы - minor
src/shelfwatch/finetune.py:91 - LoRA r=4 только на q_proj: слабая ёмкость адаптера, сводка будет плохо обучаться - minor
src/shelfwatch/finetune.py:98 - сводка по одному отзыву в цикле без батча и без truncation: низкая пропускная способность, длинный вход переполнит контекст - minor
src/shelfwatch/finetune.py:99 - жадное декодирование (do_sample=False) без repetition_penalty/no_repeat_ngram_size: зацикливание и повторы в сводке; max_length=1000 считает вместе с промптом, вместо max_new_tokens - major
src/shelfwatch/finetune.py:106 - экспортируется только адаптер, база подтягивается по имени, а сервис работает без peft: сводчик в сервисе не загрузится/нужна сеть и peft; нужен merge_and_unload в полной точности и сохранение токенизатора - blocker
src/shelfwatch/finetune.py:111 - модель в fp32 на CPU при заданном бюджете p95 ≤ 50 мс и экспорте в ONNX без квантования: бюджет, скорее всего, не выдержать; нужно динамическое int8-квантование nn.Linear (веса и активации) не через deprecated torch.ao.quantization.quantize_dynamic, и замер p95 - major
tests/test_finetune.py:4 - тест проверяет только align_labels (и закрепляет копирование меток на подслова); нет тестов токенизации, NER-кодирования, загрузки для сервиса - minor
