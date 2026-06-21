function formatToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function defaultDateRange() {
  const today = formatToday()
  return [today, today]
}

/** 默认最近 N 天（含今天），便于考勤页看到历史停留记录 */
export function defaultDateRangeLastDays(days = 30) {
  const end = formatToday()
  const d = new Date()
  d.setDate(d.getDate() - Math.max(0, days - 1))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return [`${y}-${m}-${day}`, end]
}

export function resolveDateRange(dateRange) {
  if (Array.isArray(dateRange) && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
    return dateRange[0] <= dateRange[1] ? [dateRange[0], dateRange[1]] : [dateRange[1], dateRange[0]]
  }
  const today = formatToday()
  return [today, today]
}

export function dateRangeParams(dateRange) {
  const [beginDate, endDate] = resolveDateRange(dateRange)
  return { beginDate, endDate }
}

export function defaultQueryDate() {
  return formatToday()
}

export function defaultTimeRange() {
  return ['00:00', '23:59']
}

function parseTimeToMinutes(token, fallbackMinutes) {
  if (token instanceof Date) {
    return token.getHours() * 60 + token.getMinutes()
  }
  if (token == null || token === '') return fallbackMinutes
  const parts = String(token).trim().split(':')
  const hour = Number.parseInt(parts[0], 10)
  const minute = Number.parseInt(parts[1] ?? '0', 10)
  if (Number.isNaN(hour)) return fallbackMinutes
  const h = Math.max(0, Math.min(23, hour))
  const m = Number.isNaN(minute) ? 0 : Math.max(0, Math.min(59, minute))
  return h * 60 + m
}

function formatMinutesToTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 单日 + 分钟段查询参数（beginDate 与 endDate 相同，不可跨天） */
export function singleDayTimeParams(queryDate, timeRange) {
  const date = queryDate || formatToday()
  const range = Array.isArray(timeRange) && timeRange.length === 2 ? timeRange : defaultTimeRange()
  let beginMinutes = parseTimeToMinutes(range[0], 0)
  let endMinutes = parseTimeToMinutes(range[1], 23 * 60 + 59)
  if (beginMinutes > endMinutes) {
    const tmp = beginMinutes
    beginMinutes = endMinutes
    endMinutes = tmp
  }
  return {
    beginDate: date,
    endDate: date,
    beginTime: formatMinutesToTime(beginMinutes),
    endTime: formatMinutesToTime(endMinutes)
  }
}

/** @deprecated 使用 singleDayTimeParams */
export function singleDayHourParams(queryDate, hourRange) {
  return singleDayTimeParams(queryDate, hourRange)
}

/** @deprecated 使用 defaultTimeRange */
export function defaultHourRange() {
  return defaultTimeRange()
}

export function isFutureDate(dateStr) {
  if (!dateStr) return false
  return dateStr > formatToday()
}
