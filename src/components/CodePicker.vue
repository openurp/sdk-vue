<template>
  <select
    class="openurp-code-picker"
    :class="{ 'is-compact': compact }"
    :name="name"
    :value="modelValue ?? ''"
    :disabled="disabled || loading"
    @change="onChange"
  >
    <option v-if="clearable" value="">{{ placeholder }}</option>
    <option v-else-if="!modelValue" value="" disabled>{{ loading ? '加载中...' : placeholder }}</option>
    <option v-for="item in items" :key="item.id" :value="item.id">
      {{ item.shortName || item.name }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { listCodeItems } from '../api'
import type { CodeItem } from '../types'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    projectId?: string | number
    code: string
    name?: string
    apiBaseUrl?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    compact?: boolean
    cache?: boolean
    cacheTtl?: number
  }>(),
  {
    placeholder: '请选择',
    clearable: false,
    compact: false,
    cache: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | '']
  change: [item: CodeItem | null]
  loaded: [items: CodeItem[]]
  error: [error: unknown]
}>()

const items = ref<CodeItem[]>([])
const loading = ref(false)

watch(() => [props.projectId, props.code], () => {
  void reload()
})

onMounted(() => {
  void reload()
})

async function reload() {
  if (!props.projectId || !props.code) return
  loading.value = true
  try {
    items.value = await listCodeItems(props.projectId, props.code, {
      apiBaseUrl: props.apiBaseUrl,
      cache: props.cache,
      cacheTtl: props.cacheTtl,
    })
    emit('loaded', items.value)
  } catch (error) {
    emit('error', error)
  } finally {
    loading.value = false
  }
}

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const item = items.value.find((option) => String(option.id) === value) || null
  emit('update:modelValue', value)
  emit('change', item)
}
</script>

<style scoped>
.openurp-code-picker {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 28px 0 9px;
  color: var(--openurp-code-picker-color, var(--td-text-color-primary, #1f2937));
  background: var(--openurp-code-picker-bg, var(--td-bg-color-component, #fff));
  border: 1px solid var(--openurp-code-picker-border, var(--td-border-level-1-color, #dcdfe6));
  border-radius: 3px;
  box-sizing: border-box;
  font: inherit;
}

.openurp-code-picker:focus {
  border-color: var(--openurp-code-picker-focus, var(--td-brand-color, #0052d9));
  outline: none;
}

.openurp-code-picker:disabled {
  color: var(--td-text-color-disabled, #9ca3af);
  background: var(--td-bg-color-component-disabled, #f3f4f6);
  cursor: not-allowed;
}

.openurp-code-picker.is-compact {
  height: 28px;
  padding-left: 7px;
}
</style>
