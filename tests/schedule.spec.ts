import { describe, expect, it } from 'vitest'
import {
  alignSchedulePlanLessons,
  buildSchedulePreviewDates,
  buildScheduleSessions,
  formatScheduleShortDate,
  formatScheduleSessionTime,
  formatScheduleUpcomingTitle,
  getNextWorkdays,
  getScheduleDateKey,
  getScheduleDayDiff,
  matchesScheduleFilter,
  resolveScheduleWeek,
  summarizeScheduleActivitiesByClazz,
  type ScheduleActivity,
} from '../src/schedule'

const semester = { beginOn: '2026-03-02', firstWeekday: 'Mon' as const }

const activity = (overrides: Partial<ScheduleActivity> = {}): ScheduleActivity => ({
  id: 'activity-1',
  clazzId: 'clazz-1',
  courseName: '高等数学',
  dayOfWeek: 2,
  startSection: 1,
  endSection: 2,
  startTime: '08:00',
  endTime: '09:40',
  dates: ['2026-03-03', '2026-03-10'],
  weekNumbers: [1, 2],
  location: 'A101',
  ...overrides,
})

describe('schedule', () => {
  it('按今日、本周、下周与全部筛选课表活动', () => {
    const item = activity()
    const now = new Date(2026, 2, 3)
    expect(matchesScheduleFilter(item, { filter: 'all', semester, now })).toBe(true)
    expect(matchesScheduleFilter(item, { filter: 'today', semester, now })).toBe(true)
    expect(matchesScheduleFilter(item, { filter: 'week', semester, now })).toBe(true)
    expect(matchesScheduleFilter(item, { filter: 'nextWeek', semester, now })).toBe(true)
    expect(matchesScheduleFilter(item, { filter: 'nextWeek', semester, currentWeek: 2, now })).toBe(false)
    expect(resolveScheduleWeek('nextWeek', 3)).toBe(4)
    expect(resolveScheduleWeek('all', 3)).toBeNull()
  })

  it('未来学期预览开学第一周，当前学期预览最近两个工作日', () => {
    const future = buildSchedulePreviewDates({ semester, now: new Date(2026, 1, 1) })
    expect(future.map(getScheduleDateKey)).toEqual([
      '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08',
    ])

    const current = buildSchedulePreviewDates({ semester, now: new Date(2026, 2, 6) })
    expect(current.map(getScheduleDateKey)).toEqual(['2026-03-06', '2026-03-09'])
    expect(getNextWorkdays(new Date(2026, 2, 7)).map(getScheduleDateKey)).toEqual(['2026-03-09', '2026-03-10'])
  })

  it('缺少 weekNumbers 时按上课日期所在教学周筛选', () => {
    const item = activity({ dates: ['2026-03-10'], weekNumbers: [] })
    expect(matchesScheduleFilter(item, {
      filter: 'week', semester, currentWeek: 2, now: new Date(2026, 2, 10),
    })).toBe(true)
    expect(matchesScheduleFilter(item, {
      filter: 'nextWeek', semester, currentWeek: 2, now: new Date(2026, 2, 10),
    })).toBe(false)
  })

  it('展开去重后的上课 Session 并换算教学周', () => {
    const sessions = buildScheduleSessions([
      activity(),
      activity({ id: 'activity-2', dates: ['2026-03-03', '2026-03-17'], weekNumbers: [1, 3] }),
    ], semester)
    expect(sessions).toEqual([
      { date: '2026-03-03', week: 1, sessionTime: '03-03' },
      { date: '2026-03-10', week: 2, sessionTime: '03-10' },
      { date: '2026-03-17', week: 3, sessionTime: '03-17' },
    ])
    expect(formatScheduleSessionTime('2026-03-03')).toBe('03-03')
    expect(formatScheduleShortDate(new Date(2026, 2, 3))).toBe('3月3日')
    expect(formatScheduleUpcomingTitle(new Date(2026, 2, 3), new Date(2026, 2, 2))).toBe('明天')
    expect(getScheduleDayDiff(new Date(2026, 2, 2), new Date(2026, 2, 9))).toBe(7)
  })

  it('授课计划按 lesson.idx 对齐 Session，缺失时回退到次序', () => {
    const sessions = buildScheduleSessions([activity()], semester)
    const lessons = [{ id: 'lesson-2', idx: 2 }, { id: 'lesson-1', idx: 1 }, { id: 'lesson-3', idx: 3 }]
    expect(alignSchedulePlanLessons(lessons, sessions)).toEqual([
      { id: 'lesson-1', idx: 1, week: 1, sessionTime: '03-03' },
      { id: 'lesson-2', idx: 2, week: 2, sessionTime: '03-10' },
      { id: 'lesson-3', idx: 3, week: undefined, sessionTime: '' },
    ])
  })

  it('按教学班汇总课表活动', () => {
    const summaries = summarizeScheduleActivitiesByClazz([
      activity({ activityIds: ['a1', 'a2'], weekNumbers: [1], dates: ['2026-03-03'], location: 'A101' }),
      activity({ id: 'activity-2', activityIds: ['a3'], weekNumbers: [2], dates: ['2026-03-10'], location: 'B201' }),
      activity({ id: 'activity-3', clazzId: 'clazz-2', weekNumbers: [3], dates: ['2026-03-17'], location: '' }),
    ])
    expect(summaries.get('clazz-1')).toMatchObject({
      arranged: true,
      activityCount: 3,
      firstCourseDate: '2026-03-03',
      weeks: '1-2周',
      classrooms: 'A101、B201',
    })
    expect(summaries.get('clazz-2')).toMatchObject({
      activityCount: 1,
      weeks: '3周',
      classrooms: '',
    })
  })
})
