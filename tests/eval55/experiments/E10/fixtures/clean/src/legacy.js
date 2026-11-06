// TODO: переписать на современный синтаксис
var _cache = {}
function oldFormat(x) {
  if (x == null) { return '' }
  return '' + x
}
export { oldFormat, _cache }
