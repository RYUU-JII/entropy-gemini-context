function pad2(value) {
  return String(value).padStart(2, '0')
}

export function parseLocalDateParts(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ''))
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (Number.isNaN(date.getTime())) return null
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }

  return { year, month, day }
}

export function formatLocalDateParts(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return `${String(Math.floor(year)).padStart(4, '0')}-${pad2(Math.floor(month))}-${pad2(Math.floor(day))}`
}

export function compareDateStr(a, b) {
  const left = String(a ?? '')
  const right = String(b ?? '')
  if (left === right) return 0
  return left < right ? -1 : 1
}

export function shiftDateStr(dateStr, deltaDays) {
  const parts = parseLocalDateParts(dateStr)
  if (!parts) return null

  const date = new Date(parts.year, parts.month - 1, parts.day)
  date.setDate(date.getDate() + (Number.isFinite(Number(deltaDays)) ? Number(deltaDays) : 0))

  return formatLocalDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function listDateStrRange(startDateStr, endDateStr) {
  const start = parseLocalDateParts(startDateStr)
  const end = parseLocalDateParts(endDateStr)
  if (!start || !end) return []

  const normalizedStart = formatLocalDateParts(start.year, start.month, start.day)
  const normalizedEnd = formatLocalDateParts(end.year, end.month, end.day)
  const [rangeStart, rangeEnd] = compareDateStr(normalizedStart, normalizedEnd) <= 0
    ? [normalizedStart, normalizedEnd]
    : [normalizedEnd, normalizedStart]

  const out = []
  let current = rangeStart
  while (current) {
    out.push(current)
    if (current === rangeEnd) break
    current = shiftDateStr(current, 1)
  }

  return out
}
