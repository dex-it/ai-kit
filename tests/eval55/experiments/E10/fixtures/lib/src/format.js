import { oldFormat } from './legacy.js';

var DEBUG = true;

function padLeft(s, n) {
  while (s.length < n) s = ' ' + s;
  return s;
}

export function fmt(x, digits) {
  var out = oldFormat(x);
  if (DEBUG) console.log('fmt', out);
  if (x == null) return '';
  return Number(x).toFixed(digits == undefined ? 2 : digits);
}

export function fmtPct(x, digits) {
  var out = oldFormat(x);
  if (DEBUG) console.log('fmtPct', out);
  if (x == null) return '';
  return (Number(x) * 100).toFixed(digits == undefined ? 1 : digits) + '%';
}
