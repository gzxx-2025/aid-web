<template>
  <header class="header">
    <div class="header__container">
      <div class="header__logo">
        <NuxtLink to="/" class="header__logo-link">
          <span class="header__logo-icon">🎬</span>
          <span class="header__logo-text">视频生成系统</span>
        </NuxtLink>
      </div>
      <nav class="header__nav">
        <NuxtLink to="/" class="header__nav-link" active-class="header__nav-link--active">首页</NuxtLink>
        <NuxtLink to="/about" class="header__nav-link" active-class="header__nav-link--active">关于</NuxtLink>
        <NuxtLink to="/user" class="header__nav-link" active-class="header__nav-link--active">用户</NuxtLink>
      </nav>
      <div class="header__actions">
        <button
          class="theme-toggle"
          :class="appStore.isDarkMode ? 'dark' : 'light'"
          @click="appStore.toggleTheme"
        >
          {{ appStore.isDarkMode ? '☀️' : '🌙' }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
const appStore = useAppStore()
</script>

<style scoped>
.header {
  background-color: white;
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header__container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header__logo-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: var(--text-color);
}

.header__logo-icon {
  font-size: 1.75rem;
}

.header__logo-text {
  font-size: 1.25rem;
  font-weight: 600;
}

.header__nav {
  display: flex;
  gap: 2rem;
}

.header__nav-link {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  transition: color 0.2s;
}

.header__nav-link:hover {
  color: var(--primary-color);
}

.header__nav-link--active {
  color: var(--primary-color);
}

.header__actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--gray-200);
  background: white;
  cursor: pointer;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.theme-toggle:hover {
  border-color: var(--primary-400);
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .header__nav {
    display: none;
  }
}
</style>
