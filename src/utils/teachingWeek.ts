export type TeachingWeekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export interface TeachingSemesterRange {
  beginOn: string
  firstWeekday?: TeachingWeekday
  calendar?: { firstWeekday?: TeachingWeekday }
}

const weekdayIndexes: Record<TeachingWeekday, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

export function parseTeachingDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addTeachingDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function teachingDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 按 weekstate 展开上课日期。约定：weekstate 为 0/1 字符串，**最左字符对应第 1 周**，
 * 第 i 位（0 起）为 '1' 表示第 i+1 周上课（与 EMS 下发的 reversed/padded 格式一致，
 * 如 '111000…' = 第 1-3 周）。
 */
export function expandTeachingDates(startOn: string, weekstate: string): Date[] {
  if (!startOn || !weekstate) return []
  const startDate = parseTeachingDate(startOn)
  return weekstate.split('').flatMap((flag, index) => {
    return flag === '1' ? [addTeachingDays(startDate, index * 7)] : []
  })
}

export function getTeachingWeekNumber(date: Date, semester: TeachingSemesterRange): number {
  const firstWeekday = semester.firstWeekday || semester.calendar?.firstWeekday || 'Mon'
  const targetDay = weekdayIndexes[firstWeekday]
  const begin = parseTeachingDate(semester.beginOn)
  const weekStart = addTeachingDays(begin, -((begin.getDay() - targetDay + 7) % 7))
  const from = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((to.getTime() - from.getTime()) / 86400000 / 7) + 1
}

export function normalizeTeachingWeeks(values: number[]): number[] {
  return [...new Set(values)].filter((value) => value > 0).sort((a, b) => a - b)
}

export function formatTeachingWeeks(values: number[]): string {
  const sorted = normalizeTeachingWeeks(values)
  if (sorted.length === 0) return ''
  if (sorted.length >= 2 && sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 2)) {
    return `${sorted[0]}-${sorted[sorted.length - 1]}${sorted[0] % 2 === 1 ? '单周' : '双周'}`
  }
  const ranges: string[] = []
  let start = sorted[0]
  let previous = sorted[0]
  sorted.slice(1).forEach((value) => {
    if (value === previous + 1) { previous = value; return }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
    start = value
    previous = value
  })
  ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
  return `${ranges.join(',')}周`
}
