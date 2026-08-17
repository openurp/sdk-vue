export { default as AppShell } from './AppShell.vue'
export type { AppShellMenuItem, AppShellProfile } from './app-shell'
export { default as AppShellFullscreenToggle } from './AppShellFullscreenToggle.vue'
export { default as AppShellLocaleToggle } from './AppShellLocaleToggle.vue'
export { default as AppShellThemeToggle } from './AppShellThemeToggle.vue'
export { default as CodePicker } from './CodePicker.vue'
export { default as SemesterPicker } from './SemesterPicker.vue'
export { default as StudentPicker } from './StudentPicker.vue'
// 宽屏/桌面端组件（CourseTable 等）请走独立入口 '@openurp/sdk-vue/wide'，勿加在主入口，
// 以隔离移动端误用。详见 src/wide.ts 注释。
