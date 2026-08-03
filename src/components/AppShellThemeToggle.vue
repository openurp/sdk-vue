<template>
  <button
    type="button"
    class="bui-app-shell__theme-toggle"
    :aria-label="mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
    :title="mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
    @click="onToggle"
  >
    <span aria-hidden="true">{{ mode === 'dark' ? '暗' : '明' }}</span>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  mode?: 'light' | 'dark'
}>()

const emit = defineEmits<{
  'update:theme-mode': [mode: 'light' | 'dark']
}>()

function onToggle() {
  const next = props.mode === 'dark' ? 'light' : 'dark'
  emit('update:theme-mode', next)
}
</script>
