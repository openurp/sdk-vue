/**
 * 真实数据核对 fixtures：取自 2025-2026-2 学期（semester id=20252，beginOn=2026-03-02，
 * calendar.firstWeekday=Mon）学生 423325 的 course-takers API 原始响应。
 *
 * 用途：将来解析逻辑（weekstate 位序 / 教学周次）变动时，用这些真实数据回归核对，
 * 防止出现"差一周/待定"类回归。新增课程活动时在此追加一条即可。
 *
 * 注意：weekstate 是 beangle 二进制位图字符串（最右=week 0），startOn 仅提供星期几
 * 与 week 1 锚点；教学周次相对 semester.beginOn 所在自然周（firstWeekday=Mon）计算。
 * 详见 docs/teaching-week.md。
 */
export const teachingWeekSemester = {
  id: '20252',
  name: '2025-2026学年第2学期',
  beginOn: '2026-03-02',
  firstWeekday: 'Mon' as const,
}

export interface TeachingWeekFixture {
  /** 课程序号（crn） */
  crn: string
  /** 课程名 */
  course: string
  /** 活动 startOn（仅提供星期几与 week 1 锚点） */
  startOn: string
  /** 星期几（校验用，应与 startOn 一致） */
  weekday: '一' | '二' | '三' | '四' | '五' | '六' | '日'
  /** 节次 */
  units: string
  /** beangle weekstate 位图（0/1 字符串） */
  weekstate: string
  /** 期望教学周次（formatTeachingWeeks 输出），空串表示不应有上课日期 */
  weeks: string
}

/** 2025-2026-2 真实课程活动（来自 course-takers API，2026-07 拉取）。 */
export const teachingWeekFixtures: TeachingWeekFixture[] = [
  // 15 个 1：开学第一周起连续 15 周
  { crn: '4734', course: '税法', startOn: '2026-01-05', weekday: '一', units: '3-4', weekstate: '111111111111111000000000', weeks: '1-15周' },
  { crn: '8453', course: '高等数学B—微积分(二)', startOn: '2026-01-05', weekday: '一', units: '1-2', weekstate: '111111111111111000000000', weeks: '1-15周' },
  { crn: '8453', course: '高等数学B—微积分(二)', startOn: '2026-01-01', weekday: '四', units: '5-6', weekstate: '1111111111111110000000000', weeks: '1-15周' },
  { crn: '4776', course: '金融学', startOn: '2026-01-01', weekday: '四', units: '1-3', weekstate: '1111111111111110000000000', weeks: '1-15周' },
  { crn: '8729', course: '日本经济论', startOn: '2026-01-01', weekday: '四', units: '9-10', weekstate: '1111111111111110000000000', weeks: '1-15周' },
  { crn: '9297', course: '大学英语(四)', startOn: '2026-01-02', weekday: '五', units: '3-4', weekstate: '1111111111111110000000000', weeks: '1-15周' },
  { crn: '9635', course: '专项体育－排球2', startOn: '2026-01-02', weekday: '五', units: '7-8', weekstate: '1111111111111110000000000', weeks: '1-15周' },
  { crn: '1103', course: '人工智能基础与应用', startOn: '2026-01-05', weekday: '一', units: '11-12', weekstate: '111111111111111000000000', weeks: '1-15周' },
  { crn: '4741', course: '中国金融制度、机构与市场（全英语）', startOn: '2026-01-05', weekday: '一', units: '9-10', weekstate: '111111111111111000000000', weeks: '1-15周' },
  { crn: '8769', course: '消费者信用管理', startOn: '2026-01-07', weekday: '三', units: '11-12', weekstate: '111111111111111000000000', weeks: '1-15周' },
  // 8 个 1：第 5-12 周（week 13..20，startOn 偏移 12..19 周）
  { crn: '4744', course: '智能会计技术与实践', startOn: '2026-01-06', weekday: '二', units: '5-8', weekstate: '111111110000000000000', weeks: '5-12周' },
  // 4 个 1：第 5-8 周
  { crn: '4731', course: '形势与政策④', startOn: '2026-01-06', weekday: '二', units: '11-12', weekstate: '11110000000000000', weeks: '5-8周' },
  // 换教室拆两条：主段缺第 13 周 + 单独第 13 周
  { crn: '4733', course: '财务管理', startOn: '2026-01-07', weekday: '三', units: '3-4', weekstate: '110111111111111000000000', weeks: '1-12,14-15周' },
  { crn: '4733', course: '财务管理', startOn: '2026-01-07', weekday: '三', units: '3-4', weekstate: '1000000000000000000000', weeks: '13周' },
  { crn: '4733', course: '财务管理', startOn: '2026-01-02', weekday: '五', units: '1-2', weekstate: '1101111111111110000000000', weeks: '1-12,14-15周' },
  { crn: '4733', course: '财务管理', startOn: '2026-01-02', weekday: '五', units: '1-2', weekstate: '10000000000000000000000', weeks: '13周' },
  // 中间某周换教室：主段缺第 5 周 + 单独第 5 周
  { crn: '4735', course: '中级财务会计(二)', startOn: '2026-01-06', weekday: '二', units: '2-4', weekstate: '111111111101111000000000', weeks: '1-4,6-15周' },
  { crn: '4735', course: '中级财务会计(二)', startOn: '2026-01-06', weekday: '二', units: '2-4', weekstate: '10000000000000', weeks: '5周' },
  { crn: '4739', course: '数字财务', startOn: '2026-01-07', weekday: '三', units: '9-10', weekstate: '111111111101111000000000', weeks: '1-4,6-15周' },
  { crn: '4739', course: '数字财务', startOn: '2026-01-07', weekday: '三', units: '9-10', weekstate: '10000000000000', weeks: '5周' },
]
