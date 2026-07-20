<template>
  <Teleport to="body">
    <transition name="user-menu-dropdown-pop">
      <div
        v-if="open"
        ref="floatingRoot"
        class="user-menu-dropdown"
        :style="floatingStyle"
        role="menu"
        aria-label="用户菜单"
      >
        <div class="user-menu-dropdown__header">
          <div class="user-menu-dropdown__avatar" aria-hidden="true">
            <img src="/assets/img/home/Group-avtor.svg" alt="" width="44" height="44" />
          </div>
          <div class="user-menu-dropdown__meta">
            <span class="user-menu-dropdown__name" :title="menuCardUserTitle">{{ menuCardUserName }}</span>
            <span v-if="menuCardUserSub" class="user-menu-dropdown__sub">{{ menuCardUserSub }}</span>
          </div>
        </div>
        <div class="user-menu-dropdown__list">
          <button type="button" class="user-menu-dropdown__item" role="menuitem" @click="emit('faq')">
            <QuestionCircleOutlined />
            <span>常见问题</span>
          </button>
          <button type="button" class="user-menu-dropdown__item" role="menuitem" @click="emit('billing')">
            <DollarCircleOutlined />
            <span>计费说明</span>
          </button>
          <button type="button" class="user-menu-dropdown__item" role="menuitem" @click="emit('about')">
            <InfoCircleOutlined />
            <span>关于我们</span>
          </button>
          <button type="button" class="user-menu-dropdown__item user-menu-dropdown__item--danger" role="menuitem" @click="emit('logout')">
            <LogoutOutlined />
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  QuestionCircleOutlined,
  DollarCircleOutlined,
  InfoCircleOutlined,
  LogoutOutlined
} from '@ant-design/icons-vue'

withDefaults(
  defineProps<{
    open: boolean
    /** fixed 定位，由父级根据触发按钮计算 */
    floatingStyle?: Record<string, string>
  }>(),
  {
    floatingStyle: () => ({})
  }
)

const emit = defineEmits<{
  faq: []
  billing: []
  about: []
  logout: []
}>()

const userStore = useUserStore()

const menuCardUserName = computed(() => {
  const u = userStore.user
  const name = u?.username?.trim()
  if (name) return name
  if (u?.email?.trim()) return u.email.trim()
  if (u?.id) return `ID${u.id}`
  return '用户'
})

const menuCardUserSub = computed(() => {
  const u = userStore.user
  if (!u?.id) return ''
  if (u.username?.trim()) return `ID${u.id}`
  return ''
})

const menuCardUserTitle = computed(() => {
  const u = userStore.user
  if (!u) return ''
  const parts = [u.username, u.id ? `ID${u.id}` : '', u.email].filter(Boolean) as string[]
  return parts.join(' · ')
})

const floatingRoot = ref<HTMLElement | null>(null)

defineExpose({
  floatingRoot
})
</script>

<style scoped>
.user-menu-dropdown {
  position: fixed;
  width: 260px;
  padding: 0;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(17, 22, 33, 1);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  transform: translateY(-100%);
  z-index: 1000;
}

.user-menu-dropdown__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px 12px;
}

.user-menu-dropdown__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(14, 89, 250, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-menu-dropdown__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.user-menu-dropdown__meta {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-menu-dropdown__name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-dropdown__sub {
  font-size: 12px;
  color: #8e97a5;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-dropdown__list {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-menu-dropdown__item {
  width: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  padding: 8px 10px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.user-menu-dropdown__item :deep(.anticon) {
  font-size: 16px;
  color: #8e97a5;
  flex-shrink: 0;
  transition: color 0.18s ease;
}

.user-menu-dropdown__item:hover {
  background: rgba(32, 36, 52, 1);
}

.user-menu-dropdown__item:hover :deep(.anticon) {
  color: rgba(255, 255, 255, 0.88);
}

.user-menu-dropdown__item--danger {
  color: #ffc9c9;
}

.user-menu-dropdown__item--danger :deep(.anticon) {
  color: rgba(255, 180, 180, 0.85);
}

.user-menu-dropdown__item--danger:hover {
  background: rgba(32, 36, 52, 1);
  color: #ffe0e0;
}

.user-menu-dropdown__item--danger:hover :deep(.anticon) {
  color: #ffb4b4;
}

.user-menu-dropdown-pop-enter-active,
.user-menu-dropdown-pop-leave-active {
  transition: all 0.2s ease;
}

.user-menu-dropdown-pop-enter-from,
.user-menu-dropdown-pop-leave-to {
  opacity: 0;
  transform: translateY(-100%) translateX(-14px) scale(0.98);
}
</style>
