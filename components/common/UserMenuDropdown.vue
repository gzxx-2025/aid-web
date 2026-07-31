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
            <img :src="userAvatarUrl" alt="" width="44" height="44" />
          </div>
          <div class="user-menu-dropdown__meta">
            <span class="user-menu-dropdown__name" :title="menuCardUserTitle">{{
              menuCardUserName
            }}</span>
            <span v-if="menuCardUserSub" class="user-menu-dropdown__sub">{{
              menuCardUserSub
            }}</span>
          </div>
        </div>
        <div v-if="showWechatNotifyRow" class="user-menu-dropdown__wechat-notify">
          <a-tooltip
            :title="wechatNotifySwitchDisabled ? '请先绑定微信' : ''"
            placement="top"
          >
            <div
              class="user-menu-dropdown__wechat-notify-row"
              :class="{ 'is-disabled': wechatNotifySwitchDisabled }"
            >
              <span class="user-menu-dropdown__wechat-notify-label">开启微信推送</span>
              <a-switch
                :checked="wechatNotifyChecked"
                :disabled="wechatNotifySwitchDisabled || notifyToggling"
                :loading="notifyToggling"
                class="user-menu-dropdown__switch"
                @change="onWechatNotifyChange"
                @click.stop
              />
            </div>
          </a-tooltip>
        </div>
        <div class="user-menu-dropdown__list">
          <!-- payment.alipay/wxpay 皆关时隐藏充值入口（/auth/public-config） -->
          <button
            v-if="anyPaymentEnabled"
            type="button"
            class="user-menu-dropdown__item"
            role="menuitem"
            @click="emit('recharge')"
          >
            <WalletOutlined />
            <span>积分充值</span>
          </button>
          <button
            v-if="invitePromotionEnabled"
            type="button"
            class="user-menu-dropdown__item"
            role="menuitem"
            @click="emit('invite')"
          >
            <GiftOutlined />
            <span>邀请有礼</span>
          </button>
          <button
            type="button"
            class="user-menu-dropdown__item"
            role="menuitem"
            @click="emit('faq')"
          >
            <QuestionCircleOutlined />
            <span>常见问题</span>
          </button>
          <button
            type="button"
            class="user-menu-dropdown__item"
            role="menuitem"
            @click="emit('billing')"
          >
            <DollarCircleOutlined />
            <span>计费说明</span>
          </button>
          <button
            type="button"
            class="user-menu-dropdown__item user-menu-dropdown__item--danger"
            role="menuitem"
            @click="emit('logout')"
          >
            <LogoutOutlined />
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  QuestionCircleOutlined,
  DollarCircleOutlined,
  WalletOutlined,
  LogoutOutlined,
  GiftOutlined
} from '@ant-design/icons-vue'
import { useAuthPublicConfig } from '~/composables/useAuthPublicConfig'
import { useWechatNotifyPreference } from '~/composables/useWechatNotifyPreference'
import groupAvtorUrl from '~/assets/img/home/Group-avtor.svg'

const props = withDefaults(
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
  recharge: []
  invite: []
  logout: []
}>()

const userStore = useUserStore()
const { invitePromotionEnabled, anyPaymentEnabled, loadPublicConfig } = useAuthPublicConfig()
const {
  showWechatNotifyRow,
  wechatNotifyChecked,
  wechatNotifySwitchDisabled,
  toggling: notifyToggling,
  loadPreference,
  setWechatNotifyEnabled
} = useWechatNotifyPreference()

watch(
  () => props.open,
  (visible) => {
    if (visible) {
      void loadPreference(true)
      void loadPublicConfig()
    }
  }
)

async function onWechatNotifyChange(checked: boolean | string | number) {
  const result = await setWechatNotifyEnabled(Boolean(checked))
  if (!result.ok && result.message) {
    message.error(result.message)
  }
}

const userAvatarUrl = computed(() => {
  const avatar = userStore.user?.avatar?.trim()
  return avatar || groupAvtorUrl
})

const menuCardUserName = computed(() => {
  const u = userStore.user
  const name = u?.nickName?.trim()
  if (name) return name
  if (u?.email?.trim()) return u.email.trim()
  if (u?.id) return `ID${u.id}`
  return '用户'
})

const menuCardUserSub = computed(() => {
  const u = userStore.user
  if (!u?.id) return ''
  if (u.username?.trim()) return `ID:${u.id}`
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

.user-menu-dropdown__wechat-notify {
  padding: 0 14px 0;
  background: #202434;
}

.user-menu-dropdown__wechat-notify-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.user-menu-dropdown__wechat-notify-row.is-disabled {
  cursor: not-allowed;
}

.user-menu-dropdown__wechat-notify-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.92);
  user-select: none;
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

<style lang="scss">
/* 开关根节点即 .user-menu-dropdown__switch，需非 scoped 并压过 app-shell-create 全局纯色 */
html.app-shell-create .user-menu-dropdown__switch.ant-switch,
html.home-page-shell .user-menu-dropdown__switch.ant-switch {
  min-width: 36px;
  background: rgba(106, 123, 148, 0.7) !important;
  border: 1px solid rgba(180, 198, 224, 0.48) !important;
}

html.app-shell-create .user-menu-dropdown__switch.ant-switch.ant-switch-checked,
html.home-page-shell .user-menu-dropdown__switch.ant-switch.ant-switch-checked {
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  border-color: rgba(0, 171, 216, 0.95) !important;
}

html.app-shell-create
  .user-menu-dropdown__switch.ant-switch.ant-switch-checked:hover:not(.ant-switch-disabled),
html.home-page-shell
  .user-menu-dropdown__switch.ant-switch.ant-switch-checked:hover:not(.ant-switch-disabled) {
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  border-color: rgba(0, 171, 216, 0.95) !important;
}

html.app-shell-create .user-menu-dropdown__switch.ant-switch .ant-switch-handle,
html.home-page-shell .user-menu-dropdown__switch.ant-switch .ant-switch-handle {
  top: 50% !important;
  translate: 0 -50%;
}

html.app-shell-create .user-menu-dropdown__switch.ant-switch .ant-switch-handle::before,
html.home-page-shell .user-menu-dropdown__switch.ant-switch .ant-switch-handle::before {
  background: #ffffff !important;
}
</style>
