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
