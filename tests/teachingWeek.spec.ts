import { describe, expect, it } from 'vitest'
import {
  addTeachingDays,
  expandTeachingDates,
  formatTeachingWeeks,
  getTeachingWeekNumber,
  normalizeTeachingWeeks,
  parseTeachingDate,
  teachingDateKey,
} from '../src/utils/teachingWeek'
import { teachingWeekFixtures, teachingWeekSemester } from './fixtures/teachingWeek'

/** 星期几数字 → 中文（校验 fixture 的 weekday 与 startOn 是否一致） */
const weekdayName = (date: Date) => ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]

describe('teachingWeek', () => {
  it('expandTeachingDates 按 beangle 位序展开：反转后第 i 位=week i，日期=startOn+(i-1)*7', () => {
    // '110' 反转 = '011'：第 1、2 位为 1 → week 1、2 → startOn、startOn+7
    const dates = expandTeachingDates('2026-01-05', '110')
    expect(dates.map(teachingDateKey).sort()).toEqual(['2026-01-05', '2026-01-12'])
    // '101' 反转 = '101'：第 0、2 位为 1 → week 0（startOn-7）、week 2（startOn+7）
    const odd = expandTeachingDates('2026-01-05', '101')
    expect(odd.map(teachingDateKey).sort()).toEqual(['2025-12-29', '2026-01-12'])
    // '0011' 反转 = '1100'：第 0、1 位为 1 → week 0、1 → startOn-7、startOn
    const short = expandTeachingDates('2026-01-05', '0011')
    expect(short.map(teachingDateKey).sort()).toEqual(['2025-12-29', '2026-01-05'])
    // 真实形态（前段 1 后段 0）：'111000…' 反转后 1 落在高位（week 22..24）→ startOn+21..23 周
    const padded = expandTeachingDates('2026-01-05', '1110000000000000000000000')
    expect(padded.map(teachingDateKey).sort()).toEqual(['2026-06-01', '2026-06-08', '2026-06-15'])
  })

  it('weekstate 为空或 startOn 为空时返回空数组', () => {
    expect(expandTeachingDates('', '110')).toEqual([])
    expect(expandTeachingDates('2026-01-05', '')).toEqual([])
  })

  it('weekstate 支持 beangle 十进制数形态（2088960 = 二进制 111111110000000000000）', () => {
    // 反转后 1 在 13..20 位 → week 13..20 → startOn+12..19 周
    const dates = expandTeachingDates('2026-01-06', 2088960)
    expect(dates.map(teachingDateKey)).toEqual([
      '2026-03-31', '2026-04-07', '2026-04-14', '2026-04-21',
      '2026-04-28', '2026-05-05', '2026-05-12', '2026-05-19',
    ])
    // 十进制字符串形态同样兼容
    const strDates = expandTeachingDates('2026-01-06', '2088960')
    expect(strDates.map(teachingDateKey)).toEqual(dates.map(teachingDateKey))
  })

  it('真实案例：2025-2026-2 学期 beginOn=2026-03-02、startOn=2026-01-06、weekstate=2088960 算出教学周 5-12', () => {
    const semester = { beginOn: '2026-03-02', firstWeekday: 'Mon' as const }
    const dates = expandTeachingDates('2026-01-06', 2088960)
    expect(dates.length).toBe(8)
    const weeks = normalizeTeachingWeeks(dates.map((d) => getTeachingWeekNumber(d, semester)))
    expect(weeks).toEqual([5, 6, 7, 8, 9, 10, 11, 12])
    expect(formatTeachingWeeks(weeks)).toBe('5-12周')
  })

  it('真实案例：15 个 1 的课程（8453 高数）算出教学周 1-15', () => {
    const semester = { beginOn: '2026-03-02', firstWeekday: 'Mon' as const }
    const dates = expandTeachingDates('2026-01-05', '111111111111111000000000')
    expect(dates.length).toBe(15)
    const weeks = normalizeTeachingWeeks(dates.map((d) => getTeachingWeekNumber(d, semester)))
    expect(weeks[0]).toBe(1)
    expect(weeks[weeks.length - 1]).toBe(15)
    expect(formatTeachingWeeks(weeks)).toBe('1-15周')
  })

  it('weekstate 数字含非法值或为 0 时返回空数组', () => {
    expect(expandTeachingDates('2026-03-02', 0)).toEqual([])
    expect(expandTeachingDates('2026-03-02', 'abc')).toEqual([])
    expect(expandTeachingDates('2026-03-02', -1)).toEqual([])
  })

  it('getTeachingWeekNumber 以学期开始日所在周为第 1 周', () => {
    const week = getTeachingWeekNumber(parseTeachingDate('2026-01-05'), {
      beginOn: '2026-01-05',
      firstWeekday: 'Mon',
    })
    expect(week).toBe(1)
    expect(getTeachingWeekNumber(parseTeachingDate('2026-01-19'), { beginOn: '2026-01-05', firstWeekday: 'Mon' })).toBe(3)
  })

  it('getTeachingWeekNumber 以 firstWeekday 展开日历：beginOn 所在自然周为第 1 周', () => {
    // 2026-03-04 是周三开学，firstWeekday=Mon：自然周 3/2(一)~3/8(日) 为第 1 周
    const semester = { beginOn: '2026-03-04', firstWeekday: 'Mon' as const }
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-02'), semester)).toBe(1) // 同周内早于 beginOn 的周一
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-03'), semester)).toBe(1) // 周二
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-04'), semester)).toBe(1) // 开学日=第1周
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-08'), semester)).toBe(1) // 第一周周日
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-09'), semester)).toBe(2) // 下周一=第2周
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-15'), semester)).toBe(2)
  })

  it('getTeachingWeekNumber 以 firstWeekday 展开日历：firstWeekday=Sun 时周日为周边界', () => {
    // 2026-03-06 是周五开学，firstWeekday=Sun：自然周 3/1(日)~3/7(六) 为第 1 周
    const semester = { beginOn: '2026-03-06', firstWeekday: 'Sun' as const }
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-01'), semester)).toBe(1) // 同周内早于 beginOn 的周日
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-05'), semester)).toBe(1) // 周四
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-06'), semester)).toBe(1)
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-07'), semester)).toBe(1)
    expect(getTeachingWeekNumber(parseTeachingDate('2026-03-08'), semester)).toBe(2) // 下周日=第2周
  })

  it('normalizeTeachingWeeks 去重排序并过滤非正数', () => {
    expect(normalizeTeachingWeeks([3, 1, 1, 0, -2, 2])).toEqual([1, 2, 3])
  })

  it('formatTeachingWeeks 连续周折叠，间隔 2 周识别单/双周', () => {
    expect(formatTeachingWeeks([1, 2, 3, 4])).toBe('1-4周')
    expect(formatTeachingWeeks([1, 3, 5])).toBe('1-5单周')
    expect(formatTeachingWeeks([2, 4, 6])).toBe('2-6双周')
    expect(formatTeachingWeeks([1, 3, 6])).toBe('1,3,6周')
    expect(formatTeachingWeeks([])).toBe('')
  })

  it('addTeachingDays 与 teachingDateKey', () => {
    expect(teachingDateKey(addTeachingDays(parseTeachingDate('2026-01-05'), 7))).toBe('2026-01-12')
  })

  describe('真实数据核对（2025-2026-2 学期 course-takers fixtures）', () => {
    it('fixture 数量与样例存在', () => {
      expect(teachingWeekFixtures.length).toBeGreaterThanOrEqual(15)
      expect(teachingWeekSemester.beginOn).toBe('2026-03-02')
      expect(teachingWeekSemester.firstWeekday).toBe('Mon')
    })

    it.each(teachingWeekFixtures)(
      '$crn $course $weekday$units（weekstate=$weekstate）→ $weeks',
      ({ startOn, weekday, weekstate, weeks }) => {
        // 1) startOn 的星期几与 fixture 声明一致（防 fixture 抄错）
        expect(weekdayName(parseTeachingDate(startOn))).toBe(weekday)
        // 2) weekstate 展开的教学周次与期望一致（核心核对）
        const dates = expandTeachingDates(startOn, weekstate)
        const weekNumbers = normalizeTeachingWeeks(
          dates.map((d) => getTeachingWeekNumber(d, teachingWeekSemester)),
        )
        expect(formatTeachingWeeks(weekNumbers)).toBe(weeks)
      },
    )
  })
})
