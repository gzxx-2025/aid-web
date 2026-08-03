<template>
  <div class="home-new-sub-page help-center-page">
    <div class="page-content help-center-page__inner">
      <header class="help-center-page__header">
        <h1 class="help-center-page__title">常见问题</h1>
        <p class="help-center-page__subtitle">查找使用说明与解答，快速上手创作流程</p>
      </header>

      <div class="help-center-page__main">
        <div class="help-center-page__search">
          <SearchOutlined class="help-center-page__search-ico" />
          <input
            v-model="keyword"
            type="search"
            class="help-center-page__search-input"
            placeholder="搜索资产…"
            @keydown.enter.prevent="reloadAll"
          />
        </div>

        <div class="help-center-page__body">
          <nav class="help-center-page__categories" aria-label="问题分类">
            <div v-if="loading && !allItems.length" class="help-center-page__side-state">加载中…</div>
            <div v-else-if="loadError" class="help-center-page__side-state help-center-page__side-state--error">
              加载失败，请稍后重试
            </div>
            <div v-else-if="!categories.length" class="help-center-page__side-state">暂无分类</div>

            <button
              v-for="cat in categories"
              :key="cat"
              type="button"
              class="help-center-page__category"
              :class="{ 'is-active': activeCategory === cat }"
              @click="selectCategory(cat)"
            >
              <span class="help-center-page__category-label">{{ cat }}</span>
              <RightOutlined class="help-center-page__category-arrow" />
            </button>
          </nav>

          <section class="help-center-page__answers" aria-label="问题解答">
            <div v-if="loading && !allItems.length" class="help-center-page__answers-state">加载中…</div>
            <div v-else-if="loadError" class="help-center-page__answers-state help-center-page__answers-state--error">
              加载失败，请稍后重试
            </div>
            <div v-else-if="!activeCategory" class="help-center-page__answers-state">请从左侧选择分类</div>
            <div v-else-if="!categoryItems.length" class="help-center-page__answers-state">暂无相关问题</div>
            <div v-else-if="detailsLoading && !hasLoadedDetails" class="help-center-page__answers-state">加载详情中…</div>

            <div v-else class="help-center-page__qa-list">
              <article
                v-for="(item, index) in categoryItems"
                :key="item.id"
                class="help-center-page__qa-item"
              >
                <h2 class="help-center-page__qa-question">
                  {{ index + 1 }}、{{ item.title }}
                </h2>
                <div
                  class="help-center-page__qa-answer"
                  v-html="getAnswerHtml(item.id)"
                />
              </article>
            </div>
          </section>
        </div>

        <footer class="help-center-page__footer">
          <div class="help-center-page__qrcode-wrap">
            <img
              v-if="exchangeImageUrl"
              :src="exchangeImageUrl"
              alt="客服二维码"
              class="help-center-page__qrcode"
            />
            <div v-else class="help-center-page__qrcode help-center-page__qrcode--placeholder" />
          </div>
          <p class="help-center-page__qrcode-label">扫码加客服</p>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { SearchOutlined, RightOutlined } from '@ant-design/icons-vue'
import { useAuthPublicConfig } from '~/composables/useAuthPublicConfig'
import { userFaqDetail, userFaqList } from '~/utils/businessApi'
import type { UserFaqDetail, UserFaqListItem } from '~/types/business-api'
import { sanitizeDisplayHtml } from '~/utils/safeDisplayHtml'

const { exchangeImageUrl, loadPublicConfig } = useAuthPublicConfig()

const keyword = ref('')
const activeCategory = ref('')
const allItems = ref<UserFaqListItem[]>([])
const loading = ref(false)
const loadError = ref(false)
const detailsLoading = ref(false)
const detailCache = ref<Map<number, UserFaqDetail>>(new Map())
const MAX_FAQ_LIST_PAGES = 100
let listLoadGeneration = 0
let detailLoadGeneration = 0

const categories = computed(() => {
  const orderMap = new Map<string, number>()
  for (const item of allItems.value) {
    const cat = itemCategory(item)
    const sort = item.sortOrder ?? Number.MAX_SAFE_INTEGER
    const prev = orderMap.get(cat)
    if (prev == null || sort < prev) orderMap.set(cat, sort)
  }
  return [...orderMap.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .map(([cat]) => cat)
})

const categoryItems = computed(() => {
  if (!activeCategory.value) return []
  return allItems.value.filter((item) => itemCategory(item) === activeCategory.value)
})

const hasLoadedDetails = computed(() =>
  categoryItems.value.some((item) => detailCache.value.has(item.id))
)

function itemCategory(item: UserFaqListItem) {
  const cat = String(item.category || '').trim()
  return cat || '其他'
}

function getAnswerHtml(id: number) {
  const detail = detailCache.value.get(id)
  const raw = String(detail?.content || '').trim()
  if (!raw) return '<p>暂无内容</p>'
  return sanitizeDisplayHtml(raw)
}

async function loadAllItems() {
  const generation = ++listLoadGeneration
  loading.value = true
  loadError.value = false
  try {
    const merged: UserFaqListItem[] = []
    let pageNum = 1
    let hasMore = true
    while (hasMore && pageNum <= MAX_FAQ_LIST_PAGES) {
      const page = await userFaqList({
        pageNum,
        pageSize: 50,
        keyword: keyword.value.trim() || undefined
      })
      if (generation !== listLoadGeneration) return
      if (!page.rows.length) break
      merged.push(...page.rows)
      hasMore = page.hasMore
      pageNum += 1
    }
    if (generation !== listLoadGeneration) return
    allItems.value = merged
    ensureActiveCategory()
  } catch {
    if (generation !== listLoadGeneration) return
    allItems.value = []
    loadError.value = true
  } finally {
    if (generation === listLoadGeneration) loading.value = false
  }
}

function ensureActiveCategory() {
  if (!categories.value.length) {
    activeCategory.value = ''
    return
  }
  if (!activeCategory.value || !categories.value.includes(activeCategory.value)) {
    activeCategory.value = categories.value[0]
  }
}

async function loadCategoryDetails() {
  const generation = ++detailLoadGeneration
  const items = categoryItems.value
  const toFetch = items.filter((item) => !detailCache.value.has(item.id))
  if (!toFetch.length) return

  detailsLoading.value = true
  try {
    const results = await Promise.allSettled(
      toFetch.map(async (item) => {
        const detail = await userFaqDetail({ id: item.id })
        return { id: item.id, detail }
      })
    )
    if (generation !== detailLoadGeneration) return
    const nextCache = new Map(detailCache.value)
    let failed = false
    for (const result of results) {
      if (result.status === 'fulfilled') {
        nextCache.set(result.value.id, result.value.detail)
      } else {
        failed = true
      }
    }
    detailCache.value = nextCache
    if (failed) message.error('部分问题详情加载失败')
  } finally {
    if (generation === detailLoadGeneration) detailsLoading.value = false
  }
}

function selectCategory(cat: string) {
  activeCategory.value = cat
}

function reloadAll() {
  detailCache.value = new Map()
  void loadAllItems()
}

let keywordTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    keywordTimer = null
    detailCache.value = new Map()
    void loadAllItems()
  }, 320)
})

watch(categoryItems, () => {
  void loadCategoryDetails()
})

onMounted(() => {
  void loadAllItems()
  void loadPublicConfig()
})

onBeforeUnmount(() => {
  listLoadGeneration += 1
  detailLoadGeneration += 1
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = null
})
</script>

<style scoped lang="scss">
.help-center-page {
  --help-accent: #4ae7fd;
  --help-muted: #8e97a5;
  --help-bg-main: #121212;
  --help-category-active: #202839;
  --help-category-default: #161c28;
  --help-panel: #202839;
  --help-border: rgba(74, 231, 253, 0.08);
  --help-search-bg: #0a121e;
  --help-search-border: #073f56;
  width: 100%;
  flex: 1 0 auto;
  min-width: 0;
  box-sizing: border-box;
}

.help-center-page__inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 16px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.help-center-page__header {
  flex-shrink: 0;
}

.help-center-page__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  line-height: 24px;
  letter-spacing: 0.02em;
}

.help-center-page__subtitle {
  margin: 8px 0 0;
  color: var(--help-muted);
  font-size: 14px;
  line-height: 20px;
}

.help-center-page__search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border-radius: 4px;
  background: var(--help-search-bg);
  border: 1px solid var(--help-search-border);
  flex-shrink: 0;
}

.help-center-page__search-ico {
  color: var(--help-muted);
  font-size: 16px;
  flex-shrink: 0;
}

.help-center-page__search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #fff;
  font-size: 14px;
  line-height: 20px;

  &::placeholder {
    color: var(--help-muted);
  }
}

.help-center-page__main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 12px 20px;
  border-radius: 4px;
  background: var(--help-bg-main);
  box-sizing: border-box;
}

.help-center-page__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 358px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.help-center-page__categories {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.help-center-page__category {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 56px;
  padding: 0 16px 0 24px;
  border: 1px solid var(--help-border);
  border-radius: 4px;
  background: var(--help-category-default);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.help-center-page__category.is-active {
  background: var(--help-category-active);
}

.help-center-page__category:hover {
  background: var(--help-category-active);
}

.help-center-page__category-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.help-center-page__category-arrow {
  flex-shrink: 0;
  font-size: 12px;
  color: #fff;
}

.help-center-page__side-state {
  padding: 24px 16px;
  text-align: center;
  color: var(--help-muted);
  font-size: 14px;
}

.help-center-page__side-state--error {
  color: #fca5a5;
}

.help-center-page__answers {
  min-height: 598px;
  min-width: 0;
  padding: 24px;
  border-radius: 4px;
  background: var(--help-panel);
  border: 1px solid var(--help-border);
  box-sizing: border-box;
}

.help-center-page__answers-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  color: var(--help-muted);
  font-size: 14px;
}

.help-center-page__answers-state--error {
  color: #fca5a5;
}

.help-center-page__qa-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.help-center-page__qa-item {
  margin: 0;
}

.help-center-page__qa-question {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  color: #fff;
}

.help-center-page__qa-answer {
  margin: 12px 0 0;
  padding-left: 23px;
  color: var(--help-muted);
  font-size: 14px;
  line-height: 20px;
}

.help-center-page__qa-answer :deep(p) {
  margin: 0;
}

.help-center-page__qa-answer :deep(a),
.help-center-page__qa-answer :deep(strong),
.help-center-page__qa-answer :deep(span.highlight) {
  color: var(--help-accent);
}

.help-center-page__footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-top: 16px;
}

.help-center-page__qrcode-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-center-page__qrcode {
  display: block;
  width: 120px;
  height: 120px;
  border-radius: 4px;
  object-fit: contain;
}

.help-center-page__qrcode--placeholder {
  background: #d9d9d9;
}

.help-center-page__qrcode-label {
  margin: 0;
  font-size: 20px;
  font-weight: 400;
  line-height: 32px;
  color: var(--help-muted);
  text-align: center;
}

@media (max-width: 960px) {
  .help-center-page__body {
    grid-template-columns: 1fr;
  }

  .help-center-page__answers {
    min-height: 320px;
  }
}
</style>
