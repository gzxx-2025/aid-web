/** 侧栏「新手教程」：链接来自 /auth/public-config → basic */
import { resolveSafeHttpUrl } from '~/utils/safeNavigation'

export function useHomeSidebarExtraNav() {
  const router = useRouter()
  const { tutorialUrl, loadPublicConfig } = useAuthPublicConfig()

  async function ensurePublicConfig() {
    await loadPublicConfig()
  }

  async function openTutorial() {
    await ensurePublicConfig()
    const url = resolveSafeHttpUrl(tutorialUrl.value, window.location.href)
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
