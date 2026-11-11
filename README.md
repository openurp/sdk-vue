# @openurp/sdk-vue

OpenURP Vue business SDK.

This package is intended for reusable OpenURP frontend capabilities:

- API clients and typed business models
- Vue composables for shared state and querying
- Business selector components: `SemesterPicker`, `StudentPicker`, `CodePicker`（宽屏的 `CourseTable` 见 `@openurp/sdk-vue/wide`）
- Small domain utilities and display helpers
- 壳层与应用接入层（`AppShell`、`MicroShell`、登录态与 token、权限、请求客户端、微前端、门户 UI 同步）
  由 `@beangle/ems-app` 提供，本包再导出（见下文「应用接入层」）

## Install & styles

```bash
pnpm add @openurp/sdk-vue
```

Components ship with their styles in `dist/index.css`. Consumers must import it once
(e.g. in the app entry):

```ts
import '@openurp/sdk-vue/dist/index.css'
```

The AppShell standalone chrome styles are also exported separately:

```ts
import '@openurp/sdk-vue/styles/app-shell.css'
```

## Micro frontend shell

子应用在 EMS 门户（Wujie）里用 `MicroShell` 作为根容器，挂载时机由 `registerWujieApp` 负责：

```vue
<script setup lang="ts">
import { isWujieMicroApp, MicroShell } from '@openurp/sdk-vue'

const isWujie = isWujieMicroApp()
</script>
```

本地调试时给地址带上 `?micro=1` 即可走微前端壳层、直接看页面内容，无需门户：

```text
http://localhost:5173/edu/learning/courses?micro=1
```

该标记在模块加载时快照，因此应用初始化用 `history.replaceState` 清理一次性参数也不会丢失。
壳层外边距可用 `--microshell-padding`（默认 `8px`）覆盖。

## Layout

```text
src/
  api/
  cache/
  components/
  composables/
  types/
  utils/
  schedule.ts    # 纯 TypeScript 课表逻辑入口（PC / 移动端共用，无 Vue/TDesign 依赖）
  wide.ts        # 宽屏/桌面端专用组件入口
```

## Platform separation（平台隔离）

本包被移动端与 PC 端共用。**只适合宽屏的组件（大表格、多列布局）一律走独立入口
`@openurp/sdk-vue/wide`，不进主入口**，从 API 层面避免移动端误用：

```ts
// PC/宽屏端：显式从 wide 入口导入
import { CourseTable } from '@openurp/sdk-vue/wide'
// 移动端：主入口里没有这些组件，import 不到即不会误用
import { SemesterPicker } from '@openurp/sdk-vue'
// PC 与移动端共用课表计算：纯 TS 子入口，不会带入 Vue/TDesign/路由
import { buildScheduleSessions } from '@openurp/sdk-vue/schedule'
```

规则：新增只适合宽屏的组件时，放在 `src/wide.ts` 导出（对应子路径
`@openurp/sdk-vue/wide`），**不要**加入主入口 `src/index.ts` / `src/components/index.ts`。

## 应用接入层（`@beangle/ems-app`）

平台相关能力（登录态与 token、权限、运行时配置、请求客户端、微前端生命周期、门户 UI 同步、
契约常量、`MicroShell` / `AppShell`）的**唯一实现**在
[`@beangle/ems-app`](https://github.com/beangle/ems/tree/master/packages/ems-app)
（`beangle/ems` 仓库的 `packages/ems-app`）。本包不再保留副本，只做**再导出**：

| 位置 | 内容 |
|---|---|
| `src/index.ts` | `export * from '@beangle/ems-app'` + `'@beangle/ems-app/pc'`，并引入壳层样式 |
| `src/api/{code,semester,student,context}.ts` | 直接从 `@beangle/ems-app` 取 `EmsApiClient` / `EmsApiError` |
| `src/kiosk.ts` | 再导出扫码登录 API 与 `useQrLogin`，保持 `@openurp/sdk-vue/kiosk` 可用 |

因此既有消费端的 `import { ... } from '@openurp/sdk-vue'` 不用改。开发时注意两点：

1. `dependencies` 里是 registry 上的版本号（当前 `^0.0.3`），**不写 `link:`**——
   要联调 ems-app 的改动，先在上游发开发预览版（`beangle/ems/packages/ems-app` 下
   `pnpm release:dev`），再 `pnpm install`；
2. 本包按 `exports` 解析到 ems-app 的 `dist`，拿不到新版本时 typecheck / build / test
   会继续用旧产物，注意确认 `pnpm why @beangle/ems-app` 的版本；
3. 本包与 ems-app 的产物都按 **bundler** 解析（ems-app 的 `dist/pc.js` 用
   `tdesign-vue-next/es/dropdown` 这类目录导入，tdesign 的 es 模块还带 `style/css.mjs`）。
   vitest / SSR / node 脚本等 Node 原生 ESM 环境必须把它们放进 inline 名单，
   否则报 `Directory import ... is not supported`：

```ts
// vitest.config.ts
test: {
  server: {
    deps: {
      inline: ['@openurp/sdk-vue', '@beangle/ems-app', 'tdesign-vue-next'],
    },
  },
}
```

`@openurp/sdk-vue/styles/app-shell.css` 是过渡期副本（正式出处见 ems-app），
消费端迁移到 `@beangle/ems-app` 后，上述再导出与副本都可以删除。
`scripts/release-prepare.sh` / `release-dev.sh` 会拦截 dependencies 里残留的 `link:` / `file:`。

## Docs

- [`docs/teaching-week.md`](docs/teaching-week.md) — weekstate 位序约定与教学周次换算（反转后第 0 位 = 相对 startOn 的第 0 周）
- [`docs/course-table.md`](docs/course-table.md) — CourseTable 的格子模型、同格多课程与冲突标记
- [`docs/schedule.md`](docs/schedule.md) — 课表日期、筛选、预览与授课计划对齐

## Code Picker

```vue
<CodePicker
  v-model="reasonId"
  :project-id="projectId"
  code="exam-defer-reasons"
/>
```

The code API uses:

```text
/api/base/code/{projectId}/{code}.json
```

Code list cache keys use the project-sensitive form:

```text
openurp.cache.dict.{code}.{projectId}
```

Semester list cache keys use (project + filter, default filter `active`):

```text
openurp.cache.semesters.{projectId}.{filter}
```

Context APIs:

```text
/api/base/context/projects.json
/api/base/context/departments.json
```

Context keys:

```text
openurp.project.id
openurp.cache.context.projects
openurp.cache.context.departments.{projectId}
```

## Scripts

```bash
pnpm typecheck
pnpm build
pnpm test
```
