/**
 * 主入口。
 *
 * 应用接入层（登录态与 token、权限、运行时配置、请求客户端、微前端生命周期、
 * 门户 UI 同步、契约常量）的唯一实现在 `@beangle/ems-app`，这里原样再导出，
 * 既有消费端的 `import { ... } from '@openurp/sdk-vue'` 无需改动。
 *
 * 依赖解析：本包按 `exports` 解析到 ems-app 的 `dist`，
 * 因此改完 ems-app 要先构建它（`pnpm --filter @beangle/ems-app build`）。
 */
export * from '@beangle/ems-app'
// PC 独立部署壳（AppShell + 语言/主题/全屏开关）；移动端请勿引用（会带上 tdesign）
export * from '@beangle/ems-app/pc'

// 保证 AppShell 样式进入 dist/index.css；同时保留兼容子路径
// `@openurp/sdk-vue/styles/app-shell.css`（过渡期副本，见该文件头部说明）
import './styles/app-shell.css'

export * from './api'
export * from './cache'
export * from './components'
export * from './composables'
export * from './types'
export * from './utils'
export * from './kiosk'
