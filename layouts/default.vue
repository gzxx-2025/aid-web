<template>
  <div class="layout-default">
    <!-- 顶部导航栏 -->
    <header class="layout-header">
      <div class="header-content">
        <div class="header-left">
          <NuxtLink to="/" class="logo">
            <AppstoreOutlined class="logo-icon" />
            <span class="logo-text">漫剧工坊</span>
          </NuxtLink>
          <nav class="nav-menu">
            <NuxtLink to="/" class="nav-item">案例广场</NuxtLink>
            <NuxtLink to="/works" class="nav-item" v-if="userStore.isLoggedIn">我的作品</NuxtLink>
            <NuxtLink to="/assets" class="nav-item" v-if="userStore.isLoggedIn">资产库</NuxtLink>
          </nav>
        </div>
        <div class="header-right">
          <template v-if="userStore.isLoggedIn">
            <button class="btn-create" @click="goToCreate">
              <PlusOutlined class="icon" />
              <span>新建创作</span>
            </button>
            <div class="user-info">
              <Avatar :size="40" :src="userStore.user?.avatar">
                <template #icon>
                  <UserOutlined />
                </template>
              </Avatar>
              <span class="username">{{ userStore.user?.username }}</span>
              <a class="logout-link" @click="handleLogout">退出</a>
            </div>
          </template>
          <template v-else>
            <button class="btn-login" @click="goToLogin">登录</button>
          </template>
        </div>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="layout-main">
      <slot />
    </main>

    <!-- 页脚 -->
    <footer class="layout-footer">
      <div class="footer-content">
        <p>© 2025 漫剧工坊 - 专业漫画动漫视频创作平台</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { UserOutlined, AppstoreOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { authLogout } from '~/utils/businessApi'

const userStore = useUserStore()
const router = useRouter()

const goToLogin = () => {
  router.push('/login')
}

const goToCreate = () => {
  router.push('/create')
}

const handleLogout = async () => {
  try {
    if (userStore.token) {
      await authLogout()
    }
  } catch {
    // 接口失败仍执行本地登出
  }
  userStore.logout()
  message.success('已退出登录')
  router.push('/')
}
</script>

<style scoped>
.layout-default {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 顶部导航栏 */
.layout-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.25rem 3rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 3rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  text-decoration: none;
  font-weight: 800;
  font-size: 1.625rem;
  transition: transform 0.2s ease;
}

.logo:hover {
  transform: scale(1.02);
}

.logo-icon {
  font-size: 2rem;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.2));
}

.logo-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.nav-menu {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.nav-item {
  text-decoration: none;
  color: var(--gray-600);
  font-weight: 500;
  font-size: 0.9375rem;
  transition: all 0.2s ease;
  position: relative;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-lg);
  cursor: pointer;
}

.nav-item:hover {
  color: var(--primary-700);
  background: var(--primary-50);
}

.nav-item.router-link-active {
  color: var(--primary-700);
  background: var(--primary-50);
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.btn-login {
  background: var(--gradient-primary);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: var(--radius-lg);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  position: relative;
  overflow: hidden;
}

.btn-login::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s ease;
}

.btn-login:hover::before {
  transform: translateX(100%);
}

.btn-login:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.btn-login:active {
  transform: translateY(0);
}

.btn-create {
  background: var(--gradient-warm);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: var(--radius-lg);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(250, 112, 154, 0.3);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
}

.btn-create::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s ease;
}

.btn-create:hover::before {
  transform: translateX(100%);
}

.btn-create:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(250, 112, 154, 0.4);
}

.btn-create:active {
  transform: translateY(0);
}

.btn-create .icon {
  font-size: 1.125rem;
  line-height: 1;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-100);
}

.username {
  font-weight: 600;
  color: var(--gray-800);
  font-size: 0.9375rem;
}

.logout-link {
  color: var(--gray-500);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-md);
}

.logout-link:hover {
  color: var(--primary-600);
  background: var(--primary-50);
}

/* 主要内容区域 */
.layout-main {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 3rem;
}

/* 页脚 */
.layout-footer {
  background: var(--gray-800);
  color: var(--gray-300);
  padding: 2rem;
  text-align: center;
}

.footer-content p {
  margin: 0;
}
</style>
