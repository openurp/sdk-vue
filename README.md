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
```

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
