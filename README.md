# @openurp/sdk-vue

OpenURP Vue business SDK.

This package is intended for reusable OpenURP frontend capabilities:

- API clients and typed business models
- Vue composables for shared state and querying
- Business selector components: `AppShell`, `SemesterPicker`, `StudentPicker`, `CodePicker`
- Small domain utilities and display helpers

## Install & styles

```bash
npm install @openurp/sdk-vue
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

## Layout

```text
src/
  api/
  cache/
  components/
  composables/
  types/
  utils/
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
```

规则：新增只适合宽屏的组件时，放在 `src/wide.ts` 导出（对应子路径
`@openurp/sdk-vue/wide`），**不要**加入主入口 `src/index.ts` / `src/components/index.ts`。

## Docs

- [`docs/teaching-week.md`](docs/teaching-week.md) — weekstate 位序约定与教学周次换算（反转后第 0 位 = 相对 startOn 的第 0 周）

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
npm run typecheck
npm run build
npm test
```
