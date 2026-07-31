<template>
  <div class="home-page">
    <HomeSidebar
      ref="homeSidebarRef"
      @brand="goGallery"
      @gallery="goGallery"
      @works="goWorks"
      @assets="goAssets"
      @recharge="onRecharge"
      @login="goLogin"
      @toggle-user-menu="toggleUserMenu"
    />

    <div class="main-wrap home_box">
      <main class="main">
        <!-- mode="out-in"：先出后进；CreateFirstStepModal 已移到 layout 外，过渡层内无 Teleport 弹层 -->
        <div class="home-route-transition-host">
          <Transition name="home-route" mode="out-in">
            <div :key="route.path" class="home-main-route">
              <Suspense>
                <slot />
              </Suspense>
            </div>
          </Transition>
        </div>
      </main>
    </div>
  </div>
  <CreateFirstStepModal
    :open="homeCreateModal.showCreateFirstStepModal"
    :confirm-loading="homeCreateModal.createConfirmLoading"
    :title="homeCreateModal.creationTitleDraft"
    :project-type="homeCreateModal.creationProjectTypeDraft"
    :sync-project-type-from-parent="homeCreateModal.syncProjectTypeFromParent"
    :aspect-ratio="homeCreateModal.creationGlobalSettingDraft.aspectRatio"
    :script-type="homeCreateModal.creationGlobalSettingDraft.scriptType"
    :model-strategy="homeCreateModal.creationGlobalSettingDraft.modelStrategy"
    :creation-mode="homeCreateModal.creationGlobalSettingDraft.creationMode"
    :model-value="homeCreateModal.creationGlobalSettingDraft"
    @update:open="homeCreateModal.showCreateFirstStepModal = $event"
    @update:title="homeCreateModal.creationTitleDraft = $event"
    @update:project-type="homeCreateModal.creationProjectTypeDraft = $event"
    @update:aspect-ratio="homeCreateModal.updateGlobalSettingDraftField('aspectRatio', $event)"
    @update:script-type="homeCreateModal.updateGlobalSettingDraftField('scriptType', $event)"
    @update:model-strategy="homeCreateModal.updateGlobalSettingDraftField('modelStrategy', $event)"
    @update:creation-mode="homeCreateModal.updateGlobalSettingDraftField('creationMode', $event)"
    @update:model-value="homeCreateModal.patchGlobalSettingDraftStyle($event)"
    @confirm="onHomeCreateFirstConfirm"
  />
  <RechargeModal v-model:open="showRechargeModal" @paid="handleRechargePaid" />
  <UserMenuDropdown
    ref="userMenuDropdownRef"
    :open="showUserMenuCard"
    :floating-style="userMenuCardStyle"
    @faq="openFaq"
    @billing="openBilling"
    @recharge="openRechargeFromMenu"
    @invite="openInvite"
    @logout="handleLogout"
  />
</template>

<script setup lang="ts">
import { Modal, message } from 'ant-design-vue'
import HomeSidebar from '~/components/layout/HomeSidebar.vue'
import RechargeModal from '~/components/common/RechargeModal.vue'
import UserMenuDropdown from '~/components/common/UserMenuDropdown.vue'
import CreateFirstStepModal from '~/components/steps/CreateFirstStepModal.vue'

const homeCreateModal = useHomeShellCreateModal()

function onHomeCreateFirstConfirm() {
  return homeCreateModal.handleCreateConfirm()
}

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { anyPaymentEnabled, loadPublicConfig } = useAuthPublicConfig()

const isLoggedIn = computed(() => !!userStore.token)

const showRechargeModal = ref(false)
const showUserMenuCard = ref(false)
const homeSidebarRef = ref<InstanceType<typeof HomeSidebar> | null>(null)
const userMenuDropdownRef = ref<InstanceType<typeof UserMenuDropdown> | null>(null)
const userMenuCardStyle = ref<Record<string, string>>({})

function goLogin() {
  router.push('/login')
}

function goGallery() {
  if (route.path === '/' || route.path === '') {
    nextTick(() => {
      document.querySelector('.home-page .main')?.scrollTo({ top: 0, behavior: 'smooth' })
    })
    return
  }
  router.push('/')
}

function goWorks() {
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  router.push('/works')
}

function goAssets() {
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  router.push('/assets')
}

function onRecharge() {
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  if (!anyPaymentEnabled.value) {
    message.warning('暂未开放充值')
    return
  }
  showRechargeModal.value = true
}

function handleRechargePaid() {
  void userStore.fetchProfile()
  message.success('充值已到账')
}

function handleOpenRechargeByEvent() {
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  if (!anyPaymentEnabled.value) {
    message.warning('暂未开放充值')
    return
  }
  showRechargeModal.value = true
}

function toggleUserMenu() {
  const next = !showUserMenuCard.value
  showUserMenuCard.value = next
  if (next) {
    nextTick(() => updateUserMenuPosition())
  }
}

function closeUserMenu() {
  showUserMenuCard.value = false
}

function openFaq() {
  closeUserMenu()
  router.push('/faq')
}

function openBilling() {
  closeUserMenu()
  router.push('/billing')
}

function openRechargeFromMenu() {
  closeUserMenu()
  onRecharge()
}

function openInvite() {
  closeUserMenu()
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  router.push('/invite')
}

function handleLogout() {
  Modal.confirm({
    class: 'home-confirm-modal',
    wrapClassName: 'create-flow-modal home-confirm-wrap',
    title: '确认退出登录',
    content: '退出后需要重新登录，是否继续？',
    okText: '确定',
    cancelText: '取消',
    centered: true,
    onOk: () => {
      userStore.logout()
      closeUserMenu()
      router.push('/login')
    }
  })
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target) return
  if (homeSidebarRef.value?.userMenuRef?.contains(target)) return
  const floating = userMenuDropdownRef.value?.floatingRoot
  if (floating?.contains(target)) return
  closeUserMenu()
}

function updateUserMenuPosition() {
  const trigger = homeSidebarRef.value?.userMenuTriggerRef
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  userMenuCardStyle.value = {
    left: `${rect.right + 10}px`,
    top: `${rect.bottom}px`
  }
}

onMounted(() => {
  void loadPublicConfig()
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', updateUserMenuPosition)
  window.addEventListener('scroll', updateUserMenuPosition, true)
  window.addEventListener('open-recharge-modal', handleOpenRechargeByEvent as EventListener)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', updateUserMenuPosition)
  window.removeEventListener('scroll', updateUserMenuPosition, true)
  window.removeEventListener('open-recharge-modal', handleOpenRechargeByEvent as EventListener)
})

useHead({
  htmlAttrs: {
    // 与流程页共用 app-shell-create：Modal/Message 等挂载到 body，依赖 html 类命中 create-steps-ant-overrides.css
    class: 'home-page-shell app-shell-create'
  }
})
</script>

<style lang="scss" scoped>
.home-page {
  display: flex;
  height: 100vh;
  width: 100%;
  background: linear-gradient(165deg, #001731 0%, #0d0d0f 42%, #121212 100%);
  background-color: #060a12;
  color: #4ae7fd;
  --home-muted: #8e97a5;
  --home-surface: rgba(18, 22, 30, 0.92);
  --home-border: rgba(74, 231, 253, 0.28);
  --home-border-strong: #006c8f;
  --home-grad: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  overflow: hidden;
}

.main-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 20px 18px 0;
}

.main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  position: relative;
}

.home-route-transition-host {
  position: relative;
  min-height: 100%;
  isolation: isolate;
}

.home-main-route {
  min-height: 100%;
}

.home-route-enter-active,
.home-route-leave-active {
  transition:
    opacity 0.26s ease,
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.home-route-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.home-route-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .home-route-enter-active,
  .home-route-leave-active {
    transition: none;
  }

  .home-route-enter-from,
  .home-route-leave-to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 900px) {
  .home-page {
    flex-direction: column;
  }
}
</style>

<style>
.home-confirm-wrap .ant-modal-content,
.home-confirm-modal .ant-modal-content {
  background: var(--create-surface-modal, rgba(25, 26, 29, 1)) !important;
  border: 1px solid rgba(74, 231, 253, 0.09) !important;
  box-shadow: 0 24px 56px rgba(8, 12, 24, 0.45) !important;
  border-radius: 8px !important;
}

.home-confirm-wrap .ant-modal-confirm-body,
.home-confirm-modal .ant-modal-confirm-body {
  color: #e6edf3 !important;
}

.home-confirm-wrap .ant-modal-confirm-title,
.home-confirm-modal .ant-modal-confirm-title {
  color: #fff !important;
}

.home-confirm-wrap .ant-modal-confirm-content,
.home-confirm-modal .ant-modal-confirm-content {
  color: #a8b4c4 !important;
}

.home-confirm-wrap .ant-modal-confirm-body > .anticon,
.home-confirm-modal .ant-modal-confirm-body > .anticon {
  color: #4ae7fd !important;
}

.home-confirm-wrap .ant-modal-confirm-btns .ant-btn,
.home-confirm-modal .ant-modal-confirm-btns .ant-btn {
  border-radius: 8px;
}
</style>
