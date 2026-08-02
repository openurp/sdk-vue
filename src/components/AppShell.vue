<template>
  <div class="bui-app-shell">
    <aside class="bui-app-shell__aside">
      <a class="bui-app-shell__brand" :href="portalHref || undefined" @click="onBrandClick">
        <img
          v-if="logoUrl"
          class="bui-app-shell__brand-logo"
          :src="logoUrl"
          alt=""
        />
        <span v-else-if="brandMark" class="bui-app-shell__brand-mark">{{ brandMark }}</span>
        <span class="bui-app-shell__brand-text">
          <span class="bui-app-shell__brand-name">{{ title }}</span>
          <span v-if="subtitle" class="bui-app-shell__brand-sub">{{ subtitle }}</span>
        </span>
      </a>
      <div class="bui-app-shell__sidebar">
        <div v-if="navSection" class="bui-app-shell__nav-section">{{ navSection }}</div>
        <nav class="bui-app-shell__nav">
          <a
            v-for="item in menus"
            :key="item.path"
            class="bui-app-shell__nav-item"
            :class="{ 'is-active': item.path === resolvedActivePath }"
            :href="item.path"
            @click.prevent="onNavigate(item.path)"
          >
            <span v-if="item.icon" class="bui-app-shell__nav-icon">
              <component :is="item.icon" />
            </span>
            <span class="bui-app-shell__nav-label">{{ item.title }}</span>
          </a>
        </nav>
      </div>
    </aside>

    <div class="bui-app-shell__right">
      <header class="bui-app-shell__header">
        <nav v-if="portalHref || $slots['module-nav']" class="bui-app-shell__module-nav">
          <slot name="module-nav">
            <a v-if="portalHref" :href="portalHref">{{ portalLabel }}</a>
          </slot>
        </nav>
        <div class="bui-app-shell__actions">
          <span
            v-if="currentProfile && profiles.length === 1"
            class="bui-app-shell__profile"
            title="当前业务场景"
          >{{ currentProfile.name }}</span>
          <t-dropdown
            v-else-if="currentProfile && profiles.length > 1"
            trigger="click"
            :options="profileMenuOptions"
            :popup-props="{ attach: 'body', overlayClassName: 'bui-app-shell-profile-popup', zIndex: 5000 }"
            @click="onProfileCommand"
          >
            <button
              type="button"
              class="bui-app-shell__profile bui-app-shell__profile--switch"
              title="当前业务场景"
            >
              <span class="bui-app-shell__profile-name">{{ currentProfile.name }}</span>
              <span class="bui-app-shell__profile-caret" aria-hidden="true" />
            </button>
          </t-dropdown>
          <slot name="topbar-extra" />
          <t-dropdown
            v-if="userName || $slots.user"
            trigger="click"
            :options="userMenuOptions"
            :popup-props="{ attach: 'body', overlayClassName: 'bui-app-shell-user-popup', zIndex: 5000 }"
            @click="onUserCommand"
          >
            <slot name="user">
              <button type="button" class="bui-app-shell__user" :title="userName">
                <span class="bui-app-shell__user-avatar">{{ userInitial }}</span>
                <span class="bui-app-shell__user-name">{{ userName }}</span>
              </button>
            </slot>
          </t-dropdown>
        </div>
      </header>

      <main class="bui-app-shell__main">
        <div class="bui-app-shell__content">
          <slot name="context" />
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AppShellMenuItem, AppShellProfile } from './app-shell'
import '../styles/app-shell.css'

const props = withDefaults(
  defineProps<{
    title: string
    brandMark?: string
    logoUrl?: string
    subtitle?: string
    menus: AppShellMenuItem[]
    activePath?: string
    userName?: string
    portalHref?: string
    portalLabel?: string
    navSection?: string
    logoutLabel?: string
    profiles?: AppShellProfile[]
    profileId?: string | number
  }>(),
  {
    brandMark: '',
    logoUrl: '',
    subtitle: '',
    activePath: undefined,
    userName: '',
    portalHref: '',
    portalLabel: 'Portal',
    navSection: '',
    logoutLabel: 'Logout',
    profiles: () => [],
    profileId: undefined,
  },
)

const emit = defineEmits<{
  logout: []
  navigate: [path: string]
  'profile-change': [id: string | number]
}>()

const route = useRoute()
const router = useRouter()

const resolvedActivePath = computed(() => {
  if (props.activePath) return props.activePath
  return route.path || '/'
})

const userInitial = computed(() => {
  const name = props.userName?.trim()
  return name ? name.slice(0, 1) : '?'
})

const currentProfile = computed(() => {
  const list = props.profiles
  if (!list.length) return null
  const pid = props.profileId != null ? String(props.profileId) : ''
  if (pid) {
    const matched = list.find((p) => String(p.id) === pid)
    if (matched) return matched
  }
  return list[0]
})

const profileMenuOptions = computed(() =>
  props.profiles
    .filter((p) => String(p.id) !== String(currentProfile.value?.id))
    .map((p) => ({
      content: p.name,
      value: String(p.id),
    })),
)

function onNavigate(path: string) {
  emit('navigate', path)
  if (route.path !== path) void router.push(path)
}

function onBrandClick(event: MouseEvent) {
  if (!props.portalHref) {
    event.preventDefault()
    onNavigate(props.menus[0]?.path || '/')
  }
}

const userMenuOptions = computed(() => [
  {
    content: props.logoutLabel,
    value: 'logout',
    onClick: () => emit('logout'),
  },
])

function dropdownValue(dropdownItem: { value?: unknown } | string): unknown {
  return typeof dropdownItem === 'string'
    ? dropdownItem
    : dropdownItem && typeof dropdownItem === 'object'
      ? dropdownItem.value
      : undefined
}

function onUserCommand(dropdownItem: { value?: unknown } | string) {
  if (dropdownValue(dropdownItem) === 'logout') emit('logout')
}

function onProfileCommand(dropdownItem: { value?: unknown } | string) {
  const value = dropdownValue(dropdownItem)
  if (value == null || value === '') return
  emit('profile-change', value as string | number)
}
</script>
