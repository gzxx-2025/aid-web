<template>
  <div class="home-legacy-page">
    <div class="page-content">
      <section class="hero-section">
        <div class="hero-bg">
          <img src="../assets/img/home/banner.svg" alt="Hero Background" class="hero-bg-img" />
        </div>
        <div class="hero-content">
          <div class="hero-buttons">
            <button type="button" class="btn-primary" @click="goToCreate">
              <img src="@/assets/img/icon/star_white.svg" alt="" />
              <span>我要创作</span>
            </button>
            <button type="button" class="btn-secondary">
              <div class="text">查看教程</div>
            </button>
          </div>
        </div>
      </section>

      <section class="gallery-section">
        <div class="section-header">
          <img class="algc" src="../assets/img/home/algc.png" alt="" />
          <div class="section-controls">
            <div class="search-box">
              <SearchOutlined class="search-icon" />
              <input v-model="searchQuery" type="text" placeholder="搜索作品..." class="search-input" />
            </div>
            <div class="filter-tabs">
              <button
                v-for="tab in filterTabs"
                :key="tab.value"
                type="button"
                :class="['filter-tab', { active: activeTab === tab.value }]"
                @click="activeTab = tab.value"
              >
                <img
                  :src="activeTab === tab.value ? tab.iconSel : tab.iconNor"
                  alt=""
                  class="filter-tab-ico"
                  width="14"
                  height="14"
                />
                <span>{{ tab.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="works-grid">
          <div
            v-for="work in filteredWorks"
            :key="work.id"
            class="work-card work-card--gallery"
            role="button"
            tabindex="0"
            @click="goCaseDetail(work.id)"
            @keydown.enter.prevent="goCaseDetail(work.id)"
            @keydown.space.prevent="goCaseDetail(work.id)"
          >
            <div class="work-cover">
              <img :src="work.coverImage" :alt="work.title" class="work-img" />
              <div class="work-overlay">
                <button type="button" class="play-btn" aria-label="播放预览" @click.stop="goCaseDetail(work.id)">
                  <PlayCircleOutlined />
                </button>
              </div>
            </div>
            <div class="work-info">
              <h3 class="work-title">{{ work.title }}</h3>
              <div class="work-meta">
                <span class="meta-item">
                  <img src="../assets/img/home/episode.svg" alt="" />
                  ID {{ work.id }}
                </span>
                <span class="meta-item">
                  <EyeOutlined />
                  {{ work.videoStyleType || '公开案例' }}
                </span>
              </div>
              <div class="work-author">
                <div class="author-avatar">
                  <img src="../assets/img/home/user_blue.svg" alt="" />
                </div>
                <span class="author-name">{{ work.projectDesc || '精选公开项目' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SearchOutlined, PlayCircleOutlined, EyeOutlined } from '@ant-design/icons-vue'
import allNorIcon from '~/assets/img/home/all-nor.svg'
import allSelIcon from '~/assets/img/home/all-sel.svg'
import popularNorIcon from '~/assets/img/home/popular-nor.svg'
import popularSelIcon from '~/assets/img/home/popular-sel.svg'
import curatedNorIcon from '~/assets/img/home/curated-nor.svg'
import curatedSelIcon from '~/assets/img/home/curated-sel.svg'
import latestNorIcon from '~/assets/img/home/latest-nor.svg'
import latestSelIcon from '~/assets/img/home/latest-sel.svg'
import { message } from 'ant-design-vue'
import { publicProjectVideoList } from '~/utils/businessApi'
import type { PublicProjectVideoRow } from '~/types/business-api'

definePageMeta({
  layout: 'home'
})

const router = useRouter()
const userStore = useUserStore()

const isLoggedIn = computed(() => !!userStore.token)
const homeCreateModal = useHomeShellCreateModal()

const searchQuery = ref('')
const activeTab = ref('all')

const filterTabs = [
  { label: '全部', value: 'all', iconNor: allNorIcon, iconSel: allSelIcon },
  { label: '热门', value: 'hot', iconNor: popularNorIcon, iconSel: popularSelIcon },
  { label: '精选', value: 'featured', iconNor: curatedNorIcon, iconSel: curatedSelIcon },
  { label: '最新', value: 'latest', iconNor: latestNorIcon, iconSel: latestSelIcon }
]

interface HomeGalleryWork {
  id: number
  title: string
  coverImage: string
  projectDesc: string
  videoStyleType: string
}

const works = ref<HomeGalleryWork[]>([])

function normalizeWork(row: PublicProjectVideoRow): HomeGalleryWork {
  return {
    id: row.id,
    title: row.projectName || `公开项目 #${row.id}`,
    coverImage: row.coverUrl || '',
    projectDesc: '',
    videoStyleType: ''
  }
}

async function loadPublicWorks() {
  const { rows } = await publicProjectVideoList({
    projectName: searchQuery.value.trim() || undefined,
    pageNum: 1,
    pageSize: 24
  })
  works.value = rows.map(normalizeWork)
}

const filteredWorks = computed(() => {
  let result = works.value
  if (activeTab.value === 'latest') {
    result = [...result].sort((a, b) => b.id - a.id)
  } else if (activeTab.value === 'hot') {
    result = [...result].sort((a, b) => b.title.length - a.title.length)
  } else if (activeTab.value === 'featured') {
    result = result.filter((work) => work.coverImage)
  }
  return result
})

function goLogin() {
  router.push('/login')
}

function goCaseDetail(projectId: number) {
  router.push(`/case/${projectId}`)
}

const goToCreate = () => {
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  homeCreateModal.openCreateModal()
}

watch(
  () => searchQuery.value,
  async () => {
    await loadPublicWorks()
  }
)

onMounted(async () => {
  try {
    await loadPublicWorks()
  } catch {
    message.error('加载案例广场失败，请稍后重试')
  }
})
</script>

<style lang="scss" scoped>
.filter-tab-ico {
  display: block;
  width: 14px;
  height: 14px;
  object-fit: contain;
  flex-shrink: 0;
}
</style>
