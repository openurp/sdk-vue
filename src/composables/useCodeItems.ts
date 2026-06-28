import { onMounted, ref, watch } from 'vue'
import { listCodeItems, type CodeApiOptions } from '../api'
import type { CodeItem } from '../types'

export function useCodeItems(projectId: () => string | number | undefined, code: () => string | undefined, options: CodeApiOptions = {}) {
  const items = ref<CodeItem[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function reload() {
    const currentProjectId = projectId()
    const currentCode = code()
    if (!currentProjectId || !currentCode) return

    loading.value = true
    error.value = null
    try {
      items.value = await listCodeItems(currentProjectId, currentCode, options)
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  watch([projectId, code], () => {
    void reload()
  })
  onMounted(() => {
    void reload()
  })

  return {
    items,
    loading,
    error,
    reload,
  }
}
