<template>
  <div class="home-new-sub-page billing-page">
    <div class="page-content billing-page__inner">
      <header class="billing-page__header">
        <h1 class="billing-page__title">计费说明</h1>
        <p class="billing-page__subtitle">
          以下为各 AI 模型实时计费规则，单位：{{ creditUnit }}
        </p>
      </header>

      <div class="billing-page__toolbar">
        <div class="billing-page__tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            role="tab"
            class="billing-page__tab"
            :class="{ 'is-active': activeTab === tab.value }"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="billing-page__search">
          <SearchOutlined class="billing-page__search-ico" />
          <input
            v-model="keyword"
            type="search"
            class="billing-page__search-input"
            placeholder="搜索模型名称..."
          />
        </div>
      </div>

      <div v-if="loading" class="billing-page__state">加载计费详情中…</div>
      <div v-else-if="loadError" class="billing-page__state billing-page__state--error">加载失败，请稍后重试</div>
      <div v-else-if="visibleModels.length === 0" class="billing-page__state">暂无匹配的计费模型</div>

      <div v-else class="billing-page__cards">
        <article
          v-for="model in visibleModels"
          :key="`${model.modelCode}-${model.id}`"
          class="billing-page__card"
        >
          <header class="billing-page__card-head">
            <div class="billing-page__model-brand">
              <div class="billing-page__model-logo">
                <img
                  v-if="model.providerLogo"
                  :src="model.providerLogo"
                  :alt="model.providerName || model.modelName"
                />
                <span v-else>{{ (model.modelName || 'M').slice(0, 1) }}</span>
              </div>
              <div class="billing-page__model-meta">
                <h2 class="billing-page__model-name">{{ model.modelName }}</h2>
                <p class="billing-page__model-provider">
                  {{ model.providerName || model.modelTypeName || model.modelType || '—' }}
                </p>
              </div>
            </div>
            <div class="billing-page__model-tags">
              <span v-if="model.meterTypeName" class="billing-page__tag">{{ model.meterTypeName }}</span>
              <span v-if="model.generateMode" class="billing-page__tag billing-page__tag--muted">{{ model.generateMode }}</span>
            </div>
          </header>

          <p v-if="model.billingDesc" class="billing-page__card-desc">{{ model.billingDesc }}</p>

          <div v-if="hasInputPricing(model)" class="billing-page__input-pricing">
            <p class="billing-page__input-pricing-title">输入媒体计费（可能产生额外费用）</p>
            <ul class="billing-page__input-pricing-list">
              <li v-if="model.inputPricing?.imageSupported">
                图片输入：{{ formatInputPrice(model.inputPricing?.imageUnitPrice, '张')
                }}<span v-if="model.inputPricing?.imageMaxCount != null">
                  ，上限 {{ model.inputPricing.imageMaxCount }} 张</span
                >
              </li>
              <li v-if="model.inputPricing?.videoSupported">
                视频输入：{{ formatInputPrice(model.inputPricing?.videoUnitPrice, '秒')
                }}<span v-if="model.inputPricing?.videoMaxSeconds != null">
                  ，时长上限 {{ model.inputPricing.videoMaxSeconds }} 秒</span
                ><span v-if="model.inputPricing?.videoMaxCount != null">
                  ，段数上限 {{ model.inputPricing.videoMaxCount }}</span
                >
              </li>
            </ul>
          </div>

          <div class="billing-page__table-wrap">
            <table class="billing-page__table">
              <thead>
                <tr>
                  <th v-for="col in model.columns" :key="col.key">
                    {{ col.label }}<span v-if="col.unit" class="billing-page__th-unit">（{{ col.unit }}）</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(rule, idx) in model.rules" :key="`${model.modelCode}-rule-${idx}`">
                  <td v-for="col in model.columns" :key="`${col.key}-${idx}`">
                    {{ formatBillingCell(rule, col) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="model.remark" class="billing-page__card-remark">{{ model.remark }}</p>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { publicBillingDetail } from '~/utils/businessApi'
import type { BillingColumnVO, BillingRuleItemVO, ModelBillingDetailVO, PublicBillingDetailData } from '~/types/business-api'

type BillingTab = 'all' | 'text' | 'image' | 'video' | 'audio'

const tabs = [
  { label: '全部', value: 'all' as BillingTab },
  { label: '文本', value: 'text' as BillingTab },
  { label: '图片', value: 'image' as BillingTab },
  { label: '视频', value: 'video' as BillingTab },
  { label: '配音', value: 'audio' as BillingTab }
]

const activeTab = ref<BillingTab>('all')
const keyword = ref('')
const loading = ref(false)
const loadError = ref(false)
const billingData = ref<PublicBillingDetailData | null>(null)

const creditUnit = computed(() => billingData.value?.creditUnit || 'Credits')

const allModels = computed<ModelBillingDetailVO[]>(() => {
  const data = billingData.value
  if (!data) return []
  return [...data.llm, ...data.image, ...data.video, ...data.voice]
})

const visibleModels = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return allModels.value.filter((model) => {
    if (activeTab.value !== 'all') {
      const type = String(model.modelType || '').toLowerCase()
      if (activeTab.value === 'audio' && type !== 'audio') return false
      if (activeTab.value !== 'audio' && type !== activeTab.value) return false
    }
    if (!kw) return true
    const name = String(model.modelName || '').toLowerCase()
    const code = String(model.modelCode || '').toLowerCase()
    return name.includes(kw) || code.includes(kw)
  })
})

function formatBillingCell(rule: BillingRuleItemVO, col: BillingColumnVO) {
  const value = (rule as Record<string, unknown>)[col.key]
  if (value == null || value === '') return '—'
  if (col.type === 'number') {
    const num = Number(value)
    return Number.isFinite(num) ? String(num) : String(value)
  }
  return String(value)
}

function hasInputPricing(model: ModelBillingDetailVO) {
  const p = model.inputPricing
  if (!p) return false
  return Boolean(p.imageSupported || p.videoSupported)
}

function formatInputPrice(unitPrice: number | null | undefined, unit: string) {
  const n = Number(unitPrice)
  if (!Number.isFinite(n) || n <= 0) return '免费'
  return `${n} ${creditUnit.value}/${unit}`
}

async function loadBilling() {
  loading.value = true
  loadError.value = false
  try {
    billingData.value = await publicBillingDetail({
      modelType: activeTab.value === 'all' ? undefined : activeTab.value,
      modelName: keyword.value.trim() || undefined
    })
  } catch {
    loadError.value = true
    billingData.value = null
  } finally {
    loading.value = false
  }
}

let keywordTimer: ReturnType<typeof setTimeout> | null = null
watch([activeTab, keyword], () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    keywordTimer = null
    void loadBilling()
  }, 320)
})

onMounted(() => {
  void loadBilling()
})
</script>

<style scoped lang="scss">
.billing-page {
  --billing-accent: #4ae7fd;
  --billing-muted: #8e97a5;
  --billing-surface: rgba(22, 28, 40, 0.92);
  --billing-border: rgba(255, 255, 255, 0.08);
  width: 100%;
  flex: 1 0 auto;
  min-width: 0;
  box-sizing: border-box;
}

.billing-page__inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.billing-page__title {
  margin: 0;
  font-size:20px;
  font-weight: 700;
  color: #fff;
}

.billing-page__subtitle {
  margin: 8px 0 0;
  color: var(--billing-muted);
  font-size: 14px;
}

.billing-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.billing-page__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.billing-page__tab {
  height: 34px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid var(--billing-border);
  background: transparent;
  color: #c9d1d9;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.billing-page__tab.is-active,
.billing-page__tab:hover {
  border-color: rgba(74, 231, 253, 0.45);
  color: var(--billing-accent);
  background: rgba(74, 231, 253, 0.08);
}

.billing-page__search {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  height: 42px;
  padding: 0 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--billing-border);
}

.billing-page__search-ico {
  color: var(--billing-muted);
}

.billing-page__search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #fff;
  font-size: 14px;
}

.billing-page__state {
  padding: 48px 20px;
  text-align: center;
  color: var(--billing-muted);
}

.billing-page__state--error {
  color: #fca5a5;
}

.billing-page__cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

.billing-page__card {
  border-radius: 14px;
  background: var(--billing-surface);
  border: 1px solid var(--billing-border);
  padding: 20px;
  animation: billing-card-in 0.32s ease both;
}

@keyframes billing-card-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.billing-page__card-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.billing-page__model-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.billing-page__model-logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 231, 253, 0.12);
  color: var(--billing-accent);
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}

.billing-page__model-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.billing-page__model-name {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.billing-page__model-provider {
  margin: 4px 0 0;
  color: var(--billing-muted);
  font-size: 13px;
}

.billing-page__model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.billing-page__tag {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(74, 231, 253, 0.12);
  color: var(--billing-accent);
  font-size: 12px;
}

.billing-page__tag--muted {
  background: rgba(255, 255, 255, 0.06);
  color: #c9d1d9;
}

.billing-page__card-desc {
  margin: 14px 0 0;
  color: #c9d1d9;
  font-size: 13px;
  line-height: 1.6;
}

.billing-page__input-pricing {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(74, 231, 253, 0.06);
  border: 1px solid rgba(74, 231, 253, 0.12);
}

.billing-page__input-pricing-title {
  margin: 0;
  font-size: 13px;
  color: var(--billing-accent);
  font-weight: 600;
}

.billing-page__input-pricing-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #c9d1d9;
  font-size: 12px;
  line-height: 1.7;
}

.billing-page__table-wrap {
  margin-top: 16px;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.billing-page__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 520px;
}

.billing-page__table th,
.billing-page__table td {
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.billing-page__table th {
  background: rgba(255, 255, 255, 0.03);
  color: #eef2f7;
  font-weight: 600;
  white-space: nowrap;
}

.billing-page__table td {
  color: #d7dee8;
}

.billing-page__th-unit {
  color: var(--billing-muted);
  font-weight: 400;
}

.billing-page__card-remark {
  margin: 12px 0 0;
  color: var(--billing-muted);
  font-size: 12px;
}
</style>
