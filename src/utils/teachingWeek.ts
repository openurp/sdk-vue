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
 * 按 weekstate 展开上课日期。
 *
 * weekstate 是 beangle 的二进制位图（存储为 long，如 2088960 = 0b111111110000000000000），
 * 下发形态为 0/1 字符串。**位序约定（与 beangle `WeekState.weeks()` 一致）**：
 * 字符串最右字符 = week 0，最左字符 = week (len-1)；week 从 0 开始计数。
 * 第 i 个上课日期 = `startOn.plusWeeks(week - 1)`，即：
 * - week 0 → startOn 前一周（startOn - 7 天）
 * - week 1 → startOn
 * - week k → startOn + (k-1)*7 天
 *
 * 实现上：先反转字符串（最右变最左），反转后第 i 位为 '1' 表示 week=i，
 * 日期 = startOn + (i-1)*7 天。
 *
 * 兼容两种下发形态：
 * - 0/1 字符串（真实 API 形态，如 '111111110000000000000'）
 * - 十进制数（beangle long 存储值，如 2088960，会先转回二进制字符串）
 *
 * 教学周次不在此函数计算：用返回值配合 `getTeachingWeekNumber(date, semester)`
 * 相对 `semester.beginOn`（含 `semester.calendar.firstWeekday`）换算。
 */
export function expandTeachingDates(startOn: string, weekstate: string | number): Date[] {
  if (!startOn || weekstate === '' || weekstate == null) return []
  const bits = normalizeWeekstate(weekstate)
  if (!bits) return []
  const startDate = parseTeachingDate(startOn)
  // 反转：反转后第 i 位 = week i；日期 = startOn + (i-1)*7
  return bits
    .split('')
    .reverse()
    .flatMap((flag, index) => {
      return flag === '1' ? [addTeachingDays(startDate, (index - 1) * 7)] : []
    })
}

/**
 * 归一化 weekstate 为 0/1 字符串；无法识别时返回 ''（不展开任何日期）。
 * 兼容两种形态：0/1 字符串（真实 API）与十进制数（beangle long 存储值，先转回二进制）。
 * 位序约定详见 `docs/teaching-week.md`（反转后第 0 位 = 相对 startOn 的第 0 周）。
 */
export function normalizeWeekstate(weekstate: string | number): string {
  const value = typeof weekstate === 'number' ? String(weekstate) : weekstate
  if (/^[01]+$/.test(value)) return value
  const num = Number(value)
  if (Number.isSafeInteger(num) && num > 0) return num.toString(2)
  return ''
}

/**
 * 计算 date 对应的教学周次。
 *
 * 以 `semester.firstWeekday`（Mon=周一开始，Sun=周日开始）为边界把时间轴展开为
 * 连续的自然周，**`semester.beginOn` 所在的那个自然周即第 1 周**（教学周不要求
 * 满 7 天：如 firstWeekday=Mon 但 beginOn 是周三，该周仍是第 1 周，其内早于
 * beginOn 的周一、周二也属于第 1 周，只是此类上课日期很少见）。
 */
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

/**
 * 解析周次文本为教学周列表（`formatTeachingWeeks` 的逆运算）。
 *
 * 兼容常见中文写法：`1-9周`、`1-12,14-15周`、`1,3,5周`、`1-5单周`、`2-6双周`、
 * `第1-16周(单)`（单/双周标记可写在整段或单个区间上，也接受「单/双」简写）；
 * 分隔符支持 `,`、`，`、`、`、`;`、`；`。
 *
 * 无法识别（如「周次待定」、空串）时返回空数组，调用方据此区分「未提供周次」。
 */
export function parseTeachingWeeks(text?: string | null): number[] {
  const raw = (text || '').trim()
  if (!raw) return []
  const weeks = new Set<number>()
  raw.split(/[,，、;；]/).forEach((piece) => {
    const odd = piece.includes('单')
    const even = piece.includes('双')
    const tokens = piece.match(/\d+\s*[-~至]\s*\d+|\d+/g) || []
    tokens.forEach((token) => {
      const [from, to] = token.split(/\s*[-~至]\s*/).map(Number)
      const end = Number.isFinite(to) ? to : from
      for (let week = from; week <= end; week++) {
        if (odd && week % 2 === 0) continue
        if (even && week % 2 === 1) continue
        weeks.add(week)
      }
    })
  })
  return normalizeTeachingWeeks([...weeks])
}
