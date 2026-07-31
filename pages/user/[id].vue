<template>
  <div class="user-detail-page home-theme-page home-theme-static">
    <div class="page-container">
      <div class="breadcrumb">
        <a-button @click="goToUserList">
          <LeftOutlined />
          返回用户列表
        </a-button>
      </div>
      <div class="page-header">
        <h1 class="page-title">用户详情</h1>
      </div>
      <div v-if="user" class="user-detail-card">
        <div class="user-info">
          <div class="user-avatar-large">
            <span class="avatar-text">{{ user.name[0] }}</span>
          </div>
          <div class="user-details">
            <h2 class="user-name">{{ user.name }}</h2>
            <div class="detail-item">
              <span class="detail-label">ID:</span>
              <span class="detail-value">{{ user.id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">邮箱:</span>
              <span class="detail-value">{{ user.email }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">角色:</span>
              <span class="detail-value">
                <span class="role-badge" :class="user.role === '管理员' ? 'admin' : 'user'">
                  {{ user.role }}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div class="user-actions">
          <h3 class="actions-title">快速操作</h3>
          <div class="action-buttons">
            <a-button type="primary" size="large">编辑信息</a-button>
            <a-button size="large">查看历史</a-button>
          </div>
        </div>
      </div>
      <div v-else class="not-found">
        <div class="not-found-icon">❌</div>
        <h3>用户不存在</h3>
        <p>抱歉，找不到该用户信息</p>
        <a-button type="primary" @click="goToUserList">返回用户列表</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LeftOutlined } from '@ant-design/icons-vue'

definePageMeta({
  layout: 'home'
})

const route = useRoute()
const router = useRouter()

const userId = route.params.id as string

const users = {
  '1': { id: '1', name: '张三', email: 'zhangsan@example.com', role: '管理员' },
  '2': { id: '2', name: '李四', email: 'lisi@example.com', role: '普通用户' },
  '3': { id: '3', name: '王五', email: 'wangwu@example.com', role: '普通用户' }
}

const user = computed(() => users[userId as keyof typeof users] || null)

function goToUserList() {
  router.push('/user')
}
</script>
