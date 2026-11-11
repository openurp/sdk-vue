# Schedule

`@openurp/sdk-vue/schedule` 是 PC 与移动端共用的**纯 TypeScript** 课表入口。
它不依赖 Vue、TDesign、路由或 CSS，业务端可以继续保留自己的 JSON:API 解析、权限与跳转逻辑。

## 适用边界

- 放在这里：教学周与日期换算、工作日/未来学期判断、日程预览日期、课表筛选、授课计划课时对齐、教学班维度汇总。
- 不放在这里：JSON:API 资源解析、请求客户端、路由跳转、页面组件与样式。
- 宽屏课表格子组件仍在 `@openurp/sdk-vue/wide`。

## 主要能力

```ts
import {
  buildSchedulePreviewDates,
  buildScheduleSessions,
  alignSchedulePlanLessons,
  matchesScheduleFilter,
  summarizeScheduleActivitiesByClazz,
} from '@openurp/sdk-vue/schedule'
```

- `buildSchedulePreviewDates()`：未来学期返回开学第一周日期，否则返回最近两个工作日。
- `matchesScheduleFilter()`：统一「今日 / 本周 / 下周 / 全部」筛选；
- `buildScheduleSessions()`：从课表活动展开去重后的上课日期，并换算教学周次；
- `alignSchedulePlanLessons()`：按授课计划 `lesson.idx` 对齐课表 Session，缺失时回退到次序；
- `summarizeScheduleActivitiesByClazz()`：汇总首次课日期、周次、教室与活动数量，供课程列表使用。
