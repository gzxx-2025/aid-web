import { computed, nextTick, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { useCreationStore } from '~/stores/creation'

interface UserMenuDropdownInstance {
  floatingRoot: HTMLElement | null
}

/**
 * 创作页左侧栏：作品库/资产库切换、充值、用户菜单（原 index.vue）
 */
export function useCreateFlowSidebarChrome() {
  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const creationStore = useCreationStore()

  const createSidebarView = ref<'flow' | 'works' | 'assets'>('flow')
  const showRechargeModal = ref(false)

  function syncViewFromRoute() {
    // 仅在创作流程页内生效：用 query 记录当前右侧面板，支持刷新/返回
    if (!route.path.startsWith('/create')) return
    const raw = String((route.query.panel ?? '') as string).toLowerCase()
    if (raw === 'works' || raw === 'assets' || raw === 'flow') {
      createSidebarView.value = raw as 'works' | 'assets' | 'flow'
      return
    }
    createSidebarView.value = 'flow'
  }

  // 首次与后续路由变化都对齐到状态
  syncViewFromRoute()
  watch(
    () => route.fullPath,
    () => syncViewFromRoute()
  )

  function setPanel(panel: 'flow' | 'works' | 'assets') {
    createSidebarView.value = panel
    if (panel !== 'flow') {
      creationStore.showExtractAgentModal = false
    }
    if (!route.path.startsWith('/create')) return
    const nextQuery = { ...route.query }
    if (panel === 'flow') {
      delete (nextQuery as any).panel
    } else {
      ;(nextQuery as any).panel = panel
    }
    // replace：不打断流程页本身的逻辑，同时允许浏览器返回（如果希望返回也回到上一个 panel，可改 push）
    router.replace({ path: route.path, query: nextQuery })
  }

  const isLoggedIn = computed(() => !!userStore.token)
  const displayPoints = computed(() => {
    if (!isLoggedIn.value) return '0'
    const balance = Number((userStore.user as { balance?: number })?.balance ?? 0)
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
    setPanel('works')
  }

  function openAssetsPanel() {
    setPanel('assets')
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
    router.push('/about#faq')
  }

  function openBilling() {
    closeUserMenu()
    router.push('/about#billing')
  }

  function openAbout() {
    closeUserMenu()
    router.push('/about')
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
    showRechargeModal.value = true
  }

  function handleRechargePaid() {
    message.success('充值成功，可继续创作')
  }

  function handleOpenRechargeByEvent() {
    if (!isLoggedIn.value) {
      goLogin()
      return
    }
    showRechargeModal.value = true
  }

  return {
    createSidebarView,
    setPanel,
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
    openAbout,
    handleLogout,
    handleDocumentClick,
    updateUserMenuPosition,
    onRecharge,
    handleRechargePaid,
    handleOpenRechargeByEvent
  }
}
