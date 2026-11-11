# CourseTable 单元格模型与冲突标记

> 涉及文件：`src/components/CourseTable.vue`、`src/components/courseTable.ts`、`src/utils/teachingWeek.ts`。

## 数据流

```
业务课表条目（CourseSchedule 等）
  → buildCourseTableCourses()   # 同课程同日同起始节次的安排合并成“课程块”
  → groupCourseTableCells()     # 同一天节次区间重叠的课程块聚合成“格子”
  → <CourseTable :courses>      # 按格子排布
```

调用方只需要提供 `courses`（`CourseTableCourse[]`，含 `dayOfWeek` / `startSection` / `endSection`），
组件内部完成上述聚合，**无需自己处理同格课程**。

```vue
<script setup lang="ts">
import { buildCourseTableCourses, CourseTable } from '@openurp/sdk-vue/wide'

const courses = buildCourseTableCourses(schedules) // schedules：业务课表条目
</script>

<template>
  <CourseTable :courses="courses" :transposed="true" @course-click="openDetail" />
</template>
```

## 为什么需要格子

同一时段可能存在多门课程：有的是不同周次分批上课（`1-9 周` + `10-18 周`），
有的确实是时间冲突。网格一行/一列只能放一个块，若按“先到先得”放置，
后一门课程会整块丢失；因此先把节次区间重叠的课程聚成一格再去排布，
格子之间保证互不重叠：

- 区间重叠（含部分重叠）→ 合并为一格，节次范围取并集；
- 首尾相接（`1-2 节` 与 `3-4 节`）或不相邻 → 各自成格；
- 同一格子的课程按首次上课周次排序（周次未知排最后）。

## 冲突判定

`hasCourseConflict(courses)` 的默认规则：

| 情形 | 是否标记冲突 |
| --- | --- |
| 两门课程周次有交集 | 冲突 |
| 一方周次无法识别（周次待定/未提供） | 冲突（无法排除） |
| 周次不重叠 | 不冲突 |
| 整格都取不到周次 | 不标记（调用方未提供周次数据，组件不臆测） |

周次取值优先用 `course.weekNumbers`，缺省回退解析 `arrangements[].weeks` 文本
（`parseTeachingWeeks`，支持 `1-9周`、`1-12,14-15周`、`1-5单周`、`第1-16周(单)` 等写法）。

需要自定义时传 `:conflict="(courses) => boolean"`（返回 `false` 即完全关闭标记）。

## 展示与样式

- 默认插槽按格子逐条渲染 `课程名（crn）` 与 `教师 | 周次、地点`，条目之间虚线分隔；
  每门课程可单独点击（`course-click` 携带被点击的课程）。
- 插槽参数：`course`（格内首门课程，向后兼容）、`courses`（整格课程）、`conflict`、`day`、
  `startSection` / `endSection`（整格范围）、`tone`。
- 冲突格子带 `course-table__cell--conflict` 类：红色色条 + 斜纹底，
  避免与天色调（如周五的粉色 `tone-4`）混淆。不使用文字标签挤压格子空间，
  改为在格子（`.course-table__cell`）上给 `title` 悬停说明；
  调用方自定义插槽时可读 `conflict` 自行表达。
- 可覆盖的主题变量：`--ct-min-width`、`--ct-conflict`、`--ct-conflict-bg`、`--ct-conflict-bg-alt`、`--ct-divider`。
  `--ct-min-width` 默认 `100%`，窄容器下通过换行自适应；需要固定最小宽度并允许横向滚动时，
  可显式设为 `860px` 等值。
- 课程名与第二行文本默认允许换行（`overflow-wrap: anywhere`）：`table-layout: auto` 下
  `nowrap` 的 min-content 等于整行宽度，会把列撑宽且省略号不会生效。

## 变更记录

- 本版（0.0.3 之后）：支持同格多课程并列展示与冲突标记（此前同格中未排上的课程会被丢弃）；
  `course-click` 的 info 增加 `courses` / `conflict` 字段；`CourseTableCourse` 增加 `weekNumbers`，
  同时新增 `parseTeachingWeeks`。以上均为增量变更，旧用法（只读 `course`）不受影响。
- 冲突默认不再渲染 `冲突` 文字标签（改为纯颜色 + `title` 悬停），
  原先依赖 `.course-table__conflict-tag` 的选择器需改用 `.course-table__cell--conflict`。
