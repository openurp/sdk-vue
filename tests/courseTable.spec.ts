import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CourseTable from '../src/components/CourseTable.vue'
import { buildCourseTableCourses, courseWeeks, groupCourseTableCells, hasCourseConflict } from '../src/components/courseTable'

const sample = [
  { id: 'a', name: '高数', crn: '1001', dayOfWeek: 1, startSection: 1, endSection: 2, teacher: '张', arrangements: [{ weeks: '1-7周', location: 'A101' }] },
  { id: 'b', name: '英语', crn: '1002', dayOfWeek: 1, startSection: 3, endSection: 4, teacher: '李', arrangements: [{ weeks: '1-16周', location: 'B202' }] },
  { id: 'c', name: '政治', crn: '1003', dayOfWeek: 1, startSection: 1, endSection: 1, teacher: '王' },
]

const courses = [...sample] as any[]

describe('CourseTable', () => {
  it('转置布局：行=节次、列=天，跨节用 rowspan', () => {
    const wrapper = mount(CourseTable, {
      props: {
        courses,
        transposed: true,
        days: [
          { value: 1, label: '周一' },
          { value: 2, label: '周二' },
        ],
      },
    })
    // 表头：节次 | 周一 | 周二
    const heads = wrapper.findAll('thead th').map((th) => th.text().trim())
    expect(heads).toEqual(['节次', '周一', '周二'])

    // 周一 1-2 节课程（高数）rowspan=2
    const rowspanCells = wrapper.findAll('td[rowspan]')
    const gaoshu = rowspanCells.find((td) => td.text().includes('高数'))
    expect(gaoshu?.attributes('rowspan')).toBe('2')

    // 同格课程（政治与高数同占周一第1节）一并显示，冲突只用颜色表达
    expect(gaoshu?.text()).toContain('政治')
    expect(gaoshu?.classes()).toContain('course-table__cell--conflict')
    expect(gaoshu?.text()).not.toContain('冲突')
    expect(gaoshu?.find('.course-table__cell').attributes('title')).toBe(
      '同一时段的多门课程上课周次重叠',
    )

    // 周一 3-4 节（英语）rowspan=2
    const yingyu = rowspanCells.find((td) => td.text().includes('英语'))
    expect(yingyu?.attributes('rowspan')).toBe('2')
    expect(yingyu?.classes()).not.toContain('course-table__cell--conflict')
  })

  it('经典布局：行=天、列=节次，跨节用 colspan', () => {
    const wrapper = mount(CourseTable, {
      props: {
        courses,
        transposed: false,
        days: [{ value: 1, label: '周一' }],
      },
    })
    const heads = wrapper.findAll('thead th').map((th) => th.text().trim())
    expect(heads[0]).toBe('星期')
    expect(heads.slice(1)).toEqual(['第1节', '第2节', '第3节', '第4节'])

    const colspanCells = wrapper.findAll('td[colspan]')
    const gaoshu = colspanCells.find((td) => td.text().includes('高数'))
    expect(gaoshu?.attributes('colspan')).toBe('2')
    const yingyu = colspanCells.find((td) => td.text().includes('英语'))
    expect(yingyu?.attributes('colspan')).toBe('2')
  })

  it('色条方向随布局不同：转置=顶部(data-bar=top)、经典=左侧(data-bar=left)', () => {
    const single = [
      { id: 's', name: '体育', dayOfWeek: 2, startSection: 5, endSection: 5, teacher: '赵' },
    ]
    // 转置布局：合并 td 与单节块都标 top
    const transposed = mount(CourseTable, {
      props: {
        courses: [...courses, ...single],
        transposed: true,
        days: [
          { value: 1, label: '周一' },
          { value: 2, label: '周二' },
        ],
      },
    })
    const tMerged = transposed.find('td[rowspan].tone-0')
    expect(tMerged?.attributes('data-bar')).toBe('top')
    const tSingle = transposed.findAll('.course-table__cell[data-bar]').find((c) => c.text().includes('体育'))
    expect(tSingle?.attributes('data-bar')).toBe('top')
    // 经典布局：合并 td 与单节块都标 left
    const classic = mount(CourseTable, {
      props: {
        courses: [...courses, ...single],
        transposed: false,
        days: [
          { value: 1, label: '周一' },
          { value: 2, label: '周二' },
        ],
      },
    })
    const cMerged = classic.find('td[colspan].tone-0')
    expect(cMerged?.attributes('data-bar')).toBe('left')
    const cSingle = classic.findAll('.course-table__cell[data-bar]').find((c) => c.text().includes('体育'))
    expect(cSingle?.attributes('data-bar')).toBe('left')
  })

  it('默认插槽渲染课程名(crn) 与 教师 | 周次、地点', () => {
    const wrapper = mount(CourseTable, {
      props: { courses: courses.slice(0, 1), transposed: true, days: [{ value: 1, label: '周一' }] },
    })
    expect(wrapper.text()).toContain('高数（1001）')
    expect(wrapper.text()).toContain('张 | 1-7周、A101')
  })

  it('course-click 事件携带课程信息', async () => {
    const wrapper = mount(CourseTable, {
      props: { courses: courses.slice(0, 1), transposed: true, days: [{ value: 1, label: '周一' }] },
    })
    const cell = wrapper.find('.course-table__cell')
    await cell.trigger('click')
    const emitted = wrapper.emitted('course-click')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0][0]).toMatchObject({ name: '高数' })
    expect(emitted?.[0][1]).toMatchObject({
      day: 1,
      startSection: 1,
      conflict: false,
      courses: [{ name: '高数' }],
    })
  })

  it('同格课程周次不重叠时并列显示且不标冲突', () => {
    const sameSlot = [
      { id: 'x', name: '数据结构', dayOfWeek: 5, startSection: 6, endSection: 10, weekNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { id: 'y', name: '操作系统', dayOfWeek: 5, startSection: 6, endSection: 10, weekNumbers: [10, 11, 12, 13, 14, 15, 16, 17, 18] },
    ] as any[]
    const wrapper = mount(CourseTable, {
      props: { courses: sameSlot, transposed: true, days: [{ value: 5, label: '周五' }] },
    })
    const items = wrapper.findAll('.course-table__item')
    expect(items.map((item) => item.text())).toEqual([
      '数据结构',
      '操作系统',
    ])
    expect(wrapper.find('.course-table__cell--conflict').exists()).toBe(false)
    expect(wrapper.find('.course-table__cell').attributes('title')).toBeUndefined()
    // 整格覆盖两门课程的节次并集
    const merged = wrapper.findAll('td[rowspan]').find((td) => td.text().includes('数据结构'))
    expect(merged?.attributes('rowspan')).toBe('5')
  })

  it('同格课程周次重叠时标记冲突，只有周次文本也能判定', () => {
    const overlapping = [
      { id: 'x', name: '数据结构', dayOfWeek: 5, startSection: 6, endSection: 7, arrangements: [{ weeks: '1-9周' }] },
      { id: 'z', name: '计算机网络', dayOfWeek: 5, startSection: 6, endSection: 7, arrangements: [{ weeks: '5-12周' }] },
    ] as any[]
    const wrapper = mount(CourseTable, {
      props: { courses: overlapping, transposed: true, days: [{ value: 5, label: '周五' }] },
    })
    expect(wrapper.find('.course-table__cell--conflict').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('冲突')
    expect(wrapper.find('.course-table__cell').attributes('title')).toBe(
      '同一时段的多门课程上课周次重叠',
    )

    // 冲突判定可自定义，返回 false 即完全关闭标记
    const quiet = mount(CourseTable, {
      props: {
        courses: overlapping,
        transposed: true,
        days: [{ value: 5, label: '周五' }],
        conflict: () => false,
      },
    })
    expect(quiet.find('.course-table__cell--conflict').exists()).toBe(false)
    expect(quiet.find('.course-table__cell').attributes('title')).toBeUndefined()
  })

  it('自定义插槽可取到整格课程与冲突标记', () => {
    const sameSlot = [
      { id: 'x', name: '数据结构', dayOfWeek: 5, startSection: 6, endSection: 10, weekNumbers: [1, 2, 3] },
      { id: 'y', name: '操作系统', dayOfWeek: 5, startSection: 6, endSection: 10, weekNumbers: [2, 3, 4] },
    ] as any[]
    const wrapper = mount(CourseTable, {
      props: { courses: sameSlot, transposed: true, days: [{ value: 5, label: '周五' }] },
      slots: {
        course: '<span class="probe">{{ course.name }}/{{ courses.length }}/{{ conflict }}</span>',
      },
    })
    expect(wrapper.find('.probe').text()).toBe('数据结构/2/true')
  })

  it('buildCourseTableCourses 同课同天同时段合并，不同天/节次各自成块', () => {
    const schedules = [
      // 4733 财务管理：周三 3-4 两条（换教室）+ 周五 1-2 两条（换教室）
      { crn: '4733', courseName: '财务管理', dayOfWeek: 3, startSection: 3, teacher: '张彩虹', location: '4DS41', weeks: '1-12,14-15周', weekNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15], startTime: '10:20', endTime: '11:55', custom: 'keep-me' },
      { crn: '4733', courseName: '财务管理', dayOfWeek: 3, startSection: 3, teacher: '张彩虹', location: '2D217', weeks: '13周', weekNumbers: [13], startTime: '10:20', endTime: '11:55' },
      { crn: '4733', courseName: '财务管理', dayOfWeek: 5, startSection: 1, teacher: '张彩虹', location: '4DS41', weeks: '1-12,14-15周', weekNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15], startTime: '08:30', endTime: '10:05' },
      { crn: '4733', courseName: '财务管理', dayOfWeek: 5, startSection: 1, teacher: '张彩虹', location: '2D217', weeks: '13周', weekNumbers: [13], startTime: '08:30', endTime: '10:05' },
    ]
    const blocks = buildCourseTableCourses(schedules)
    expect(blocks).toHaveLength(2)
    // 周三块：arrangements 合并（13周在后）
    const wed = blocks.find((b) => b.dayOfWeek === 3)
    expect(wed?.name).toBe('财务管理')
    expect(wed?.teacher).toBe('张彩虹')
    expect(wed?.arrangements?.map((a) => a.weeks)).toEqual(['1-12,14-15周', '13周'])
    expect(wed?.arrangements?.map((a) => a.location)).toEqual(['4DS41', '2D217'])
    // 保留源字段（详情抽屉复用）
    expect(wed?.custom).toBe('keep-me')
    expect(wed?.startSection).toBe(3)
    // 周五块
    const fri = blocks.find((b) => b.dayOfWeek === 5)
    expect(fri?.startSection).toBe(1)
    expect(fri?.arrangements?.map((a) => a.weeks)).toEqual(['1-12,14-15周', '13周'])
  })

  it('buildCourseTableCourses teacher 去重并支持自定义课程标识', () => {
    const schedules = [
      { code: 'A01', courseName: '体育', dayOfWeek: 2, startSection: 5, teacher: '赵', location: '操场', weeks: '1-4周', weekNumbers: [1, 2, 3, 4] },
      { code: 'A01', courseName: '体育', dayOfWeek: 2, startSection: 5, teacher: '赵', location: '操场', weeks: '5-8周', weekNumbers: [5, 6, 7, 8] },
    ]
    const blocks = buildCourseTableCourses(schedules, (c) => c.code as string)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].teacher).toBe('赵')
    expect(blocks[0].arrangements?.map((a) => a.weeks)).toEqual(['1-4周', '5-8周'])
    // 同块多条安排的周次取并集，供冲突判定使用
    expect(blocks[0].weekNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('buildCourseTableCourses 缺省 endSection 时按单节处理', () => {
    const blocks = buildCourseTableCourses([
      { crn: 'A1', courseName: '体育', dayOfWeek: 2, startSection: 5 },
      { crn: 'A2', courseName: '音乐', dayOfWeek: 2, startSection: 6, endSection: 8 },
    ])
    expect(blocks.find((b) => b.crn === 'A1')?.endSection).toBe(5)
    expect(blocks.find((b) => b.crn === 'A2')?.endSection).toBe(8)
  })
})

describe('groupCourseTableCells / 冲突判定', () => {
  const cell = (courses: any[]) => ({ dayOfWeek: 5, startSection: 6, endSection: 10, courses, conflict: false })

  it('courseWeeks 优先用 weekNumbers，其次解析 arrangements[].weeks', () => {
    expect(courseWeeks({ id: 1, name: 'A', dayOfWeek: 1, startSection: 1, endSection: 2, weekNumbers: [3, 1, 2] } as any)).toEqual([1, 2, 3])
    expect(courseWeeks({ id: 2, name: 'B', dayOfWeek: 1, startSection: 1, endSection: 2, arrangements: [{ weeks: '1-3周' }] } as any)).toEqual([1, 2, 3])
    expect(courseWeeks({ id: 3, name: 'C', dayOfWeek: 1, startSection: 1, endSection: 2 } as any)).toEqual([])
  })

  it('hasCourseConflict：周次交集=冲突，任一方周次未知=冲突，全都未知=不判定', () => {
    const course = (id: string, weekNumbers?: number[]) =>
      ({ id, name: id, dayOfWeek: 5, startSection: 6, endSection: 10, weekNumbers }) as any
    expect(hasCourseConflict([course('a', [1, 2])])).toBe(false)
    expect(hasCourseConflict([course('a', [1, 2]), course('b', [3, 4])])).toBe(false)
    expect(hasCourseConflict([course('a', [1, 2]), course('b', [2, 3])])).toBe(true)
    expect(hasCourseConflict([course('a', [1, 2]), course('b')])).toBe(true)
    expect(hasCourseConflict([course('a'), course('b')])).toBe(false)
  })

  it('groupCourseTableCells：重叠合并取并集区间，首尾相接/不同天各自成格，课程按周次排序', () => {
    const cells = groupCourseTableCells([
      { id: 'a', name: 'A', dayOfWeek: 5, startSection: 6, endSection: 10, weekNumbers: [10, 11] },
      { id: 'b', name: 'B', dayOfWeek: 5, startSection: 8, endSection: 12, weekNumbers: [1, 2] },
      { id: 'c', name: 'C', dayOfWeek: 5, startSection: 13, endSection: 14, weekNumbers: [1] },
      { id: 'd', name: 'D', dayOfWeek: 1, startSection: 6, endSection: 10, weekNumbers: [1] },
    ] as any[])
    expect(cells).toHaveLength(3)
    const friday = cells.find((item) => item.dayOfWeek === 5 && item.startSection === 6)
    expect(friday?.endSection).toBe(12)
    expect(friday?.courses.map((course) => course.name)).toEqual(['B', 'A'])
    expect(friday?.conflict).toBe(false)
    expect(cells.find((item) => item.dayOfWeek === 5 && item.startSection === 13)?.endSection).toBe(14)
    // 不同天互不影响
    expect(cells.filter((item) => item.dayOfWeek === 1)).toHaveLength(1)
  })
})
