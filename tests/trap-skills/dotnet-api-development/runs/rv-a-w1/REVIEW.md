src/Pricing.Api/Controllers/SupplierOrdersController.cs:17 - ключ DI "email" не совпадает с регистрацией "e-mail" (Program.cs:216): контроллер не создаётся, все эндпоинты отвечают 500 - blocker
src/Pricing.Api/Program.cs:216 - ключ "e-mail" не совпадает с [FromKeyedServices("email")] в контроллере: InvalidOperationException при активации контроллера, API портала не работает - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:107 - `async void` в Confirm: исключение из notifier роняет процесс, ответ уходит до завершения, клиент не получает ни статуса, ни ошибки; нет 404 для неизвестного заказа - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:48 - в ответ уходит SupplierOrder целиком: поставщик видит PurchasePrice, CostTotal, InternalNote и Tags, что запрещено задачей (то же в GetByNumber:66 и List:94) - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:79 - строки заказа отдаются как SupplierOrderLine с PurchasePrice: цена закупки утекает поставщику, нужен отдельный DTO без цены - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:91 - Status из фильтра не читается: фильтр по статусу молча игнорируется, и пагинации нет - возвращаются все заказы (тысячи в месяц) одним ответом - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:94 - при SupplierId == null возвращаются заказы всех поставщиков: поставщик видит чужие заказы - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:97 - второй список с state и page в path вместо query дублирует List и расходится со схемой соседних контроллеров (ProductsController: query page/pageSize) - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:101 - page <= 0 даёт отрицательный Skip и исключение, размер страницы зашит 50 - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:103 - total = items.Count (размер текущей страницы), а не общее число: клиент считает, что страниц больше нет - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:44 - CostTotal считается через double: потеря точности денежной суммы - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:25 - проверка уникальности номера и запись в store неатомарны, плюс полный перебор всех заказов: при параллельных запросах создаются дубли номера - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:56 - catch (Exception) отдаёт ex.ToString() клиенту: стек и внутренние детали уходят наружу, в обход глобального DomainExceptionHandler - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:68 - try/catch с ex.Message в 500 в чтении (и в GetLines:83): утечка внутренностей и обход глобального обработчика ошибок - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:28 - метки закупщика (произвольные ключи) пишутся в extensions ошибки: ключ вроде "type"/"status" ломает ProblemDetails, содержимое ERP уходит в ответ как есть - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:21 - IActionResult вместо ActionResult<T> и нет ProducesResponseType: схема Swagger пуста, клиенты без типов - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:48 - создание отвечает 200 Ok без Location вместо 201 CreatedAtAction на получение заказа - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:25 - бизнес-логика (уникальность, валидация, расчёт суммы, создание агрегата) в action вместо сервиса, как в ProductService/QuoteService - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:34 - валидация после проверки дубля, BadRequest со строкой вместо ProblemDetails; Lines == null даёт NullReferenceException и 500 - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:9 - Priority в CreateSupplierOrderRequest нигде не читается: клиент шлёт значение, оно теряется - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:15 - нет [Route] на контроллере, полный путь "api/supplier-orders..." повторён на каждом методе (в ProductsController [Route("api/products")]) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:60 - обязательные supplierId и number в query и суффикс /item: ресурс идентифицируется не через path, нужно api/supplier-orders/{supplierId}/{number} - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:74 - глагол "fetch" в пути и orderId в query вне схемы контроллера: нужно api/supplier-orders/{id:guid}/lines - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:110 - Confirm не проверяет текущее состояние: можно подтвердить Cancelled/Rejected заказ, статус портится - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:114 - служебная очистка (DELETE internal/...) лежит в публичном контроллере без авторизации: любой клиент удалит отменённые заказы старше года - major
src/Pricing.Api/Portal/PortalProblems.cs:10 - нет extensions["code"], как в DomainExceptionHandler: клиенты, разбирающие code, не получат его для ошибок портала - minor
src/Pricing.Api/Portal/SupplierOrderStore.cs:6 - заказы только в памяти singleton: все данные теряются при рестарте и не делятся между инстансами - minor
src/Pricing.Domain/SupplierOrder.cs:4 - New/Accepted/Confirmed/Rejected/Cancelled близки по смыслу и без описания в схеме API: клиенты путают статусы - minor
