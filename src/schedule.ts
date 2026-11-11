import {
  addTeachingDays,
  formatTeachingWeeks,
  getTeachingWeekNumber,
  normalizeTeachingWeeks,
  parseTeachingDate,
  teachingDateKey,
  type TeachingSemesterRange,
  type TeachingWeekday,
} from './utils/teachingWeek'

export * from './utils/teachingWeek'

export type ScheduleDay = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ScheduleFilter = 'all' | 'today' | 'week' | 'nextWeek'

export interface ScheduleActivity {
  id: string
  activityIds?: string[]
  clazzId?: string
  courseId?: string
  courseName: string
  crn?: string
  courseCode?: string
  courseType?: string
  campus?: string
  teacher?: string
  location?: string
  dayOfWeek: number
  startSection: number
  endSection: number
  startTime: string
  endTime: string
  dates?: string[]
  weekNumbers?: number[]
  weeks?: string
}

export interface ScheduleFilterContext {
  filter: ScheduleFilter
  semester?: TeachingSemesterRange | null
  currentWeek?: number
  now?: Date
}

export interface ScheduleSession {
  date: string
  week?: number
  sessionTime: string
}

export interface ScheduleClazzSummary<T extends ScheduleActivity = ScheduleActivity> {
  clazzId: string
  activities: T[]
  arranged: boolean
  activityCount: number
  firstCourseDate: string
  weeks: string
  weekNumbers: number[]
  classrooms: string
  dates: string[]
}

export interface SchedulePreviewOptions {
  semester?: TeachingSemesterRange | null
  now?: Date
  workdayCount?: number
}

export interface ScheduleDayTitleOptions {
  isFuture?: boolean
  now?: Date
}

export const SCHEDULE_WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export const SCHEDULE_DAYS: ReadonlyArray<{ value: ScheduleDay; label: string }> = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

const weekdayIndexes: Record<TeachingWeekday, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const getDayDiff = (from: Date, to: Date): number =>
  Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000)

const uniqueTexts = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
]

const uniqueDates = (values: string[]): string[] => [...new Set(values.filter(Boolean))].sort()

const getActivityWeekNumbers = (
  activity: ScheduleActivity,
  semester?: TeachingSemesterRange | null,
): number[] => {
  if (activity.weekNumbers?.length) return normalizeTeachingWeeks(activity.weekNumbers)
  if (!semester || !activity.dates?.length) return []
  return normalizeTeachingWeeks(
    activity.dates.map((date) => getTeachingWeekNumber(parseTeachingDate(date), semester)),
  )
}

export function getScheduleDateKey(date: Date): string {
  return teachingDateKey(date)
}

export function getScheduleDayOfWeek(date: Date): ScheduleDay {
  return (date.getDay() || 7) as ScheduleDay
}

export function getScheduleWeekStart(date: Date, firstWeekday: TeachingWeekday = 'Mon'): Date {
  const targetDay = weekdayIndexes[firstWeekday] ?? 1
  const diff = (date.getDay() - targetDay + 7) % 7
  return addTeachingDays(startOfDay(date), -diff)
}

export function getScheduleDayDiff(from: Date, to: Date): number {
  return getDayDiff(from, to)
}

export function isScheduleWorkday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

export function isScheduleWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function getNextWorkdays(now: Date = new Date(), count = 2): Date[] {
  const days: Date[] = []
  let cursor = startOfDay(now)
  while (days.length < count) {
    if (isScheduleWorkday(cursor)) days.push(new Date(cursor))
    cursor = addTeachingDays(cursor, 1)
  }
  return days
}

export function getSemesterFirstWeekDates(semester: TeachingSemesterRange): Date[] {
  if (!semester.beginOn) return []
  const begin = parseTeachingDate(semester.beginOn)
  if (Number.isNaN(begin.getTime())) return []
  const firstWeekday = semester.firstWeekday || semester.calendar?.firstWeekday || 'Mon'
  const weekStart = getScheduleWeekStart(begin, firstWeekday)
  const weekEnd = addTeachingDays(weekStart, 6)
  const totalDays = getDayDiff(begin, weekEnd) + 1
  return Array.from({ length: Math.max(totalDays, 0) }, (_, index) => addTeachingDays(begin, index))
}

export function isFutureSemester(semester: TeachingSemesterRange | null | undefined, now: Date = new Date()): boolean {
  if (!semester?.beginOn) return false
  const begin = parseTeachingDate(semester.beginOn)
  return !Number.isNaN(begin.getTime()) && startOfDay(begin) > startOfDay(now)
}

export function buildSchedulePreviewDates(options: SchedulePreviewOptions = {}): Date[] {
  const { semester, now = new Date(), workdayCount = 2 } = options
  if (semester && isFutureSemester(semester, now)) return getSemesterFirstWeekDates(semester)
  return getNextWorkdays(now, workdayCount)
}

export function formatScheduleDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${SCHEDULE_WEEKDAY_NAMES[date.getDay()]}`
}

export function formatScheduleShortDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatScheduleUpcomingTitle(date: Date, now: Date = new Date()): string {
  const today = startOfDay(now)
  if (teachingDateKey(date) === teachingDateKey(today)) return '今天'
  if (teachingDateKey(date) === teachingDateKey(addTeachingDays(today, 1))) return '明天'
  return SCHEDULE_WEEKDAY_NAMES[date.getDay()]
}

export function formatScheduleDayTitle(
  date: Date,
  index: number,
  options: ScheduleDayTitleOptions = {},
): string {
  const { isFuture = false, now = new Date() } = options
  if (isFuture) return SCHEDULE_WEEKDAY_NAMES[date.getDay()]
  const today = startOfDay(now)
  if (teachingDateKey(date) === teachingDateKey(today)) return '今天'
  return index === 1 && today.getDay() === 5 ? '下周一' : SCHEDULE_WEEKDAY_NAMES[date.getDay()]
}

export function formatScheduleSessionTime(value: string): string {
  return value.length >= 10 ? value.slice(5) : value
}

export function getScheduleFilterLabel(filter: ScheduleFilter): string {
  if (filter === 'today') return '今日'
  if (filter === 'week') return '本周'
  if (filter === 'nextWeek') return '下周'
  return '全部'
}

export function resolveScheduleWeek(filter: ScheduleFilter, currentWeek: number): number | null {
  if (filter === 'all') return null
  if (currentWeek <= 0) return 0
  return filter === 'nextWeek' ? currentWeek + 1 : currentWeek
}

export function isScheduleActivityActiveOnDate(
  activity: ScheduleActivity,
  date: Date,
  semester?: TeachingSemesterRange | null,
): boolean {
  const dateKey = teachingDateKey(date)
  if (activity.dates?.length) return activity.dates.includes(dateKey)
  if (!semester || !activity.weekNumbers?.length) return true
  return activity.weekNumbers.includes(getTeachingWeekNumber(date, semester))
}

export function matchesScheduleFilter(
  activity: ScheduleActivity,
  context: ScheduleFilterContext,
): boolean {
  const { filter, semester, now = new Date() } = context
  if (filter === 'all') return true
  const currentWeek = context.currentWeek ?? (semester ? getTeachingWeekNumber(now, semester) : 0)
  if (filter === 'today') {
    if (activity.dates?.includes(teachingDateKey(now))) return true
    return (
      currentWeek > 0 &&
      getActivityWeekNumbers(activity, semester).includes(currentWeek) &&
      activity.dayOfWeek === getScheduleDayOfWeek(now)
    )
  }
  const week = resolveScheduleWeek(filter, currentWeek)
  if (week !== null && week > 0 && getActivityWeekNumbers(activity, semester).includes(week)) {
    return true
  }
  if (!activity.dates?.length) return false

  const firstWeekday = semester?.firstWeekday || semester?.calendar?.firstWeekday || 'Mon'
  let weekStart: Date
  if (semester && week !== null && week > 0) {
    const semesterStart = getScheduleWeekStart(parseTeachingDate(semester.beginOn), firstWeekday)
    weekStart = addTeachingDays(semesterStart, (week - 1) * 7)
  } else if (!semester) {
    const base = filter === 'nextWeek' ? addTeachingDays(now, 7) : now
    weekStart = getScheduleWeekStart(base, firstWeekday)
  } else {
    return false
  }
  const startKey = teachingDateKey(weekStart)
  const endKey = teachingDateKey(addTeachingDays(weekStart, 6))
  return activity.dates.some((date) => date >= startKey && date <= endKey)
}

export function buildScheduleSessions(
  activities: ScheduleActivity[],
  semester?: TeachingSemesterRange | null,
): ScheduleSession[] {
  const dates = uniqueDates(activities.flatMap((activity) => activity.dates || []))
  return dates.map((date) => ({
    date,
    week: semester ? getTeachingWeekNumber(parseTeachingDate(date), semester) : undefined,
    sessionTime: formatScheduleSessionTime(date),
  }))
}

export function alignSchedulePlanLessons<T extends { idx: number }>(
  lessons: T[],
  sessions: ScheduleSession[],
): Array<T & { week?: number; sessionTime: string }> {
  return [...lessons]
    .sort((left, right) => left.idx - right.idx)
    .map((lesson, index) => {
      const session = sessions.find((_, sessionIndex) => sessionIndex + 1 === lesson.idx) || sessions[index]
      return {
        ...lesson,
        week: session?.week,
        sessionTime: session?.sessionTime || '',
      }
    })
}

export function summarizeScheduleActivitiesByClazz<T extends ScheduleActivity>(
  activities: T[],
): Map<string, ScheduleClazzSummary<T>> {
  const groups = new Map<string, T[]>()
  activities.forEach((activity) => {
    const clazzId = activity.clazzId || activity.id
    const list = groups.get(clazzId) || []
    list.push(activity)
    groups.set(clazzId, list)
  })

  const summaries = new Map<string, ScheduleClazzSummary<T>>()
  groups.forEach((items, clazzId) => {
    const weekNumbers = normalizeTeachingWeeks(items.flatMap((activity) => activity.weekNumbers || []))
    const dates = uniqueDates(items.flatMap((activity) => activity.dates || []))
    summaries.set(clazzId, {
      clazzId,
      activities: items,
      arranged: items.length > 0,
      activityCount: items.reduce((total, activity) => total + Math.max(activity.activityIds?.length || 1, 1), 0),
      firstCourseDate: dates[0] || '',
      weeks: formatTeachingWeeks(weekNumbers),
      weekNumbers,
      classrooms: uniqueTexts(items.map((activity) => activity.location || '')).join('、'),
      dates,
    })
  })
  return summaries
}
