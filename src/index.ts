/**
 * 主入口。
 *
 * 应用接入层（登录态与 token、权限、运行时配置、请求客户端、微前端生命周期、
 * 门户 UI 同步、契约常量）的唯一实现在 `@beangle/ems-app`，这里原样再导出，
 * 既有消费端的 `import { ... } from '@openurp/sdk-vue'` 无需改动。
 *
 * 依赖解析：ems-app 是正式 dependencies（当前 `^0.0.3`），不打包进本包，
 * 消费端由包管理器解析到同一份实例；本地联调请消费 registry 上的开发预览版
 * （`X.Y.Z-dev.<UTC 时间戳>`），不要在 package.json 里写 `link:`。
 */
export * from '@beangle/ems-app'
// PC 独立部署壳（AppShell + 语言/主题/全屏开关）；移动端请勿引用（会带上 tdesign）
export * from '@beangle/ems-app/pc'

// 保证 AppShell / MicroShell 样式进入 dist/index.css：
// 组件样式的正式出处是 @beangle/ems-app 的 dist/index.css，这里把 CSS 打进本包，
// 消费端只引 @openurp/sdk-vue/dist/index.css 即可（JS 侧 ems-app 仍为外部依赖）。
import '@beangle/ems-app/dist/index.css'
// AppShell 的侧栏菜单由 @beangle/bui-vue 的 SideNav 渲染，样式同样单独引出：
// 打进本包 CSS，消费端只引 @openurp/sdk-vue/dist/index.css 即可。
import '@beangle/bui-vue/styles/side-nav.css'
// 保留兼容子路径 `@openurp/sdk-vue/styles/app-shell.css`（过渡期副本，见该文件头部说明）
import './styles/app-shell.css'

export * from './api'
export * from './cache'
export * from './components'
export * from './composables'
export * from './types'
export * from './utils'
export * from './kiosk'
