import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CourseTable from '../src/components/CourseTable.vue'

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

    // 冲突课程（政治与高数同占周一第1节）应被跳过
    expect(wrapper.text()).not.toContain('政治')

    // 周一 3-4 节（英语）rowspan=2
    const yingyu = rowspanCells.find((td) => td.text().includes('英语'))
    expect(yingyu?.attributes('rowspan')).toBe('2')
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
    expect(emitted?.[0][1]).toMatchObject({ day: 1, startSection: 1 })
  })
})
