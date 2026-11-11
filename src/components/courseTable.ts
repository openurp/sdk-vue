/** CourseTable 组件的数据模型与配置类型。 */

import { normalizeTeachingWeeks, parseTeachingWeeks } from '../utils/teachingWeek'

/** 课程安排的一项（可由业务数据映射而来）。 */
export interface CourseTableCourse {
  id: string | number
  name: string
  crn?: string
  courseId?: string | number
  teacher?: string
  /** 星期几：1=周一 … 7=周日 */
  dayOfWeek: number
  startSection: number
  endSection: number
  /**
   * 上课教学周次（如 [1,2,…,9]）。用于同一格子里多门课程的冲突判定；
   * 缺省时回退到用 `arrangements[].weeks` 文本解析。
   */
  weekNumbers?: number[]
  arrangements?: Array<{
    weeks?: string
    location?: string
    startTime?: string
    endTime?: string
  }>
  [key: string]: unknown
}

export interface CourseTableDay {
  value: number
  label: string
}

/** 用于分组合并的课程安排源数据（业务课表条目）——只需提供分组与展示所需的字段。 */
export interface CourseTableScheduleSource {
  /** 课程标识，优先取 crn；无 crn 时可用课程代码或课程名 */
  crn?: string
  courseCode?: string
  courseName: string
  /** 星期几：1=周一 … 7=周日 */
  dayOfWeek: number
  /** 开始节次（1 起） */
  startSection: number
  /** 结束节次（1 起）；缺省按只占一节（= startSection）处理 */
  endSection?: number
  teacher?: string
  location?: string
  weeks?: string
  weekNumbers?: number[]
  startTime?: string
  endTime?: string
  [key: string]: unknown
}

/**
 * 将业务课表条目转换为 CourseTable 的课程块，并做**同块合并**：
 * - 分组键 = 课程标识（crn/courseCode/courseName）+ 星期 + 开始节次，
 *   即同一门课在**同一天同一时段**的多条安排（如不同周次换教室）合并为一个块；
 *   不同星期/节次各自独立成块。
 * - 合并时 teacher 去重、arrangements 按周次/时间/地点排序后合并
 *   （每项含 weeks/location/startTime/endTime）。
 * - 返回对象展开首条源数据的全部字段，业务侧可继续携带自有字段（如详情跳转参数）。
 *
 * 注意：返回类型同时满足 CourseTable 消费与源字段透传，业务侧如需
 * CourseTableCourse 可自行断言。
 *
 * @param schedules 业务课表条目列表
 * @param keyOf 可选的自定义课程标识提取；缺省取 crn || courseCode || courseName
 */
export function buildCourseTableCourses<T extends CourseTableScheduleSource>(
  schedules: T[],
  keyOf?: (course: T) => string,
): Array<
  Omit<CourseTableCourse, 'id' | 'endSection' | 'name' | 'teacher' | 'arrangements'> &
    T & {
      name: string
      teacher: string
      arrangements: NonNullable<CourseTableCourse['arrangements']>
    }
> {
  const groups = new Map<string, T[]>()
  schedules.forEach((course) => {
    const courseKey = keyOf
      ? keyOf(course)
      : course.crn || course.courseCode || course.courseName
    const key = `${courseKey}|${course.dayOfWeek}|${course.startSection}`
    const items = groups.get(key) || []
    items.push(course)
    groups.set(key, items)
  })
  return [...groups.values()].map((items) => {
    const first = items[0]
    return {
      ...first,
      name: first.courseName,
      endSection: first.endSection ?? first.startSection,
      teacher: [...new Set(items.map((i) => i.teacher).filter(Boolean))].join("、"),
      // 同块多条安排的周次取并集（如 1-12,14-15 周 + 13 周 → 1-15 周），供冲突判定使用
      weekNumbers: normalizeTeachingWeeks(items.flatMap((i) => i.weekNumbers || [])),
      arrangements: [...items]
        .sort(
          (a, b) =>
            (a.weekNumbers?.[0] || 0) - (b.weekNumbers?.[0] || 0) ||
            (a.startTime || "").localeCompare(b.startTime || "") ||
            (a.location || "").localeCompare(b.location || ""),
        )
        .map((i) => ({
          weeks: i.weeks,
          location: i.location,
          startTime: i.startTime,
          endTime: i.endTime,
        })),
    }
  })
}

/** 课程的上课周次：优先取 `weekNumbers`，其次解析 `arrangements[].weeks` 文本；识别不到返回空数组。 */
export function courseWeeks(course: CourseTableCourse): number[] {
  if (course.weekNumbers?.length) return normalizeTeachingWeeks(course.weekNumbers)
  return parseTeachingWeeks((course.arrangements || []).map((a) => a.weeks || '').join(';'))
}

/**
 * 同一格子内是否存在冲突。
 *
 * 判定规则：两门课程周次有交集即为冲突；一方周次无法识别时无法排除冲突，同样视为冲突。
 * 整个格子都取不到周次时返回 false——调用方没有提供周次数据，组件不臆测。
 */
export function hasCourseConflict(courses: CourseTableCourse[]): boolean {
  if (courses.length < 2) return false
  const weeks = courses.map(courseWeeks)
  if (!weeks.some((list) => list.length > 0)) return false
  return weeks.some((a, i) =>
    weeks.some((b, j) => j > i && (a.length === 0 || b.length === 0 || a.some((week) => b.includes(week)))),
  )
}

/** 课表格子：同一天内节次区间重叠的课程合并成的一格。 */
export interface CourseTableCell {
  dayOfWeek: number
  startSection: number
  /** 格子覆盖的节次范围（各组课程的并集） */
  endSection: number
  /** 格子内的课程块，按首次上课周次排序（周次未知的排最后） */
  courses: CourseTableCourse[]
  /** 格子内课程无法排除周次重叠，见 {@link hasCourseConflict} */
  conflict: boolean
}

const firstWeekOf = (course: CourseTableCourse): number => {
  const weeks = courseWeeks(course)
  return weeks.length > 0 ? weeks[0] : Number.MAX_SAFE_INTEGER
}

/**
 * 把课程块按天聚合成格子：同一天内节次区间重叠（含部分重叠）的课程合成一格，
 * 首尾相接或不相邻的课程各自成格。
 *
 * 后端允许同一时段存在多门课程（不同周次分批上课，或时间冲突），
 * 但网格一行/一列只能放一个块，故先聚合再排布，格子之间保证互不重叠。
 */
export function groupCourseTableCells(courses: CourseTableCourse[]): CourseTableCell[] {
  const cells: CourseTableCell[] = []
  const days = [...new Set(courses.map((course) => course.dayOfWeek))].sort((a, b) => a - b)

  days.forEach((day) => {
    const sorted = courses
      .filter((course) => course.dayOfWeek === day)
      .sort((a, b) => a.startSection - b.startSection || a.endSection - b.endSection)

    let current: CourseTableCell | null = null
    sorted.forEach((course) => {
      if (current && course.startSection <= current.endSection) {
        current.courses.push(course)
        current.endSection = Math.max(current.endSection, course.endSection)
        return
      }
      if (current) cells.push(current)
      current = {
        dayOfWeek: day,
        startSection: course.startSection,
        endSection: course.endSection,
        courses: [course],
        conflict: false,
      }
    })
    if (current) cells.push(current)
  })

  cells.forEach((cell) => {
    cell.courses.sort((a, b) => firstWeekOf(a) - firstWeekOf(b))
    cell.conflict = hasCourseConflict(cell.courses)
  })
  return cells
}
