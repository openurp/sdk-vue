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

describe('teachingWeek', () => {
  it('expandTeachingDates 按 weekstate 从右往左展开周次日期', () => {
    // '110'：左起第 1、2 位为 1 → 展开为第 2、1 周
    const dates = expandTeachingDates('2026-01-05', '110')
    expect(dates.map(teachingDateKey).sort()).toEqual(['2026-01-05', '2026-01-12'])
  })

  it('weekstate 为空或 startOn 为空时返回空数组', () => {
    expect(expandTeachingDates('', '110')).toEqual([])
    expect(expandTeachingDates('2026-01-05', '')).toEqual([])
  })

  it('getTeachingWeekNumber 以学期开始日所在周为第 1 周', () => {
    const week = getTeachingWeekNumber(parseTeachingDate('2026-01-05'), {
      beginOn: '2026-01-05',
      firstWeekday: 'Mon',
    })
    expect(week).toBe(1)
    expect(getTeachingWeekNumber(parseTeachingDate('2026-01-19'), { beginOn: '2026-01-05', firstWeekday: 'Mon' })).toBe(3)
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
})
