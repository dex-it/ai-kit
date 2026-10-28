src/shelfwatch/legacy_features.py:8 - `total + " руб."` складывает число со строкой: любой вызов (даже с пустым `rows`) падает с TypeError, функция неработоспособна и дымовой тест упадёт - blocker
tests/test_legacy_features.py:6 - опечатка в маркере `slwo` (в pytest.ini есть `slow`): маркер незарегистрирован, без `--strict-markers` это лишь предупреждение, тест не попадёт в отбор по `-m slow`, а при будущем `-W error` сломает сборку - major
tests/test_legacy_features.py:8 - дымовой тест проверяет только `is not None` на пустом входе, не ловит ошибку на legacy_features.py:8 (на самом деле падает) и не проверяет значение; «покрытие» мнимое - major
pytest.ini:1 - при наличии pytest.ini секция `[tool.pytest.ini_options]` в pyproject.toml игнорируется целиком: `testpaths` и `addopts` (--cov) не действуют, покрытие в CI не измеряется, маркеры продублированы и расходятся (`gpu` только здесь) - major
pyproject.toml:58 - покрытие измеряется (`--cov`), но порога `--cov-fail-under` нет: покрытие может падать до нуля без красного пайплайна (и addopts всё равно не работает из-за pytest.ini) - major
pyproject.toml:56 - нет `filterwarnings = ["error"]`: предупреждения pytest (в т.ч. неизвестный маркер, deprecations) остаются тихими и копятся до поломки при обновлении - major
pyproject.toml:54 - `ignore_missing_imports = true` на весь проект: отсутствующие или опечатанные импорты и stubs не обнаруживаются, типы third-party молча становятся Any; нужны точечные `[[tool.mypy.overrides]]` - major
.gitlab-ci.yml:1 - в CI нет шага аудита зависимостей (pip-audit): уязвимые версии пакетов попадут в релиз незамеченными - major
.gitlab-ci.yml:13 - `ruff format .` без `--check` переформатирует файлы внутри джоба и всегда зелёный: проверка форматирования не гейт, нарушения не блокируют MR - major
.gitlab-ci.yml:21 - `pytest .` вместо `pytest` обходит `testpaths`; плюс pytest.ini перекрывает pyproject, так что запуск зависит от каталога и конфига - minor
.gitlab-ci.yml:7 - `pip install -U ruff mypy pytest pytest-cov` без версий: новые релизы линтеров/mypy будут ломать пайплайн без изменений в коде, сборки невоспроизводимы - minor
.gitlab-ci.yml:4 - токен `PYPI_TOKEN` лежит в variables в репозитории (в значении «FAKE»), но шаблон приучает хранить секреты в файле; в CI джобы его не используют - minor
pyproject.toml:49 - `indent-style = "tab"` конфликтует с правилом W191 из `select = ["W"]` и с PEP 8: ruff check будет ругаться на отформатированный самим же ruff код, lint-джоб красный - major
pyproject.toml:44 - выбрано правило `D` (docstring) без конвенции, а у `store_score` и теста нет docstring (D103): `ruff check .` падает на самом PR - major
pyproject.toml:53 - mypy `files` включает `tests`, а в CI запускается `mypy src`: конфиг и джоб расходятся, тесты не проверяются типами - minor
src/shelfwatch/legacy_features.py:4 - функция без аннотаций типов: mypy по умолчанию не проверяет её тело, поэтому ошибку на строке 8 гейт `mypy src` не поймал (нужен `disallow_untyped_defs` или аннотации) - major
