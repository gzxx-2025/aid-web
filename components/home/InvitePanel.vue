<template>
  <div class="home-new-sub-page invite-page">
    <div class="page-content invite-page__inner">
      <!-- 顶部：左侧标题+邀请码卡，右侧插画（与设计稿同结构） -->
      <section class="invite-page__top">
        <div class="invite-page__top-main">
          <header class="invite-page__header">
            <h1 class="invite-page__title">邀请有礼</h1>
            <p class="invite-page__subtitle">
              邀请好友注册，分享专属邀请码，用户充值后您将获得{{ rebateRatioText }}%的积分
            </p>
          </header>

          <div v-if="loading && !info" class="invite-page__card invite-page__card--state">
            加载中…
          </div>
          <div
            v-else-if="loadError"
            class="invite-page__card invite-page__card--state invite-page__card--error"
          >
            {{ loadError }}
          </div>
          <div
            v-else-if="info && !info.enabled"
            class="invite-page__card invite-page__card--state"
          >
            邀请活动暂未开启
          </div>
          <div v-else-if="info" class="invite-page__card" aria-label="我的邀请码">
            <div class="invite-page__card-label">我的邀请码</div>
            <div class="invite-page__code-row">
              <div class="invite-page__code-box">
                <span class="invite-page__code">{{ info.inviteCode || '—' }}</span>
                <button
                  type="button"
                  class="invite-page__code-copy"
                  :disabled="!info.inviteCode"
                  aria-label="复制邀请码"
                  @click="copyInvite"
                >
                  <CopyOutlined />
                </button>
              </div>
              <button
                type="button"
                class="invite-page__link-btn"
                :disabled="!info.inviteCode"
                @click="copyInviteLink"
              >
                <span class="invite-page__link-btn-text">复制邀请链接</span>
              </button>
            </div>
            <div class="invite-page__stats">
              <div class="invite-page__stat">
                <span class="invite-page__stat-label">已邀请</span>
                <span class="invite-page__stat-num">{{ info.invitedCount ?? 0 }}</span>
                <span class="invite-page__stat-unit">人</span>
              </div>
              <div class="invite-page__stat">
                <span class="invite-page__stat-label">已获返利</span>
                <span class="invite-page__stat-num">{{ formatCredits(info.totalRebate) }}</span>
                <span class="invite-page__stat-unit">积分</span>
              </div>
            </div>
          </div>
        </div>

        <div class="invite-page__pic-wrap" aria-hidden="true">
          <img
            class="invite-page__pic"
            :src="inviteHeroPicUrl"
            alt=""
            width="310"
            height="268"
          />
        </div>
      </section>

      <section v-if="info?.enabled" class="invite-page__records" aria-label="邀请记录">
        <div class="invite-page__records-head">
          <h2 class="invite-page__records-title">邀请记录</h2>
          <span class="invite-page__records-meta">本月已邀请 {{ monthInvitedCount }} 人</span>
        </div>

        <div class="invite-page__table" role="table" aria-label="邀请用户列表">
          <div class="invite-page__thead" role="row">
            <span class="invite-page__th invite-page__col-index" role="columnheader">序号</span>
            <span class="invite-page__th invite-page__col-user" role="columnheader">用户</span>
            <span class="invite-page__th invite-page__col-time" role="columnheader">注册时间</span>
            <span class="invite-page__th invite-page__col-points" role="columnheader">获得积分</span>
          </div>

          <div v-if="usersLoading && !users.length" class="invite-page__state invite-page__state--table">
            加载中…
          </div>
          <template v-else-if="users.length">
            <div
              v-for="(u, i) in users"
              :key="`${u.nickName}-${u.registerTime}-${i}`"
              class="invite-page__tr"
              :class="{ 'is-alt': i % 2 === 1 }"
              role="row"
            >
              <span class="invite-page__td invite-page__col-index" role="cell">
                <span class="invite-page__index">{{ i + 1 }}</span>
              </span>
              <span class="invite-page__td invite-page__col-user" role="cell">
                <img
                  class="invite-page__avatar"
                  :src="u.avatar || defaultAvatar"
                  alt=""
                  width="24"
                  height="24"
                />
                <span class="invite-page__user-name">{{ u.nickName || '用户' }}</span>
              </span>
              <span class="invite-page__td invite-page__col-time" role="cell">
                {{ formatRegisterTime(u.registerTime) }}
              </span>
              <span class="invite-page__td invite-page__col-points" role="cell">
                {{ formatCredits(u.totalRebate) }}
              </span>
            </div>
            <div v-if="usersTotal > users.length" class="invite-page__more">
              <a-button size="small" :loading="usersLoading" @click="loadMoreUsers">
                加载更多
              </a-button>
            </div>
          </template>
          <div v-else class="invite-page__empty">
            <img
              class="invite-page__empty-icon empty-image-icon empty-image-icon--lg"
              :src="noDataIconUrl"
              alt=""
            />
            <p class="invite-page__empty-text">暂无记录</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { userInviteInfo, userInviteUsers } from '~/utils/businessApi'
import type { InviteInfoVO, InvitedUserVO } from '~/types/business-api'
import { copyPlainText } from '~/utils/clipboard'
import { noDataIconUrl } from '~/utils/emptyImageIcon'
import groupAvtorUrl from '~/assets/img/home/Group-avtor.svg'
import inviteHeroPicUrl from '~/assets/img/home/pic_yq.svg'

const defaultAvatar = groupAvtorUrl

const loading = ref(false)
const loadError = ref('')
const info = ref<InviteInfoVO | null>(null)

const users = ref<InvitedUserVO[]>([])
const usersTotal = ref(0)
const usersPage = ref(1)
const usersLoading = ref(false)

const rebateRatioText = computed(() => {
  const n = Number(info.value?.rebateRatio)
  return Number.isFinite(n) ? String(n) : '10'
})

const monthInvitedCount = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return users.value.filter((u) => {
    const d = parseRegisterDate(u.registerTime)
    return d != null && d.getFullYear() === y && d.getMonth() === m
  }).length
})

function formatCredits(v: unknown): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(2).replace(/\.00$/, '')
}

function parseRegisterDate(raw?: string): Date | null {
  if (!raw) return null
  const normalized = String(raw).trim().replace(/-/g, '/').replace('T', ' ')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function formatRegisterTime(raw?: string): string {
  const d = parseRegisterDate(raw)
  if (!d) return raw || '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

async function loadInfo() {
  loading.value = true
  loadError.value = ''
  try {
    info.value = await userInviteInfo()
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    loadError.value = err?.msg || err?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadUsers(reset = false) {
  if (usersLoading.value) return
  if (reset) {
    usersPage.value = 1
    users.value = []
  }
  usersLoading.value = true
  try {
    const res = await userInviteUsers({ pageNum: usersPage.value, pageSize: 10 })
    usersTotal.value = res.total
    users.value = reset ? res.data : [...users.value, ...res.data]
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载邀请用户失败')
  } finally {
    usersLoading.value = false
  }
}

function loadMoreUsers() {
  usersPage.value += 1
  void loadUsers(false)
}

async function copyText(text: string, okMsg: string) {
  const copied = await copyPlainText(text)
  if (copied) {
    message.success(okMsg)
    return
  }
  message.error('复制失败，请手动复制')
}

function copyInvite() {
  const code = String(info.value?.inviteCode || '').trim()
  if (!code) return
  void copyText(code, '邀请码已复制')
}

function copyInviteLink() {
  const code = String(info.value?.inviteCode || '').trim()
  if (!code) return
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  void copyText(`${origin}/login?invite=${encodeURIComponent(code)}`, '邀请链接已复制')
}

onMounted(async () => {
  await loadInfo()
  if (info.value?.enabled) {
    void loadUsers(true)
  }
})
</script>

<style scoped>
.invite-page {
  --invite-cyan: #4ae7fd;
  --invite-muted: #8e97a5;
  --invite-card-bg: #111621;
  --invite-row-bg: #202434;
  --invite-title-size: 32px;
  --invite-subtitle-size: 14px;
  --invite-section-title: 18px;
  --invite-code-size: 32px;
  --invite-label-size: 18px;
  --invite-pic-w: 310px;
  --invite-pic-h: 268px;
  --invite-gap: 28px;
  --invite-card-pad-x: 24px;
  --invite-card-pad-y: 24px;
  --invite-code-h: 56px;
  --invite-btn-w: 116px;
  --invite-row-h: 48px;
  --invite-head-h: 36px;
  --invite-top-gap: 20px;
}

.invite-page__inner {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 54px 30px 40px;
  min-width: 0;
}

/* 顶部双栏：左内容 + 右插画，与设计稿一致 */
.invite-page__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px 40px;
  min-width: 0;
}

.invite-page__top-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--invite-top-gap);
}

.invite-page__header {
  min-width: 0;
}

.invite-page__title {
  margin: 0;
  font-size: var(--invite-title-size);
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.25;
  background-image: linear-gradient(to right, #ffffff 0%, #7ef0ff 7%, var(--invite-cyan) 100%);
  background-color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.invite-page__subtitle {
  margin: 8px 0 0;
  max-width: 34em;
  color: var(--invite-muted);
  font-size: var(--invite-subtitle-size);
  line-height: 1.5;
}

.invite-page__pic-wrap {
  flex: 0 0 auto;
  width: var(--invite-pic-w);
  height: var(--invite-pic-h);
  margin-top: -4px;
  align-self: flex-start;
}

.invite-page__pic {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.invite-page__card {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: var(--invite-card-pad-y) var(--invite-card-pad-x);
  border: 1px solid #131622;
  border-radius: 12px;
  background: var(--invite-card-bg);
}

.invite-page__card--state {
  color: var(--invite-muted);
  font-size: 14px;
  text-align: center;
  padding: 36px 16px;
}

.invite-page__card--error {
  color: #ff7b7b;
}

.invite-page__card-label {
  margin-bottom: 12px;
  color: #fff;
  font-size: var(--invite-label-size);
  font-weight: 500;
  line-height: 1.3;
}

.invite-page__code-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.invite-page__code-box {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  flex: 1 1 auto;
  min-width: 0;
  height: var(--invite-code-h);
  padding: 0 16px;
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 8px;
  background: rgba(17, 22, 33, 1);
}

.invite-page__code {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--invite-cyan);
  font-size: var(--invite-code-size);
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1;
}

.invite-page__code-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #878895;
  font-size: 16px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.invite-page__code-copy:hover:not(:disabled) {
  color: var(--invite-cyan);
  background: rgba(74, 231, 253, 0.08);
}

.invite-page__code-copy:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.invite-page__link-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: var(--invite-btn-w);
  height: var(--invite-code-h);
  padding: 0 12px;
  border: 1px solid rgba(74, 231, 253, 0.55);
  border-radius: 8px;
  background: #121212;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.invite-page__link-btn-text {
  font-size: 16px;
  line-height: 1;
  white-space: nowrap;
  background: linear-gradient(90deg, #ffffff 0%, var(--invite-cyan) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.invite-page__link-btn:hover:not(:disabled) {
  border-color: var(--invite-cyan);
  background: rgba(74, 231, 253, 0.06);
}

.invite-page__link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.invite-page__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 32px;
  margin-top: 16px;
}

.invite-page__stat {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: #fff;
  font-size: 14px;
  line-height: 1.2;
}

.invite-page__stat-label {
  color: #fff;
}

.invite-page__stat-num {
  color: #fff;
  font-size: 24px;
  font-weight: 500;
  line-height: 1;
  margin-left: 24px;
}

.invite-page__stat-unit {
  color: var(--invite-muted);
  font-size: 12px;
}

.invite-page__records {
  margin-top: var(--invite-gap);
  min-width: 0;
}

.invite-page__records-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  margin-bottom: 12px;
}

.invite-page__records-title {
  margin: 0;
  color: #fff;
  font-size: var(--invite-section-title);
  font-weight: 500;
  line-height: 1.3;
}

.invite-page__records-meta {
  color: var(--invite-muted);
  font-size: 14px;
  line-height: 1.3;
}

.invite-page__table {
  width: 100%;
  min-width: 0;
}

.invite-page__thead,
.invite-page__tr {
  display: grid;
  grid-template-columns: 72px minmax(120px, 1.2fr) minmax(120px, 1fr) minmax(88px, 0.6fr);
  align-items: center;
  column-gap: 12px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0 16px;
}

.invite-page__thead {
  height: var(--invite-head-h);
  border-radius: 8px 8px 0 0;
  background: transparent;
  border: 1px solid rgba(74,231,253,0.3);
}

.invite-page__th {
  color: var(--invite-muted);
  font-size: 14px;
  line-height: 1;
  white-space: nowrap;
}

.invite-page__tr {
  height: var(--invite-row-h);
  margin-top: 4px;
  border-radius: 6px;
  background: var(--invite-row-bg);
}

.invite-page__tr.is-alt {
  background: rgba(32, 36, 52, 0.5);
}

.invite-page__td {
  min-width: 0;
  color: #fff;
  font-size: 14px;
  line-height: 1;
}

.invite-page__col-index {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
}

.invite-page__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, #3d7cff 0%, #1a4fd6 100%);
  color: #fff;
  font-size: 12px;
  line-height: 1;
}

.invite-page__col-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.invite-page__avatar {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(0, 0, 0, 0.25);
}

.invite-page__user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invite-page__col-time {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.invite-page__col-points {
  text-align: left;
}

.invite-page__state {
  padding: 48px 16px;
  text-align: center;
  color: var(--invite-muted);
  font-size: 14px;
}

.invite-page__state--table {
  padding: 40px 16px;
}

.invite-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 56px 16px 40px;
}

.invite-page__empty-icon {
  opacity: 0.85;
}

.invite-page__empty-text {
  margin: 0;
  color: var(--invite-muted);
  font-size: 14px;
  line-height: 1.3;
}

.invite-page__more {
  margin-top: 16px;
  text-align: center;
}

@media (max-width: 1440px) {
  .invite-page {
    --invite-title-size: 28px;
    --invite-code-size: 28px;
    --invite-label-size: 16px;
    --invite-code-h: 48px;
    --invite-btn-w: 108px;
    --invite-card-pad-x: 20px;
    --invite-card-pad-y: 18px;
    --invite-pic-w: 240px;
    --invite-pic-h: 208px;
    --invite-top-gap: 16px;
  }

  .invite-page__link-btn-text {
    font-size: 14px;
  }

  .invite-page__thead,
  .invite-page__tr {
    grid-template-columns: 56px minmax(100px, 1.2fr) minmax(100px, 1fr) minmax(72px, 0.55fr);
    padding: 0 12px;
  }
}

@media (max-width: 1200px) {
  .invite-page {
    --invite-pic-w: 200px;
    --invite-pic-h: 173px;
  }

  .invite-page__top {
    gap: 16px 24px;
  }
}

@media (max-width: 960px) {
  .invite-page {
    --invite-title-size: 24px;
    --invite-subtitle-size: 13px;
    --invite-section-title: 16px;
    --invite-code-size: 22px;
    --invite-label-size: 15px;
    --invite-code-h: 44px;
    --invite-btn-w: 100%;
    --invite-row-h: 44px;
    --invite-gap: 20px;
    --invite-pic-w: min(220px, 48vw);
    --invite-pic-h: auto;
  }

  .invite-page__top {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .invite-page__pic-wrap {
    width: var(--invite-pic-w);
    height: auto;
    aspect-ratio: 310 / 268;
    margin: 0 auto;
  }

  .invite-page__code-row {
    flex-wrap: wrap;
  }

  .invite-page__link-btn {
    width: 100%;
  }

  .invite-page__thead,
  .invite-page__tr {
    grid-template-columns: 40px minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.7fr);
    column-gap: 8px;
    padding: 0 10px;
  }

  .invite-page__th,
  .invite-page__td {
    font-size: 12px;
  }

  .invite-page__col-time {
    font-size: 11px;
  }
}
</style>
