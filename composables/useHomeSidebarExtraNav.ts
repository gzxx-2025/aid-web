/** 侧栏「新手教程」：链接来自 /auth/public-config → basic */
export function useHomeSidebarExtraNav() {
  const router = useRouter()
  const { tutorialUrl, loadPublicConfig } = useAuthPublicConfig()

  async function ensurePublicConfig() {
    await loadPublicConfig()
  }

  async function openTutorial() {
    await ensurePublicConfig()
    const url = tutorialUrl.value
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    router.push('/faq')
  }

  return {
    openTutorial
  }
}
