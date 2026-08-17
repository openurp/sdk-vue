/** CourseTable 组件的数据模型与配置类型。 */

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
      teacher: [...new Set(items.map((i) => i.teacher).filter(Boolean))].join("、"),
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
