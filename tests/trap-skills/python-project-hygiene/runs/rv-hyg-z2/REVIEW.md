src/shelfwatch/legacy_features.py:8 - `total + " руб."` складывает число и строку: всегда TypeError (даже при пустом rows, total=0), функция не работает ни на каких данных - blocker
tests/test_legacy_features.py:8 - дымовой тест вызывает store_score([], 1.0), что падает с TypeError: тест красный, джоб tests в CI не пройдёт, MR не мержится - blocker
pytest.ini:1 - при наличии pytest.ini секция [tool.pytest.ini_options] из pyproject.toml игнорируется целиком: testpaths и addopts (покрытие) не действуют, настройки живут в двух местах и расходятся (маркер gpu только тут) - major
.gitlab-ci.yml:12 - `ruff format .` без `--check` в CI переформатирует файлы в раннере и всегда завершается успехом: гейт форматирования ничего не проверяет - major
pyproject.toml:51 - indent-style = "tab" конфликтует с выбранным правилом W191 (отступы табами) и с PEP 8; ruff предупреждает о конфликте, а `ruff format` перепишет все существующие файлы на табы - major
pyproject.toml:46 - в select включён весь набор "D" (pydocstyle): store_score и тест без докстрингов дают D103, `ruff check .` в джобе lint упадёт на коде из самого MR - major
tests/test_legacy_features.py:6 - опечатка в маркере `slwo`: он не зарегистрирован (PytestUnknownMarkWarning), а при --strict-markers тест не соберётся; к тому же дымовой тест не должен быть slow - minor
.gitlab-ci.yml:19 - `pytest .` вместо `pytest` обходит testpaths и собирает тесты со всего репозитория, включая не относящиеся к тестам каталоги - minor
.gitlab-ci.yml:7 - `pip install -U ruff mypy pytest pytest-cov` без пинов версий: новая версия инструмента сломает пайплайн без изменений в коде (pytest.ini требует minversion 8.0, зависимости не зафиксированы) - minor
.gitlab-ci.yml:4 - переменная PYPI_TOKEN с литералом в репозитории нигде не используется; заведённый паттерн приведёт к тому, что туда положат настоящий токен - minor
pyproject.toml:55 - mypy files включает tests, а CI запускает `mypy src`: тесты не проверяются, конфиг и CI расходятся; при этом функция без аннотаций не проверяется mypy вообще, и ошибка в legacy_features.py:8 гейтом не ловится - minor
