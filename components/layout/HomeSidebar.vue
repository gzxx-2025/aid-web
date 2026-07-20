<template>
  <aside
    class="sidebar"
    :class="{ 'sidebar--skeleton': skeleton }"
    :aria-label="skeleton ? undefined : '主导航'"
    :aria-hidden="skeleton ? true : undefined"
  >
    <template v-if="skeleton">
      <div class="skeleton-sidebar-logo" />
      <div v-for="n in 3" :key="n" class="skeleton-sidebar-nav" />
      <div class="spacer" />
      <div class="skeleton-sidebar-footer" />
    </template>
    <template v-else>
      <component
        :is="mode === 'route' ? 'NuxtLink' : 'button'"
        :to="mode === 'route' ? '/' : undefined"
        :type="mode === 'route' ? undefined : 'button'"
        class="brand"
        aria-label="首页"
        @click="onBrandClick"
      >
        <img :src="logoUrl" width="111" height="43" alt="" class="logo-img" />
      </component>

      <nav class="nav">
        <component
          :is="mode === 'route' ? 'NuxtLink' : 'button'"
          :to="mode === 'route' ? '/' : undefined"
          :type="mode === 'route' ? undefined : 'button'"
          class="nav-item"
          :class="{ 'is-active': galleryActive }"
          @mouseenter="hoveredNavKey = 'gallery'"
          @mouseleave="hoveredNavKey = null"
          @click="onGalleryClick"
        >
          <img
            :src="galleryActive || hoveredNavKey === 'gallery' ? homeSelIcon : homeNorIcon"
            alt=""
            class="nav-ico"
            width="18"
            height="18"
          />
          <span>案例广场</span>
        </component>
        <button
          type="button"
          class="nav-item"
          :class="{ 'is-active': worksActive }"
          @mouseenter="hoveredNavKey = 'works'"
          @mouseleave="hoveredNavKey = null"
          @click="onWorksClick"
        >
          <img
            :src="worksActive || hoveredNavKey === 'works' ? myWorkSelIcon : myWorkNorIcon"
            alt=""
            class="nav-ico"
            width="18"
            height="18"
          />
          <span>我的作品</span>
        </button>
        <button
          type="button"
          class="nav-item"
          :class="{ 'is-active': assetsActive }"
          @mouseenter="hoveredNavKey = 'assets'"
          @mouseleave="hoveredNavKey = null"
          @click="onAssetsClick"
        >
          <img
            :src="assetsActive || hoveredNavKey === 'assets' ? myAssetSelIcon : myAssetNorIcon"
            alt=""
            class="nav-ico"
            width="18"
            height="18"
          />
          <span>资产库</span>
        </button>
      </nav>

      <div class="spacer" />

      <div class="wallet" role="group" aria-label="积分与充值">
        <img :src="starlightCoinUrl" alt="" />
        <span class="points-num">{{ displayPoints }}</span>
        <button type="button" class="recharge" @click="onRechargeClick">充值</button>
      </div>

      <div v-if="isLoggedIn" class="user">
        <div class="user-menu">
          <button
            ref="userMenuTriggerRef"
            type="button"
            class="user-trigger"
            aria-label="打开用户菜单"
            @click="emit('toggle-user-menu')"
          >
            <div class="avatar">
              <img src="/assets/img/home/Group-avtor.svg" alt="" />
            </div>
            <div class="user-meta">
              <span class="user-name" :title="userNameLabel">{{ userNameLabel }}</span>
              <span class="user-id" :title="userSubLabel">{{ userSubLabel }}</span>
            </div>
          </button>
        </div>
      </div>
      <div v-else class="user user--guest">
        <button type="button" class="login" @click="emit('login')">登录 / 注册</button>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import homeNorIcon from '~/assets/img/icon/home-nor.svg'
import homeSelIcon from '~/assets/img/icon/home-sel.svg'
import myWorkNorIcon from '~/assets/img/icon/myWork-nor.svg'
import myWorkSelIcon from '~/assets/img/icon/myWork-sel.svg'
import myAssetNorIcon from '~/assets/img/icon/myAsset-nor.svg'
import myAssetSelIcon from '~/assets/img/icon/myAsset-sel.svg'
import logoUrl from '~/assets/img/home/logo.svg'
import starlightCoinUrl from '~/assets/img/home/starlightCoin.svg'
import navActiveBg from '~/assets/img/home/Rectangle.svg'

const navActiveBgUrl = `url("${navActiveBg}")`

const props = withDefaults(
  defineProps<{
    galleryActive?: boolean
    worksActive?: boolean
    assetsActive?: boolean
    skeleton?: boolean
    /** route：首页壳走路由；create：创作流程壳走事件 */
    mode?: 'route' | 'create'
  }>(),
  {
    galleryActive: false,
    worksActive: false,
    assetsActive: false,
    skeleton: false,
    mode: 'route'
  }
)

const emit = defineEmits<{
  brand: []
  gallery: []
  works: []
  assets: []
  login: []
  recharge: []
  'toggle-user-menu': []
}>()

const router = useRouter()
const userStore = useUserStore()

const isLoggedIn = computed(() => !!userStore.token)
const hoveredNavKey = ref<'gallery' | 'works' | 'assets' | null>(null)
const userMenuTriggerRef = ref<HTMLElement | null>(null)

const displayPoints = computed(() => {
  if (!isLoggedIn.value) return '—'
  return Number((userStore.user as { balance?: number })?.balance ?? 0)
})

const userLabel = computed(() => {
  const u = userStore.user
  if (!u) return ''
  const raw = u.id?.length ? String(u.id) : ''
  const id = raw ? `ID${raw}` : ''
  return id || u.username || '用户'
})

const userNameLabel = computed(() => userStore.user?.username || '用户')

const userSubLabel = computed(() => {
  const u = userStore.user
  if (!u) return ''
  return u.email || userLabel.value
})

function onBrandClick(event: MouseEvent) {
  if (props.mode === 'route') return
  event.preventDefault()
  emit('brand')
}

function onGalleryClick(event: MouseEvent) {
  if (props.mode === 'create') {
    event.preventDefault()
    emit('gallery')
  }
}

function onWorksClick() {
  if (props.mode === 'create') {
    emit('works')
    return
  }
  if (!isLoggedIn.value) {
    emit('login')
    return
  }
  router.push('/works')
}

function onAssetsClick() {
  if (props.mode === 'create') {
    emit('assets')
    return
  }
  if (!isLoggedIn.value) {
    emit('login')
    return
  }
  router.push('/assets')
}

function onRechargeClick() {
  emit('recharge')
}

defineExpose({
  userMenuTriggerRef
})
</script>

<style lang="scss" scoped>
.sidebar {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 10px 24px;
  box-sizing: border-box;
  overflow-y: auto;
}

.sidebar--skeleton {
  pointer-events: none;
}

.brand {
  display: block;
  margin-bottom: 14px;
  text-decoration: none;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.logo-img {
  display: block;
  max-width: 100%;
  height: auto;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 11px 14px 11px 10px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  color: var(--home-muted, #8e97a5);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.nav-item.is-active {
  color: rgba(74, 231, 253, 1);
  border: none;
  box-shadow: none;
  background-color: transparent;
  background-image: v-bind(navActiveBgUrl);
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
}

.nav-item.is-active > span {
  position: relative;
  z-index: 1;
}

.nav-ico {
  display: block;
  width: 18px;
  height: 18px;
  object-fit: contain;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.nav-item:hover:not(.is-active) {
  color: rgba(74, 231, 253, 1);
  background: rgba(255, 255, 255, 0.04);
}

.spacer {
  flex: 1;
  min-height: 1rem;
}

.wallet {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  box-sizing: border-box;
  padding: 3px 4px 3px 10px;
  margin-bottom: 14px;
  border-radius: 8px;
  background: linear-gradient(270deg, rgba(14, 89, 250, 0.2) 0%, rgba(0, 171, 216, 0.2) 100%);
  border: 1px solid #006c8f;
  box-shadow: inset 0 1px 0 rgba(74, 231, 253, 0.12);
}

.points-num {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
}

.recharge {
  height: 24px;
  line-height: 24px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  background: var(--home-grad, linear-gradient(270deg, #0e59fa 0%, #00abd8 100%));
  white-space: nowrap;
  flex-shrink: 0;
}

.recharge:hover {
  filter: brightness(1.08);
}

.user {
  display: flex;
  align-items: center;
  gap: 0;
  padding-top: 2px;
}

.user-menu {
  position: relative;
  width: 100%;
}

.user-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.user-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  color: white;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-id {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.68);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user--guest {
  justify-content: stretch;
}

.login {
  width: 100%;
  padding: 9px;
  border-radius: 10px;
  border: 1px solid var(--home-border, rgba(74, 231, 253, 0.28));
  background: transparent;
  color: #4ae7fd;
  cursor: pointer;
  font-size: 13px;
}

.login:hover {
  border-color: #4ae7fd;
  color: #fff;
}

.skeleton-sidebar-logo {
  width: 111px;
  height: 43px;
  border-radius: 8px;
  background: rgba(74, 231, 253, 0.1);
  margin-bottom: 14px;
}

.skeleton-sidebar-nav {
  width: 100%;
  height: 40px;
  border-radius: 8px;
  background: rgba(74, 231, 253, 0.08);
  margin-bottom: 8px;
}

.skeleton-sidebar-footer {
  width: 100%;
  height: 72px;
  border-radius: 10px;
  background: rgba(74, 231, 253, 0.08);
}

@media (max-width: 900px) {
  .sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    border-right: none;
    border-bottom: 1px solid var(--home-border, rgba(74, 231, 253, 0.28));
    padding: 0 14px 16px;
  }

  .brand {
    margin-bottom: 0;
    margin-right: 12px;
  }

  .logo-img {
    width: 80px;
    height: auto;
  }

  .nav {
    flex-direction: row;
    flex: 1;
    flex-wrap: wrap;
    gap: 6px;
  }

  .spacer {
    display: none;
  }

  .wallet {
    width: 100%;
    order: 10;
    margin-top: 8px;
    margin-bottom: 0;
  }

  .user {
    width: 100%;
    order: 11;
    margin-top: 10px;
  }
}
</style>
