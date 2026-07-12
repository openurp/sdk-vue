<template>
  <t-select
    class="openurp-student-picker"
    :class="{ 'is-compact': compact }"
    :model-value="modelValue ?? ''"
    :name="name"
    :disabled="disabled"
    :clearable="clearable"
    :filterable="true"
    :reserve-keyword="false"
    :loading="loading"
    :loading-text="loadingText"
    :empty="emptyContent"
    :placeholder="placeholder"
    :options="options"
    :size="compact ? 'small' : 'medium'"
    :popup-props="{ overlayClassName: 'openurp-student-picker-popup' }"
    :value-display="valueDisplay"
    @search="onSearch"
    @change="onChange"
    @clear="clear"
  />
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import TSelect from 'tdesign-vue-next/es/select'
import type { SelectOption, SelectValue } from 'tdesign-vue-next/es/select/type'
import { searchStudents } from '../api'
import type { Student } from '../types'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    projectId?: string | number
    name?: string
    apiBaseUrl?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    compact?: boolean
    minLength?: number
    loadingText?: string
    emptyText?: string
    autoSelectSingle?: boolean
    debounce?: number
  }>(),
  {
    placeholder: '请输入学号或姓名',
    clearable: true,
    compact: false,
    minLength: 1,
    loadingText: '查找中...',
    emptyText: '未查询到学生',
    autoSelectSingle: false,
    debounce: 300,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | '']
  change: [student: Student | null]
  loaded: [students: Student[]]
  error: [error: unknown]
  clear: []
}>()

type StudentOption = SelectOption & { student: Student }

const loading = ref(false)
const searched = ref(false)
const students = ref<Student[]>([])
const selectedStudent = ref<Student | null>(null)
const error = ref('')
const searchSeq = ref(0)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const options = computed<StudentOption[]>(() => students.value.map((student) => ({
  label: student.description || [student.code, student.name].filter(Boolean).join(' '),
  value: student.id,
  title: student.description,
  student,
})))

const emptyContent = computed(() => {
  if (error.value) return error.value
  if (!searched.value) return '请输入学号或姓名'
  return props.emptyText
})

function valueDisplay() {
  const student = selectedStudent.value
  if (!student) return ''
  return h('span', { class: 'openurp-student-picker-value' }, student.description || [student.code, student.name].filter(Boolean).join(' '))
}

function onSearch(keyword: string) {
  clearSearchTimer()
  searchTimer = setTimeout(() => {
    void doSearch(keyword)
  }, props.debounce)
}

async function doSearch(keyword: string) {
  const query = keyword.trim()
  clearSearchTimer()
  if (!query || query.length < props.minLength) {
    searched.value = false
    students.value = []
    error.value = ''
    return
  }
  if (!props.projectId) {
    searched.value = true
    students.value = []
    error.value = '未找到当前项目'
    return
  }

  const seq = searchSeq.value + 1
  searchSeq.value = seq
  loading.value = true
  searched.value = true
  error.value = ''
  try {
    const result = await searchStudents(props.projectId, query, {
      apiBaseUrl: props.apiBaseUrl,
    })
    if (seq !== searchSeq.value) return
    students.value = result
    emit('loaded', result)
    if (props.autoSelectSingle && result.length === 1) choose(result[0])
  } catch (err) {
    if (seq !== searchSeq.value) return
    students.value = []
    error.value = err instanceof Error ? err.message : '查询学生失败'
    emit('error', err)
  } finally {
    if (seq === searchSeq.value) loading.value = false
  }
}

function onChange(value: SelectValue, context: { option?: SelectOption }) {
  if (value === undefined || value === null || value === '') {
    clear()
    return
  }
  const optionStudent = (context.option as StudentOption | undefined)?.student
  const student = optionStudent || students.value.find((item) => String(item.id) === String(value)) || null
  if (student) choose(student)
}

function choose(student: Student) {
  selectedStudent.value = student
  emit('update:modelValue', student.id)
  emit('change', student)
}

function clear() {
  clearSearchTimer()
  searched.value = false
  students.value = []
  selectedStudent.value = null
  error.value = ''
  emit('update:modelValue', '')
  emit('change', null)
  emit('clear')
}

function clearSearchTimer() {
  if (!searchTimer) return
  clearTimeout(searchTimer)
  searchTimer = null
}
</script>

<style scoped>
.openurp-student-picker {
  width: 100%;
}
</style>

<style>
.openurp-student-picker-popup .t-select-option {
  min-height: 30px;
}

.openurp-student-picker-value {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
