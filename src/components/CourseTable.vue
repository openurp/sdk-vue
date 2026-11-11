<script setup lang="ts">
import { computed } from 'vue'
import type { CourseTableCourse, CourseTableDay } from './courseTable'
import { groupCourseTableCells, hasCourseConflict, type CourseTableCell } from './courseTable'

const props = withDefaults(
  defineProps<{
    courses: CourseTableCourse[]
    /** true=行节次、列天（现代布局）；false=行天、列节次（经典布局） */
    transposed?: boolean
    days?: CourseTableDay[]
    /** 最大节次数；缺省按课程数据推导 */
    maxSection?: number
    /** 颜色索引（0..4），决定色条/背景色；同一格子里取首门课程 */
    tone?: (course: CourseTableCourse) => number
    /** 同格冲突判定；缺省按上课周次重叠判定（见 hasCourseConflict） */
    conflict?: (courses: CourseTableCourse[]) => boolean
    dayLabel?: (day: CourseTableDay) => string
    clickable?: boolean
  }>(),
  {
    transposed: false,
    days: () => [
      { value: 1, label: '周一' },
      { value: 2, label: '周二' },
      { value: 3, label: '周三' },
      { value: 4, label: '周四' },
      { value: 5, label: '周五' },
      { value: 6, label: '周六' },
      { value: 7, label: '周日' },
    ],
    maxSection: 0,
    tone: () => 0,
    conflict: hasCourseConflict,
    dayLabel: (day: CourseTableDay) => day.label,
    clickable: true,
  },
)

const emit = defineEmits<{
  'course-click': [
    course: CourseTableCourse,
    info: {
      day: number
      startSection: number
      /** 同一格子的全部课程（含当前课程） */
      courses: CourseTableCourse[]
      /** 同格冲突标记 */
      conflict: boolean
    },
  ]
}>()

const visibleDays = computed(() => {
  if (props.days.length > 0) return props.days
  return [
    { value: 1, label: '周一' },
    { value: 2, label: '周二' },
    { value: 3, label: '周三' },
    { value: 4, label: '周四' },
    { value: 5, label: '周五' },
    { value: 6, label: '周六' },
    { value: 7, label: '周日' },
  ]
})

/** 节次列表：1..max（含中间空节次，保证网格连续） */
const sections = computed(() => {
  const max = Math.max(
    props.maxSection,
    ...props.courses.map((c) => c.endSection),
    0,
  )
  return Array.from({ length: max }, (_, i) => i + 1)
})

interface DayPlacement {
  placed: (CourseTableCell | null)[]
  spans: Map<number, number>
  occupied: boolean[]
}

/**
 * 每天按节次放置格子：同一格子里重叠的课程已由 groupCourseTableCells 合并，
 * 格子之间互不重叠，这里只按开始节次落格并记录 span（合并方向由布局决定）。
 */
const dayPlacements = computed<Map<number, DayPlacement>>(() => {
  const cells = groupCourseTableCells(props.courses).map((cell) => ({
    ...cell,
    conflict: props.conflict(cell.courses),
  }))
  const result = new Map<number, DayPlacement>()
  visibleDays.value.forEach((day) => {
    const max = sections.value.length
    const placed = new Array<CourseTableCell | null>(max).fill(null)
    const spans = new Map<number, number>()
    const occupied = new Array<boolean>(max).fill(false)
    cells
      .filter((cell) => cell.dayOfWeek === day.value)
      .forEach((cell) => {
        const startIdx = cell.startSection - 1
        const endIdx = cell.endSection - 1
        if (startIdx < 0 || endIdx >= max || startIdx > endIdx) return
        occupied.fill(true, startIdx, endIdx + 1)
        placed[startIdx] = cell
        spans.set(startIdx, endIdx - startIdx + 1)
      })
    result.set(day.value, { placed, spans, occupied })
  })
  return result
})

/** 第二行文本：教师 | 周次、地点（多个安排用「；」连接）。 */
function courseMetaText(course: CourseTableCourse): string {
  const schedule = (course.arrangements || [])
    .map((a) => {
      const weeks = a.weeks || '周次待定'
      const location = a.location && a.location !== '未安排教室' ? a.location : ''
      return location ? `${weeks}、${location}` : weeks
    })
    .join('；')
  if (!course.teacher && !schedule) return ''
  return [course.teacher, schedule].filter(Boolean).join(' | ')
}

/** 冲突格子的悬停说明：冲突只用颜色表达，避免文字挤占格子空间。 */
const CONFLICT_TITLE = '同一时段的多门课程上课周次重叠'

type GridCell =
  | { key: string; entry: CourseTableCell; day: number; span: number; tone: number }
  | { key: string; entry: null; span: 1 }

const cellKey = (cell: CourseTableCell): string =>
  cell.courses.map((course) => String(course.id)).join('+')

/** 转置布局（行=节次、列=天）：按节次行产出各天单元格，跨节用 rowspan。 */
const transposedCells = (sectionIndex: number): GridCell[] => {
  const cells: GridCell[] = []
  visibleDays.value.forEach((day) => {
    const placement = dayPlacements.value.get(day.value)
    if (!placement) {
      cells.push({ key: `${day.value}-e`, entry: null, span: 1 })
      return
    }
    const span = placement.spans.get(sectionIndex)
    if (span) {
      const entry = placement.placed[sectionIndex]
      cells.push(
        entry
          ? { key: `${day.value}-${cellKey(entry)}`, entry, day: day.value, span, tone: props.tone(entry.courses[0]) }
          : { key: `${day.value}-e`, entry: null, span: 1 },
      )
    } else if (placement.occupied[sectionIndex]) {
      // 被上方 rowspan 覆盖，跳过
    } else {
      cells.push({ key: `${day.value}-e`, entry: null, span: 1 })
    }
  })
  return cells
}

/** 经典布局（行=天、列=节次）：按天产出各节次单元格，跨节用 colspan。 */
const classicCells = (day: number): GridCell[] => {
  const cells: GridCell[] = []
  const placement = dayPlacements.value.get(day)
  const max = sections.value.length
  if (!placement) {
    for (let i = 0; i < max; i++) cells.push({ key: `${day}-e${i}`, entry: null, span: 1 })
    return cells
  }
  for (let i = 0; i < max; i++) {
    const span = placement.spans.get(i)
    if (span) {
      const entry = placement.placed[i]
      cells.push(
        entry
          ? { key: `${day}-${cellKey(entry)}`, entry, day, span, tone: props.tone(entry.courses[0]) }
          : { key: `${day}-e${i}`, entry: null, span: 1 },
      )
    } else if (placement.occupied[i]) {
      // 被左侧 colspan 覆盖，跳过
    } else {
      cells.push({ key: `${day}-e${i}`, entry: null, span: 1 })
    }
  }
  return cells
}

/** 单元格点击：触发格子里第一门课程（默认渲染下每门课程也可单独点击）。 */
function onCourseClick(cell: CourseTableCell, day: number) {
  onCourseItemClick(cell.courses[0], cell, day)
}

function onCourseItemClick(course: CourseTableCourse, cell: CourseTableCell, day: number) {
  if (!props.clickable) return
  emit('course-click', course, {
    day,
    startSection: course.startSection,
    courses: cell.courses,
    conflict: cell.conflict,
  })
}
</script>

<template>
  <div
    class="course-table"
    :class="[transposed ? 'course-table--transposed' : 'course-table--classic']"
  >
    <table class="course-table__grid">
      <thead>
        <tr>
          <template v-if="transposed">
            <th class="course-table__corner course-table__section-col">节次</th>
            <th
              v-for="day in visibleDays"
              :key="day.value"
              class="course-table__day-col"
            >{{ dayLabel(day) }}</th>
          </template>
          <template v-else>
            <th class="course-table__corner course-table__day-col">星期</th>
            <th
              v-for="section in sections"
              :key="section"
              class="course-table__section-col"
            >第{{ section }}节</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <template v-if="transposed">
          <tr v-for="(section, sectionIndex) in sections" :key="section">
            <th class="course-table__section-col">
              <strong>{{ section }}</strong><span>节</span>
            </th>
            <td
              v-for="cell in transposedCells(sectionIndex)"
              :key="cell.key"
              :rowspan="cell.span"
              data-bar="top"
              :class="[
                cell.entry && cell.span > 1 ? `tone-${cell.tone}` : undefined,
                cell.entry?.conflict ? 'course-table__cell--conflict' : undefined,
              ]"
            >
              <div
                v-if="cell.entry"
                class="course-table__cell"
                :class="[
                  cell.span === 1 ? `tone-${cell.tone}` : undefined,
                  cell.entry.conflict ? 'course-table__cell--conflict' : undefined,
                ]"
                :data-bar="cell.span === 1 ? 'top' : undefined"
                role="button"
                :tabindex="clickable ? 0 : -1"
                :title="cell.entry.conflict ? CONFLICT_TITLE : undefined"
                @click="onCourseClick(cell.entry, cell.day)"
                @keydown.enter.prevent="clickable && onCourseClick(cell.entry, cell.day)"
              >
                <slot
                  name="course"
                  :course="cell.entry.courses[0]"
                  :courses="cell.entry.courses"
                  :conflict="cell.entry.conflict"
                  :day="cell.day"
                  :start-section="cell.entry.startSection"
                  :end-section="cell.entry.endSection"
                  :tone="cell.tone"
                >
                  <span
                    v-for="course in cell.entry.courses"
                    :key="String(course.id)"
                    class="course-table__item"
                    @click.stop="onCourseItemClick(course, cell.entry, cell.day)"
                  >
                    <span class="course-table__name">{{ course.name }}<template v-if="course.crn">（{{ course.crn }}）</template></span>
                    <span v-if="courseMetaText(course)" class="course-table__meta">{{ courseMetaText(course) }}</span>
                  </span>
                </slot>
              </div>
            </td>
          </tr>
        </template>
        <template v-else>
          <tr v-for="day in visibleDays" :key="day.value">
            <th class="course-table__day-col">{{ dayLabel(day) }}</th>
            <td
              v-for="cell in classicCells(day.value)"
              :key="cell.key"
              :colspan="cell.span"
              data-bar="left"
              :class="[
                cell.entry && cell.span > 1 ? `tone-${cell.tone}` : undefined,
                cell.entry?.conflict ? 'course-table__cell--conflict' : undefined,
              ]"
            >
              <div
                v-if="cell.entry"
                class="course-table__cell"
                :class="[
                  cell.span === 1 ? `tone-${cell.tone}` : undefined,
                  cell.entry.conflict ? 'course-table__cell--conflict' : undefined,
                ]"
                :data-bar="cell.span === 1 ? 'left' : undefined"
                role="button"
                :tabindex="clickable ? 0 : -1"
                :title="cell.entry.conflict ? CONFLICT_TITLE : undefined"
                @click="onCourseClick(cell.entry, cell.day)"
                @keydown.enter.prevent="clickable && onCourseClick(cell.entry, cell.day)"
              >
                <slot
                  name="course"
                  :course="cell.entry.courses[0]"
                  :courses="cell.entry.courses"
                  :conflict="cell.entry.conflict"
                  :day="cell.day"
                  :start-section="cell.entry.startSection"
                  :end-section="cell.entry.endSection"
                  :tone="cell.tone"
                >
                  <span
                    v-for="course in cell.entry.courses"
                    :key="String(course.id)"
                    class="course-table__item"
                    @click.stop="onCourseItemClick(course, cell.entry, cell.day)"
                  >
                    <span class="course-table__name">{{ course.name }}<template v-if="course.crn">（{{ course.crn }}）</template></span>
                    <span v-if="courseMetaText(course)" class="course-table__meta">{{ courseMetaText(course) }}</span>
                  </span>
                </slot>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* 主题变量（消费方可覆盖） */
.course-table {
  --ct-row-height: 50px;
  --ct-day-row-height: 56px;
  --ct-head-height: 26px;
  --ct-min-width: 100%;
  --ct-day-col-width: 116px;
  --ct-section-col-width: 46px;
  --ct-border: #e5eaf0;
  --ct-head-bg: #f6f8fa;
  --ct-side-bg: #f8fafb;
  --ct-text: #26384d;
  --ct-meta: #50657b;
  --ct-tone-0: #4386c5;
  --ct-tone-0-bg: #edf5fc;
  --ct-tone-1: #6d72c9;
  --ct-tone-1-bg: #f0f0fb;
  --ct-tone-2: #3e9a79;
  --ct-tone-2-bg: #edf8f4;
  --ct-tone-3: #d68a38;
  --ct-tone-3-bg: #fbf4e9;
  --ct-tone-4: #b9657b;
  --ct-tone-4-bg: #faeff2;
  /* 同一格子内多门课程周次冲突时的标记色（红色色条 + 斜纹底） */
  --ct-conflict: #d54941;
  --ct-conflict-bg: #fdecec;
  --ct-conflict-bg-alt: #f8d7d5;
  /* 同一格子内课程之间的分隔线 */
  --ct-divider: #cfd9e4;
}

.course-table__grid {
  width: 100%;
  min-width: var(--ct-min-width);
  border-collapse: collapse;
  table-layout: auto;
}

.course-table__grid th,
.course-table__grid td {
  border-right: 1px solid var(--ct-border);
  border-bottom: 1px solid var(--ct-border);
}

.course-table__grid thead th {
  height: var(--ct-head-height);
  min-width: 60px;
  background: var(--ct-head-bg);
  color: #4f5d70;
  font-size: 12px;
  font-weight: 500;
}

.course-table__day-col {
  width: var(--ct-day-col-width);
  min-width: var(--ct-day-col-width);
  text-align: center;
  background: var(--ct-side-bg);
  color: #4f5d70;
}

.course-table__section-col {
  width: var(--ct-section-col-width);
  min-width: var(--ct-section-col-width);
  text-align: center;
  background: var(--ct-side-bg);
  white-space: nowrap;
}
.course-table__section-col strong {
  display: inline;
  font-size: 13px;
  color: #354154;
}
.course-table__section-col span {
  font-size: 11px;
  color: #98a2b3;
}

/* 转置布局（行=节次）：每行固定行高 */
.course-table--transposed tbody tr {
  height: var(--ct-row-height);
}
.course-table--transposed td {
  min-width: 0;
  height: var(--ct-row-height);
  padding: 0;
  vertical-align: top;
}
/* 经典布局（行=天）：行高由当天课程内容撑起（一天多节课并排，固定行高放不下）。
   最小行高用独立的 --ct-day-row-height（默认比节次行高更宽裕），可被消费方覆盖；
   内容超出时自动增高。 */
.course-table--classic td {
  min-width: 0;
  height: auto;
  min-height: var(--ct-day-row-height);
  padding: 0;
  vertical-align: top;
}
/* 首列（行/列标签）收窄：经典=星期（周一…），转置=节次（1节…）。
   table-layout:auto 会把剩余宽度继续分给有 width 的首列，单日视图下尤其明显；
   width:1% 让首列收缩到 min-width，剩余空间交给天/节次数据列。
   注意转置布局的天列/经典的表头节次列仍是数据列，保持 --ct-day-col-width /
   --ct-section-col-width 不变。 */
.course-table--classic .course-table__day-col {
  width: 1%;
  min-width: var(--ct-day-label-width, 52px);
}
.course-table--transposed .course-table__section-col {
  width: 1%;
  min-width: var(--ct-section-label-width, 34px);
}

/* 合并单元格（跨节）承担整体着色：背景 + 色条。
   色条方向由布局决定并通过 data-bar 显式声明：转置(天为列)=顶部，经典(天为行)=左侧。
   着色在 td 级，与内部块高度无关，跨浏览器稳定。 */
.course-table td[data-bar="top"].tone-0 { border-top: 3px solid var(--ct-tone-0); background: var(--ct-tone-0-bg); }
.course-table td[data-bar="top"].tone-1 { border-top: 3px solid var(--ct-tone-1); background: var(--ct-tone-1-bg); }
.course-table td[data-bar="top"].tone-2 { border-top: 3px solid var(--ct-tone-2); background: var(--ct-tone-2-bg); }
.course-table td[data-bar="top"].tone-3 { border-top: 3px solid var(--ct-tone-3); background: var(--ct-tone-3-bg); }
.course-table td[data-bar="top"].tone-4 { border-top: 3px solid var(--ct-tone-4); background: var(--ct-tone-4-bg); }
.course-table td[data-bar="left"].tone-0 { border-left: 3px solid var(--ct-tone-0); background: var(--ct-tone-0-bg); }
.course-table td[data-bar="left"].tone-1 { border-left: 3px solid var(--ct-tone-1); background: var(--ct-tone-1-bg); }
.course-table td[data-bar="left"].tone-2 { border-left: 3px solid var(--ct-tone-2); background: var(--ct-tone-2-bg); }
.course-table td[data-bar="left"].tone-3 { border-left: 3px solid var(--ct-tone-3); background: var(--ct-tone-3-bg); }
.course-table td[data-bar="left"].tone-4 { border-left: 3px solid var(--ct-tone-4); background: var(--ct-tone-4-bg); }

.course-table__cell {
  display: block;
  width: 100%;
  min-height: var(--ct-row-height);
  padding: 2px 4px;
  box-sizing: border-box;
  border-radius: 0;
  color: var(--ct-text);
  cursor: pointer;
}
/* 经典布局（行=天）内块跟随天行高 */
.course-table--classic .course-table__cell {
  min-height: var(--ct-day-row-height);
}
/* 单节单元格：块自带背景 + 色条（方向同样按 data-bar） */
.course-table__cell.tone-0 { background: var(--ct-tone-0-bg); }
.course-table__cell.tone-1 { background: var(--ct-tone-1-bg); }
.course-table__cell.tone-2 { background: var(--ct-tone-2-bg); }
.course-table__cell.tone-3 { background: var(--ct-tone-3-bg); }
.course-table__cell.tone-4 { background: var(--ct-tone-4-bg); }
.course-table__cell[data-bar="top"].tone-0 { border-top: 3px solid var(--ct-tone-0); }
.course-table__cell[data-bar="top"].tone-1 { border-top: 3px solid var(--ct-tone-1); }
.course-table__cell[data-bar="top"].tone-2 { border-top: 3px solid var(--ct-tone-2); }
.course-table__cell[data-bar="top"].tone-3 { border-top: 3px solid var(--ct-tone-3); }
.course-table__cell[data-bar="top"].tone-4 { border-top: 3px solid var(--ct-tone-4); }
.course-table__cell[data-bar="left"].tone-0 { border-left: 3px solid var(--ct-tone-0); }
.course-table__cell[data-bar="left"].tone-1 { border-left: 3px solid var(--ct-tone-1); }
.course-table__cell[data-bar="left"].tone-2 { border-left: 3px solid var(--ct-tone-2); }
.course-table__cell[data-bar="left"].tone-3 { border-left: 3px solid var(--ct-tone-3); }
.course-table__cell[data-bar="left"].tone-4 { border-left: 3px solid var(--ct-tone-4); }

/* 合并单元格内块透明（着色已由 td 承担），尽量撑满 */
.course-table td[data-bar][class*="tone-"] > .course-table__cell {
  background: transparent;
  border: 0;
  height: 100%;
}

/* 同一格子的多门课程：逐条展示，条目之间用虚线分隔。 */
.course-table__item {
  display: block;
  cursor: pointer;
}
.course-table__item + .course-table__item {
  margin-top: 3px;
  padding-top: 3px;
  border-top: 1px dashed var(--ct-divider);
}
/* 冲突格子：整格红色色条 + 斜纹底，避免与天色调（如周五的粉色）混淆。
   规则放在 tone-* 之后，同优先级时覆盖其背景色。 */
.course-table td[data-bar="top"].course-table__cell--conflict {
  border-top-color: var(--ct-conflict);
  background: repeating-linear-gradient(45deg, var(--ct-conflict-bg) 0 6px, var(--ct-conflict-bg-alt) 6px 12px);
}
.course-table td[data-bar="left"].course-table__cell--conflict {
  border-left-color: var(--ct-conflict);
  background: repeating-linear-gradient(45deg, var(--ct-conflict-bg) 0 6px, var(--ct-conflict-bg-alt) 6px 12px);
}
.course-table__cell.course-table__cell--conflict {
  background: repeating-linear-gradient(45deg, var(--ct-conflict-bg) 0 6px, var(--ct-conflict-bg-alt) 6px 12px);
}
.course-table__cell[data-bar="top"].course-table__cell--conflict {
  border-top-color: var(--ct-conflict);
}
.course-table__cell[data-bar="left"].course-table__cell--conflict {
  border-left-color: var(--ct-conflict);
}

/* 课程名与第二行文本允许换行：table-layout:auto 下 nowrap 的 min-content
   等于整行宽度，会把列撑宽（省略号也不会生效），多门课程同格时更明显。 */
.course-table__name {
  display: block;
  margin-bottom: 1px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.course-table__meta {
  display: block;
  font-size: 10px;
  line-height: 1.35;
  color: var(--ct-meta);
  overflow-wrap: anywhere;
}
</style>
