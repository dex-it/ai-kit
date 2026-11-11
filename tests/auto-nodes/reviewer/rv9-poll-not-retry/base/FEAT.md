# FEAT-9. Ожидание выгрузки отчёта

R1. waitForExport(api, jobId) опрашивает api.exportStatus(jobId) -> { state: 'pending' | 'done' | 'failed', url? } каждые 500 мс, пока state не 'done' либо 'failed'; первый опрос - сразу.
R2. state 'done' - вернуть url; state 'failed' - бросить ошибку «выгрузка не удалась»; после 20 опросов в 'pending' - бросить ошибку «выгрузка не готова за 10 с».
R3. Ошибка самого вызова api.exportStatus не повторяется и пробрасывается как есть.
