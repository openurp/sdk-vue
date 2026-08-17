/**
 * 宽屏/桌面端专用组件入口。
 *
 * 这里的组件只适合宽屏（大表格、多列布局），**移动端请勿使用**：
 * 移动端仅从包主入口 `@openurp/sdk-vue` 导入通用组件（SemesterPicker、CodePicker 等），
 * 不会看到本入口的组件，从 API 层面避免误用。
 *
 * 规则：新增只适合宽屏的组件时，放这里并同步在本文件导出；不要加入主入口。
 */
export { default as CourseTable } from './components/CourseTable.vue'
export type { CourseTableCourse, CourseTableDay, CourseTableScheduleSource } from './components/courseTable'
export { buildCourseTableCourses } from './components/courseTable'
