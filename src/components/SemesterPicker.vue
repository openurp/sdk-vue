<template>
  <div ref="rootRef" class="openurp-semester-picker" :class="{ 'is-disabled': disabled, 'is-compact': compact }" :data-request-path="requestPath">
    <div
      ref="triggerRef"
      class="openurp-semester-trigger"
      :class="{ disabled }"
      role="button"
      :tabindex="disabled ? -1 : 0"
      @click="togglePanel"
      @keydown.enter.prevent="togglePanel"
      @keydown.space.prevent="togglePanel"
    >
      <span class="openurp-semester-trigger-text">{{ triggerLabel || placeholder }}</span>
      <span class="openurp-semester-trigger-actions">
        <button
          v-if="clearable && modelValue"
          class="openurp-semester-clear"
          type="button"
          aria-label="清除学期"
          @click.stop="clearSemester"
        >
          ×
        </button>
        <span v-if="loading" class="openurp-semester-loading">...</span>
        <span v-else class="openurp-semester-arrow">⌄</span>
      </span>
    </div>

    <Teleport to="body">
      <div v-if="panelVisible" ref="panelRef" class="openurp-semester-panel" :class="{ 'is-compact': compact }" :style="panelStyle">
        <div class="openurp-semester-panel-head">
          <strong>{{ selectedLabel || activeSchoolYear || '请选择学年学期' }}</strong>
        </div>

        <div v-if="error" class="openurp-semester-empty">
          <span>{{ error }}</span>
          <small v-if="requestPath">{{ requestPath }}</small>
        </div>
        <div v-else-if="loading" class="openurp-semester-empty">加载中...</div>
        <div v-else-if="yearGroups.length === 0" class="openurp-semester-empty">暂无学期</div>
        <div v-else class="openurp-semester-body">
          <section class="openurp-semester-section openurp-semester-card">
            <div class="openurp-semester-years">
              <button
                v-for="group in yearGroups"
                :key="group.schoolYear"
                type="button"
                :class="{ active: group.schoolYear === activeSchoolYear, current: group.schoolYear === currentSchoolYear }"
                @click="selectYear(group.schoolYear)"
              >
                <span>{{ group.schoolYear }}</span>
                <em v-if="group.schoolYear === currentSchoolYear">当前</em>
              </button>
            </div>
          </section>

          <section class="openurp-semester-section openurp-semester-term-section">
            <div class="openurp-semester-options">
              <button
                v-if="clearable"
                type="button"
                :class="{ active: !modelValue }"
                @click="clearSemester"
              >
                <span class="openurp-semester-name">全部学期</span>
              </button>
              <button
                v-for="semester in activeSemesters"
                :key="semester.id"
                type="button"
                :class="{ active: String(semester.id) === String(modelValue || ''), current: semester.id === currentSemester?.id }"
                @click="chooseSemester(semester)"
              >
                <span class="openurp-semester-name">{{ formatSemesterName(semester) }}</span>
                <span v-if="showRange && formatSemesterRange(semester)" class="openurp-semester-range">{{ formatSemesterRange(semester) }}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { listSemesters } from '../api'
import type { Semester } from '../types'
import { formatSemester, formatSemesterName, formatSemesterRange, resolveCurrentSemester, resolveDefaultSemester } from '../utils'

interface YearGroup {
  schoolYear: string
  semesters: Semester[]
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    projectId?: string | number
    apiBaseUrl?: string
    /** 外部已加载的学期列表；提供时直接使用，不再请求 `/api/base/semesters/{projectId}.json`。 */
    semesters?: Semester[] | null
    storageKey?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    syncDefault?: boolean
    compact?: boolean
    /** 选项下方是否显示起止日期范围 */
    showRange?: boolean
    cache?: boolean
    cacheTtl?: number
    filter?: string
    autoSelect?: boolean
    closeOnSelect?: boolean
  }>(),
  {
    storageKey: 'openurp.semester.id',
    placeholder: '请选择学年学期',
    clearable: false,
    syncDefault: true,
    compact: false,
    showRange: true,
    cache: true,
    autoSelect: true,
    closeOnSelect: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | '']
  change: [semester: Semester]
  clear: []
  loaded: [semesters: Semester[]]
  error: [error: unknown]
}>()

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const panelVisible = ref(false)
const error = ref('')
const semesters = ref<Semester[]>([])
const activeSchoolYear = ref('')
const loadedKey = ref('')
const panelStyle = ref<CSSProperties>({})
const manuallyCleared = ref(false)

const selectedSemester = computed(() => semesters.value.find((semester) => String(semester.id) === String(props.modelValue || '')) || null)
const selectedLabel = computed(() => formatSemester(selectedSemester.value))
const triggerLabel = computed(() => props.compact && selectedSemester.value ? formatCompactSemester(selectedSemester.value) : selectedLabel.value)
const currentSemester = computed(() => resolveCurrentSemester(semesters.value))
const currentSchoolYear = computed(() => currentSemester.value?.schoolYear || '')
const requestPath = computed(() => props.projectId ? `/api/base/semesters/${props.projectId}.json?filter=${props.filter ?? 'active'}` : '')

const yearGroups = computed<YearGroup[]>(() => {
  const groups = new Map<string, Semester[]>()
  semesters.value.forEach((semester) => {
    const items = groups.get(semester.schoolYear) || []
    items.push(semester)
    groups.set(semester.schoolYear, items)
  })

  return [...groups.entries()]
    .map(([schoolYear, items]) => ({
      schoolYear,
      semesters: items.sort(compareSemester),
    }))
    .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear))
})

const activeSemesters = computed(() => yearGroups.value.find((group) => group.schoolYear === activeSchoolYear.value)?.semesters || [])

watch(() => [props.projectId, props.apiBaseUrl], () => {
  void reload()
})

watch(() => props.semesters, () => {
  void reload()
})

watch(selectedSemester, (semester) => {
  if (!semester) return
  activeSchoolYear.value = semester.schoolYear
})

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutside)
  window.addEventListener('resize', updatePanelPosition)
  window.addEventListener('scroll', updatePanelPosition, true)
  applyStoredSemesterId()
  void reload()
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutside)
  window.removeEventListener('resize', updatePanelPosition)
  window.removeEventListener('scroll', updatePanelPosition, true)
})

async function togglePanel() {
  if (props.disabled) return
  panelVisible.value = !panelVisible.value
  if (panelVisible.value) {
    await nextTick()
    updatePanelPosition()
    await reload()
  }
}

function selectYear(schoolYear: string) {
  if (schoolYear) activeSchoolYear.value = schoolYear
}

function chooseSemester(semester: Semester) {
  manuallyCleared.value = false
  emit('update:modelValue', semester.id)
  emit('change', semester)
  writeStoredSemester(semester)
  activeSchoolYear.value = semester.schoolYear
  if (props.closeOnSelect) panelVisible.value = false
}

function clearSemester() {
  manuallyCleared.value = true
  emit('update:modelValue', '')
  clearStoredSemester()
  if (props.closeOnSelect) panelVisible.value = false
}

async function reload() {
  if (props.semesters) {
    loading.value = true
    error.value = ''
    semesters.value = props.semesters
    loadedKey.value = 'provided'
    emit('loaded', semesters.value)
    applyDefaultSemester()
    loading.value = false
    return
  }
  if (loadedKey.value === 'provided') loadedKey.value = ''

  if (!props.projectId) return
  const loadKey = `${props.apiBaseUrl || ''}:${props.projectId}`
  if (loadedKey.value === loadKey) return

  loading.value = true
  error.value = ''
  try {
    semesters.value = await listSemesters(props.projectId, {
      apiBaseUrl: props.apiBaseUrl,
      filter: props.filter,
      cache: props.cache,
      cacheTtl: props.cacheTtl,
    })
    loadedKey.value = loadKey
    emit('loaded', semesters.value)
    applyDefaultSemester()
  } catch (err) {
    error.value = '加载学期失败'
    emit('error', err)
  } finally {
    loading.value = false
  }
}

function applyDefaultSemester() {
  if (manuallyCleared.value && (props.modelValue === '' || props.modelValue === undefined || props.modelValue === null)) return

  if (selectedSemester.value) {
    activeSchoolYear.value = selectedSemester.value.schoolYear
    return
  }

  const defaultSemester = resolveDefaultSemester(semesters.value, readStoredSemesterId())
  if (!defaultSemester) return

  activeSchoolYear.value = defaultSemester.schoolYear
  if (props.autoSelect) {
    emit('update:modelValue', defaultSemester.id)
    emit('change', defaultSemester)
  }
}

function applyStoredSemesterId() {
  if (props.modelValue !== '' && props.modelValue !== undefined && props.modelValue !== null) return
  const storedSemesterId = readStoredSemesterId()
  if (storedSemesterId) emit('update:modelValue', storedSemesterId)
}

function readStoredSemesterId() {
  if (!props.syncDefault || !props.storageKey || typeof localStorage === 'undefined') return ''
  return localStorage.getItem(props.storageKey) || ''
}

function writeStoredSemester(semester: Semester) {
  if (!props.syncDefault || !props.storageKey || typeof localStorage === 'undefined') return
  localStorage.setItem(props.storageKey, String(semester.id))
}

function clearStoredSemester() {
  if (props.syncDefault && props.storageKey && typeof localStorage !== 'undefined') {
    localStorage.removeItem(props.storageKey)
  }
  emit('clear')
}

function closeOnOutside(event: PointerEvent) {
  const target = event.target as Node
  if (!rootRef.value?.contains(target) && !panelRef.value?.contains(target)) panelVisible.value = false
}

function updatePanelPosition() {
  const trigger = triggerRef.value
  if (!trigger || !panelVisible.value) return
  const rect = trigger.getBoundingClientRect()
  const width = Math.min(props.compact ? 300 : 420, window.innerWidth - 32)
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16)
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
}

function compareSemester(a: Semester, b: Semester) {
  const codeCompare = String(a.code || '').localeCompare(String(b.code || ''))
  if (codeCompare !== 0) return codeCompare
  return String(a.name || '').localeCompare(String(b.name || ''))
}

function formatCompactSemester(semester: Semester) {
  return `${semester.schoolYear} / ${String(semester.name).replace(/学期$/, '')}`
}
</script>

<style scoped>
.openurp-semester-picker {
  position: relative;
  width: 100%;
  min-width: 0;
  font-size: inherit;
  box-sizing: border-box;
}

.openurp-semester-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  color: var(--openurp-semester-text, #1f2937);
  background: var(--openurp-semester-bg, #fff);
  border: 1px solid var(--openurp-semester-border, #dcdfe6);
  border-radius: 3px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.openurp-semester-picker.is-compact .openurp-semester-trigger {
  height: 26px;
  padding-right: 7px;
  padding-left: 7px;
  font-size: 13px;
}

.openurp-semester-picker.is-compact .openurp-semester-trigger-actions {
  gap: 4px;
}

.openurp-semester-trigger:hover,
.openurp-semester-trigger:focus {
  border-color: var(--openurp-semester-primary, #0052d9);
  outline: none;
}

.openurp-semester-trigger.disabled {
  color: #9ca3af;
  background: #f3f4f6;
  cursor: not-allowed;
}

.openurp-semester-trigger-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.openurp-semester-arrow,
.openurp-semester-loading {
  color: #6b7280;
  flex: 0 0 auto;
}

.openurp-semester-trigger-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.openurp-semester-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #8b95a1;
  background: transparent;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

.openurp-semester-clear:hover {
  color: #4b5563;
  background: #eef2f7;
}

.openurp-semester-panel {
  z-index: 2000;
  overflow: hidden;
  color: #1f2937;
  background: #fff;
  border: 1px solid #d9e1ec;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 14%);
}

.openurp-semester-panel-head {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 12px;
  border-bottom: 1px solid #edf0f5;
}

.openurp-semester-panel.is-compact {
  font-size: 13px;
}

.openurp-semester-panel.is-compact .openurp-semester-panel-head {
  height: 30px;
  padding: 0 10px;
}

.openurp-semester-panel.is-compact .openurp-semester-body {
  grid-template-columns: minmax(0, 1.7fr) minmax(82px, 0.63fr);
}

.openurp-semester-panel.is-compact .openurp-semester-section {
  padding: 6px;
}

.openurp-semester-panel.is-compact .openurp-semester-card {
  padding-right: 7px;
}

.openurp-semester-panel.is-compact .openurp-semester-term-section {
  padding-left: 7px;
  border-left: 1px solid #edf0f5;
}

.openurp-semester-panel.is-compact .openurp-semester-years {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.openurp-semester-panel.is-compact .openurp-semester-years button {
  min-height: 28px;
  padding: 3px 5px;
}

.openurp-semester-panel.is-compact .openurp-semester-options {
  gap: 4px;
}

.openurp-semester-panel.is-compact .openurp-semester-options button {
  min-height: 34px;
  padding: 5px 7px;
}

.openurp-semester-panel-head strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-weight: 500;
}

.openurp-semester-body {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(118px, 0.9fr);
  gap: 0;
  min-height: 0;
}

.openurp-semester-section {
  padding: 8px;
}

.openurp-semester-card {
  padding-right: 9px;
}

.openurp-semester-term-section {
  padding-left: 9px;
  border-left: 1px solid #edf0f5;
}

.openurp-semester-years {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.openurp-semester-years button,
.openurp-semester-options button {
  width: 100%;
  border: 0;
  border-radius: 4px;
  font: inherit;
  cursor: pointer;
}

.openurp-semester-years button {
  display: grid;
  align-items: center;
  justify-items: center;
  min-height: 32px;
  padding: 4px 6px;
  color: #4b5563;
  background: #f7f9fc;
  border: 1px solid transparent;
}

.openurp-semester-years button:hover,
.openurp-semester-options button:hover {
  background: #eef4ff;
}

.openurp-semester-years button.active {
  color: var(--openurp-semester-primary, #0052d9);
  background: #e8f1ff;
  border-color: #c9dcff;
  font-weight: 500;
}

.openurp-semester-years em {
  color: #0f766e;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
}

.openurp-semester-options {
  display: grid;
  gap: 6px;
  align-content: start;
}

.openurp-semester-options button {
  display: grid;
  gap: 2px;
  min-height: 42px;
  padding: 7px 9px;
  color: #374151;
  background: #fff;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.openurp-semester-options button.active {
  border-color: var(--openurp-semester-primary, #0052d9);
  background: #f2f7ff;
  color: var(--openurp-semester-primary, #0052d9);
}

.openurp-semester-name {
  font-weight: 500;
}

.openurp-semester-range {
  color: #6b7280;
  font-size: 12px;
}

.openurp-semester-empty {
  display: grid;
  gap: 6px;
  padding: 24px;
  color: #6b7280;
  text-align: center;
}

.openurp-semester-empty small {
  color: #9ca3af;
  font-size: 12px;
}
</style>
