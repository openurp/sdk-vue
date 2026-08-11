import { describe, expect, it } from 'vitest'
import {
  formatSemester,
  formatSemesterName,
  formatSemesterRange,
  parseSemesterDate,
  resolveCurrentSemester,
  resolveDefaultSemester,
  resolveNearestSemester,
} from '../src/utils/semester'

const semesters = [
  { id: '20233', schoolYear: '2024-2025', name: '1', beginOn: '2024-09-09', endOn: '2025-01-12' },
  { id: '2024', schoolYear: '2024-2025', name: '2', beginOn: '2025-03-03', endOn: '2025-07-06' },
  { id: '1640420209', schoolYear: '2026-2027', name: '1', beginOn: '2026-09-07', endOn: '2027-01-17' },
] as const

describe('semester utils', () => {
  it('formatSemester / formatSemesterName / formatSemesterRange', () => {
    expect(formatSemesterName({ name: '1' })).toBe('第1学期')
    expect(formatSemesterName({ name: '第一学期' })).toBe('第一学期')
    expect(formatSemester(semesters[0])).toBe('2024-2025学年 第1学期')
    expect(formatSemesterRange(semesters[0])).toBe('09-09 ~ 01-12')
  })

  it('resolveCurrentSemester 命中包含今天的学期', () => {
    const current = resolveCurrentSemester([...semesters], new Date('2026-10-01'))
    expect(current?.id).toBe('1640420209')
    expect(resolveCurrentSemester([...semesters], new Date('2024-10-01'))?.id).toBe('20233')
    expect(resolveCurrentSemester([...semesters], new Date('2025-10-01'))).toBeUndefined()
  })

  it('resolveDefaultSemester 优先已选学期，其次当前/最近', () => {
    expect(resolveDefaultSemester([...semesters], '2024', new Date('2026-10-01'))?.id).toBe('2024')
    expect(resolveDefaultSemester([...semesters], null, new Date('2026-10-01'))?.id).toBe('1640420209')
    expect(resolveDefaultSemester([...semesters], null, new Date('2025-10-01'))?.id).toBe('1640420209')
  })

  it('resolveNearestSemester 取距离最近的学期', () => {
    expect(resolveNearestSemester([...semesters], new Date('2025-05-01'))?.id).toBe('2024')
  })

  it('parseSemesterDate 支持 endOfDay', () => {
    expect(parseSemesterDate('2026-01-05')?.getDate()).toBe(5)
    expect(parseSemesterDate('2026-01-05', true)?.getHours()).toBe(23)
    expect(parseSemesterDate('invalid')).toBeNull()
  })
})
