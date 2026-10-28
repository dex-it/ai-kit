src/shelfwatch/legacy_features.py:8 - `total + " руб."` складывает число и str: TypeError при любом вызове (даже с пустым rows, 0 + str), mypy тоже падает с operator error; функция не работает - blocker
tests/test_legacy_features.py:8 - тест вызывает store_score([], 1.0), который падает с TypeError, поэтому джоб tests красный; «дымовой тест» не проходит, а `is not None` слишком слабая проверка - blocker
.gitlab-ci.yml:11 - `ruff format .` без `--check` переписывает файлы в раннере и всегда завершается 0, формат-гейт ничего не проверяет - major
pyproject.toml:51 - `indent-style = "tab"` противоречит W191 из select (строка 46) и всему существующему коду на пробелах: после format весь репозиторий уйдёт в tab-диффы, а ruff check будет ругаться на W191 - major
pyproject.toml:46 - правило "D" включено целиком, а в коде нет докстрингов функций (legacy_features.py:4, test_legacy_features.py:7): D103 валит `ruff check .`, ещё и конфликтующие пары D203/D211, D212/D213 дают предупреждения - major
pytest.ini:1 - наличие pytest.ini полностью отключает [tool.pytest.ini_options] из pyproject.toml (строки 58-61): testpaths и addopts с --cov молча не применяются, конфиг дублируется и расходится (gpu только в pytest.ini) - major
tests/test_legacy_features.py:6 - опечатка в маркере `slwo` вместо `slow`: маркер не зарегистрирован, без --strict-markers лишь предупреждение, а фильтр `-m "not slow"` этот тест не исключит - minor
pytest.ini:3 - нет `--strict-markers` в addopts, поэтому опечатки в маркерах не ловятся - minor
.gitlab-ci.yml:6 - `pip install -U ruff mypy pytest pytest-cov` игнорирует версии, закреплённые в dev-группе pyproject.toml (ruff 0.17.1, mypy 2.4.0 и т.д.): CI не воспроизводим и сломается при выходе новых версий - major
.gitlab-ci.yml:7 - `pip install -e .` тянет torch, tensorflow, transformers и пр. в каждый из трёх джобов без кэша pip: медленный пайплайн и риск таймаута - minor
.gitlab-ci.yml:3 - PYPI_TOKEN объявлен в variables на уровне пайплайна и доступен всем джобам, хотя не используется; при замене на реальный секрет он утечёт в логи/джобы MR - minor
.gitlab-ci.yml:19 - `pytest .` переопределяет testpaths, а pytest-cov в addopts не применяется (см. pytest.ini); порога покрытия (--cov-fail-under) нет, покрытие не гейтится - minor
pyproject.toml:55 - `ignore_missing_imports = true` глобально скрывает ошибки импорта (в т.ч. опечатки в именах модулей) и при этом нет strict/disallow_untyped_defs, так что mypy почти ничего не проверяет (legacy-функция без аннотаций проходит) - minor
pyproject.toml:54 - mypy `files = ["src", "tests"]`, а CI запускает `mypy src` — тесты не проверяются, конфиг и джоб расходятся - minor
