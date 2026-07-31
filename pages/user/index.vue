<template>
  <div class="user-page home-theme-page home-theme-static">
    <div class="page-container">
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">
            <TeamOutlined class="title-icon" />
            用户中心
          </h1>
          <p class="page-subtitle">管理和查看平台用户信息</p>
        </div>
      </div>

      <div class="user-list-section">
        <div class="section-header">
          <h2 class="section-title">用户列表</h2>
          <div class="user-count">共 {{ users.length }} 位用户</div>
        </div>
        <div class="user-cards">
          <div
            v-for="user in users"
            :key="user.id"
            class="user-card hover-card"
            @click="goToUserDetail(user.id)"
          >
            <div class="user-avatar">
              <span class="avatar-text">{{ user.name[0] }}</span>
            </div>
            <div class="user-info">
              <h3 class="user-name">{{ user.name }}</h3>
              <p class="user-email">{{ user.email }}</p>
              <div class="user-role-badge" :class="user.role === '管理员' ? 'admin' : 'user'">
                {{ user.role }}
              </div>
            </div>
            <div class="card-arrow">
              <RightOutlined />
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
import { LeftOutlined, RightOutlined, TeamOutlined } from '@ant-design/icons-vue'

definePageMeta({
  layout: 'home'
})

const router = useRouter()

const users = [
  { id: '1', name: '张三', email: 'zhangsan@example.com', role: '管理员' },
  { id: '2', name: '李四', email: 'lisi@example.com', role: '普通用户' },
  { id: '3', name: '王五', email: 'wangwu@example.com', role: '普通用户' }
]

function goToUserDetail(id: string) {
  router.push(`/user/${id}`)
}

function goBack() {
  router.push('/')
}
</script>
