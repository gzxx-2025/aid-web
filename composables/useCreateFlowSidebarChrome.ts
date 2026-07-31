import { computed, nextTick, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'

interface UserMenuDropdownInstance {
  floatingRoot: HTMLElement | null
}

/**
 * 创作页左侧栏：与案例广场一致，「我的作品 / 资产库」走独立页面路由，避免内嵌面板缓存串作品。
 */
export function useCreateFlowSidebarChrome() {
  const router = useRouter()
  const userStore = useUserStore()
  const { anyPaymentEnabled, loadPublicConfig } = useAuthPublicConfig()
  void loadPublicConfig()
  const showRechargeModal = ref(false)

  const isLoggedIn = computed(() => !!userStore.token)
  const displayPoints = computed(() => {
    if (!isLoggedIn.value) return '0'
    const balance = Number(userStore.user?.balance ?? 0)
    return String(balance)
  })

  const showUserMenuCard = ref(false)
  const userMenuTriggerRef = ref<HTMLElement | null>(null)
  const userMenuDropdownRef = ref<UserMenuDropdownInstance | null>(null)
  const userMenuCardStyle = ref<Record<string, string>>({})

  function goLogin() {
    router.push('/login')
  }

  function goHomeFromCreate() {
    router.push('/')
  }

  function openWorksPanel() {
    if (!isLoggedIn.value) {
      goLogin()
      return
    }
    router.push('/works')
  }

  function openAssetsPanel() {
    if (!isLoggedIn.value) {
      goLogin()
      return
    }
    router.push('/assets')
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
    if (userMenuTriggerRef.value?.contains(target)) return
    const floating = userMenuDropdownRef.value?.floatingRoot
    if (floating?.contains(target)) return
    closeUserMenu()
  }

  function updateUserMenuPosition() {
    const trigger = userMenuTriggerRef.value
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    userMenuCardStyle.value = {
      left: `${rect.right + 10}px`,
      top: `${rect.bottom}px`
    }
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

  function openRechargeFromMenu() {
    closeUserMenu()
    onRecharge()
  }

  function handleRechargePaid() {
    void userStore.fetchProfile()
    message.success('充值成功，可继续创作')
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

  return {
    showRechargeModal,
    isLoggedIn,
    displayPoints,
    showUserMenuCard,
    userMenuTriggerRef,
    userMenuDropdownRef,
    userMenuCardStyle,
    goLogin,
    goHomeFromCreate,
    openWorksPanel,
    openAssetsPanel,
    toggleUserMenu,
    closeUserMenu,
    openFaq,
    openBilling,
    openRechargeFromMenu,
    handleLogout,
    handleDocumentClick,
    updateUserMenuPosition,
    handleRechargePaid,
    handleOpenRechargeByEvent
  }
}
