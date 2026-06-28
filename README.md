# @openurp/sdk-vue

OpenURP Vue business SDK.

This package is intended for reusable OpenURP frontend capabilities:

- API clients and typed business models
- Vue composables for shared state and querying
- Business selector components, such as semester, department, teacher, classroom, campus, major, class, and textbook selectors
- Small domain utilities and display helpers

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

Semester list cache keys use:

```text
openurp.cache.semesters.{projectId}
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
```
