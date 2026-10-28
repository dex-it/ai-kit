src/shelfwatch/legacy_features.py:8 - `total + " руб."` складывает число и строку: TypeError при любом вызове (даже с пустым rows, total=0), функция неработоспособна; «дымовой» тест красный - blocker
pytest.ini:1 - pytest.ini приоритетнее pyproject.toml: секция [tool.pytest.ini_options] (testpaths, addopts с --cov, markers) полностью игнорируется, покрытие не считается, настройки раздвоены и расходятся (gpu только здесь) - major
tests/test_legacy_features.py:7 - опечатка маркера `slwo` (вместо `slow`): маркер не зарегистрирован, при --strict-markers упадёт на сборке, а без него молча не попадёт в фильтр `-m "not slow"` - major
.gitlab-ci.yml:20 - `pytest .` переопределяет testpaths и собирает весь репозиторий, а не tests/; плюс настройки pyproject не действуют (см. pytest.ini) - minor
.gitlab-ci.yml:12 - `ruff format .` без `--check` переписывает файлы в раннере и всегда успешен: проверка форматирования ничего не гейтит - major
pyproject.toml:51 - indent-style = "tab" конфликтует с выбранным правилом W191 (и PEP 8 проекта): format будет менять отступы на табы, а lint ругаться на них; весь существующий код превратится в diff - major
pyproject.toml:46 - в select включён "D" без docstring-конвенции: legacy_features.store_score (D103) и тест без docstring валят `ruff check .` - джоб lint красный - major
pyproject.toml:55 - mypy files включает tests, а CI запускает `mypy src`: тесты не проверяются, конфиг и CI расходятся; store_score без аннотаций mypy не проверяет (check_untyped_defs выключен), ошибка сложения str+int проходит незамеченной - minor
.gitlab-ci.yml:7 - ruff, mypy, pytest ставятся без версий (-U): новые релизы линтеров будут внезапно ломать пайплайн, сборки невоспроизводимы - minor
.gitlab-ci.yml:4 - переменная PYPI_TOKEN в открытом виде в CI-файле и нигде не используется: секреты в репозитории, попадут во все джобы; убрать, при необходимости задавать через masked CI/CD variable - minor
