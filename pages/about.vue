<template>
  <div class="about-page home-theme-page home-theme-static">
    <div class="page-container">
      <div class="page-header">
        <div class="header-content about-hero-card">
          <AppstoreOutlined class="header-icon animate-float" />
          <h1 class="page-title">关于我们</h1>
          <p class="page-subtitle">专业的漫画动漫视频创作平台</p>
        </div>
      </div>

      <div class="content-section">
        <div class="intro-card">
          <ThunderboltOutlined class="card-icon" />
          <p class="intro-text">
            漫剧工坊是一个企业级的智能视频创作平台，致力于帮助用户快速、高效地创建高质量的漫画动漫视频内容。
            我们提供从剧本到成片的全流程创作工具，让每个人都能成为漫剧大师。
          </p>
        </div>

        <div class="mission-section">
          <h2 class="section-title">
            <span class="title-line"></span>
            我们的使命
            <span class="title-line"></span>
          </h2>
          <p class="mission-text">让视频创作变得简单、高效、有趣。</p>
        </div>

        <div class="features-section">
          <h2 class="section-title">
            <span class="title-line"></span>
            技术特点
            <span class="title-line"></span>
          </h2>
          <div class="features-grid">
            <div v-for="(feature, index) in features" :key="index" class="feature-card">
              <component :is="feature.icon" class="feature-icon" />
              <h3 class="feature-title">{{ feature.title }}</h3>
              <p class="feature-description">{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="page-actions">
        <a-button size="large" @click="goBack" class="back-button">
          <LeftOutlined />
          返回首页
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  LeftOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  LockOutlined,
  InboxOutlined,
  ApiOutlined,
  BgColorsOutlined
} from '@ant-design/icons-vue'

definePageMeta({
  layout: 'home'
})

const router = useRouter()

const features = [
  {
    icon: ThunderboltOutlined,
    title: 'Nuxt 3 + Vue 3',
    description: '基于最新的 Nuxt 3 和 Vue 3 构建，提供极致的性能和开发体验'
  },
  {
    icon: LockOutlined,
    title: 'TypeScript',
    description: '使用 TypeScript 确保类型安全，减少运行时错误'
  },
  {
    icon: InboxOutlined,
    title: 'Pinia 状态管理',
    description: 'Pinia 状态管理，支持持久化，数据管理更简单'
  },
  {
    icon: ApiOutlined,
    title: '文件系统路由',
    description: '文件系统路由，自动生成路由配置，开发更高效'
  },
  {
    icon: AppstoreOutlined,
    title: '原子设计模式',
    description: '原子设计模式，组件高度可复用，维护更轻松'
  },
  {
    icon: BgColorsOutlined,
    title: '现代化UI',
    description: '采用 Ant Design Vue，提供美观现代的界面设计'
  }
]

function goBack() {
  router.push('/')
}
</script>
