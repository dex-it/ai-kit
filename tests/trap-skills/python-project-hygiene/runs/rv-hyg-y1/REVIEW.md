src/shelfwatch/legacy_features.py:8 - `total + " руб."` складывает число и строку: store_score падает с TypeError при любом вызове (даже с пустым rows, 0 + str), смоук-тест красный, джоб tests не пройдёт, а в проде функция бесполезна - blocker
pytest.ini:1 - при наличии pytest.ini секция [tool.pytest.ini_options] в pyproject.toml игнорируется целиком: не работают testpaths и addopts (--cov), покрытие не измеряется, маркеры живут в двух местах и расходятся (gpu только здесь) - major
pyproject.toml:60 - покрытие подключено, но нет --cov-fail-under: падение покрытия до нуля не остановит MR (и addopts всё равно не действует из-за pytest.ini) - major
pyproject.toml:58 - нет filterwarnings = error: предупреждения pytest (в т.ч. PytestUnknownMarkWarning) и deprecations копятся молча, ломаются при обновлении зависимостей - major
pyproject.toml:56 - ignore_missing_imports = true на весь проект: опечатки в импортах и отсутствующие стабы маскируются, mypy превращается в формальность; нужны точечные [[tool.mypy.overrides]] - major
.gitlab-ci.yml:1 - в CI нет шага аудита зависимостей (pip-audit): уязвимые пакеты попадут в сборку незамеченными - major
.gitlab-ci.yml:14 - `ruff format .` без --check переформатирует файлы в рабочей копии CI и всегда зелёный: проверка форматирования не работает - major
.gitlab-ci.yml:7 - `pip install -U ruff mypy pytest pytest-cov` без версий: сборки невоспроизводимы, свежий релиз линтера может сломать пайплайн без изменений в коде; pytest-cov/mypy не вынесены в dev-зависимости проекта - minor
.gitlab-ci.yml:21 - `pytest .` переопределяет testpaths и собирает всё дерево, а не tests; при этом конфиг покрытия не применяется - minor
.gitlab-ci.yml:18 - mypy запускается только по src, а в pyproject files = ["src","tests"]: тесты не проверяются типами, расхождение конфигурации и CI - minor
pyproject.toml:46 - правило D включено без исключений для D103 и tests/: legacy_features.store_score и test_store_score_runs без docstring дают ruff-ошибки, джоб lint красный - major
pyproject.toml:51 - indent-style = "tab" вместе с выбранным W (W191) и существующим кодом на пробелах: конфликт форматтера и линтера, массовый шум в диффах при первом format - minor
pyproject.toml:55 - mypy не настроен на strict/disallow_untyped_defs: store_score без аннотаций не проверяется, и ошибка сложения str с числом проходит мимо типизации - minor
tests/test_legacy_features.py:6 - опечатка в маркере `slwo`: маркер не зарегистрирован, тест не попадает в выборку -m slow, при строгих предупреждениях/--strict-markers упадёт сбор тестов - minor
tests/test_legacy_features.py:8 - дымовой тест `is not None` с пустым rows не проверяет поведение (и не охватывает ветку с данными): регрессии в расчёте не поймает - minor
