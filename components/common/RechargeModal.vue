<template>
  <!-- 第一步：选套餐（支付渠道在扫码弹窗内切换） -->
  <a-modal
    :open="open"
    :width="'58%'"
    :footer="null"
    centered
    class="recharge-modal recharge-modal-branded recharge-main-modal"
    wrap-class-name="create-flow-modal recharge-modal-wrap"
    :z-index="1000"
    @cancel="handleClose"
  >
    <template #title>
      <ModalTitleWatermark title="充值中心" watermark="REFILL" />
    </template>

    <div class="recharge-modal__body recharge-modal__body--step1">
      <div
        class="recharge-modal__profile"
        :class="{ 'recharge-modal__profile--guest': !rechargeProfileLoggedIn }"
      >
        <div class="recharge-modal__profile-avatar" aria-hidden="true">
          <img src="/assets/img/home/Group-avtor.svg" alt="" width="48" height="48" />
        </div>
        <div class="recharge-modal__profile-text">
          <div class="recharge-modal__profile-name" :title="rechargeProfileTooltip">
            {{ rechargeProfileNameLine }}
          </div>
          <p class="recharge-modal__profile-desc">购买credits，解锁更多创作能力</p>
        </div>
      </div>

      <div class="recharge-modal__packages">
        <div v-for="pkg in packages" :key="pkg.id" class="recharge-package">
          <div class="recharge-package__inner">
            <div class="recharge-package__text">
              <div class="recharge-package__price-block">
                <span class="recharge-package__price">¥ {{ formatPrice(pkg.payPrice) }}</span>
                <span v-if="pkg.originalPrice > pkg.payPrice" class="recharge-package__origin">
                  ¥ {{ formatPrice(pkg.originalPrice) }}
                </span>
              </div>
              <span class="recharge-package__points"
                >获得 <span>{{ pkg.credits }}</span> credits</span
              >
              <div class="recharge-package__grow" aria-hidden="true" />
            </div>
            <button
              type="button"
              class="recharge-package__buy"
              :disabled="buyingPackageId === pkg.id"
              @click="handleBuyNow(pkg)"
            >
              {{ buyingPackageId === pkg.id ? '处理中…' : '立即购买' }}
            </button>
          </div>
        </div>
      </div>

      <footer class="recharge-modal__footer-bottom">
        <div class="recharge-modal__footer-links">
          <button type="button" class="recharge-modal__footer-link" @click="showOrders = true">
            订单管理
          </button>
          <span class="recharge-modal__footer-divider" aria-hidden="true">|</span>
          <button type="button" class="recharge-modal__footer-link" @click="openRechargeFaq">
            常见问题
          </button>
        </div>
        <p class="recharge-modal__footer-agree">
          <span class="recharge-modal__footer-agree-text">购买前请阅读并同意</span>
          <button
            type="button"
            class="recharge-modal__footer-agree-link"
            @click="openMemberAgreement"
          >
            《会员协议》
          </button>
        </p>
      </footer>
    </div>

    <a-drawer
      v-model:open="showOrders"
      title="订单管理"
      width="520"
      :mask-closable="true"
      class="recharge-order-drawer"
    >
      <div class="order-toolbar">
        <a-button :loading="ordersLoading" @click="loadOrders">刷新</a-button>
      </div>
      <a-tabs v-model:activeKey="orderTab" class="order-status-tabs" @change="loadOrders">
        <a-tab-pane key="all" tab="全部" />
        <a-tab-pane key="pending" tab="待支付" />
        <a-tab-pane key="paid" tab="已支付" />
        <a-tab-pane key="closed" tab="已取消" />
      </a-tabs>
      <div v-if="orders.length === 0" class="order-empty">暂无订单</div>
      <div v-else class="order-list">
        <div
          v-for="row in orders"
          :key="row.orderNo"
          class="order-card"
          :class="{ 'order-card--highlight': highlightOrderNo === row.orderNo }"
          :data-order-no="row.orderNo"
        >
          <div class="order-card__title">{{ row.productName }}</div>
          <div class="order-card__meta">订单号：{{ row.orderNo }}</div>
          <div class="order-card__meta">金额：￥{{ row.payPrice }}</div>
          <div class="order-card__meta">状态：{{ formatPayStatus(row.payStatus) }}</div>
          <div
            v-if="row.payStatus === 'pending'"
            class="order-card__actions order-card__actions--pay"
          >
            <a-button
              type="primary"
              size="small"
              :loading="repayingOrderNo === row.orderNo"
              @click="handleRepay(row)"
            >
              立即支付
            </a-button>
            <a-button
              size="small"
              danger
              :loading="cancellingOrderNo === row.orderNo"
              @click="handleCancelOrder(row.orderNo)"
            >
              取消支付
            </a-button>
          </div>
        </div>
      </div>
    </a-drawer>
  </a-modal>

  <!-- 第二步：扫码支付（无标题栏，金额摘要 + 支付方式图标 + 二维码） -->
  <a-modal
    :open="showPayModal"
    :width="'34%'"
    :footer="null"
    :title="null"
    :closable="false"
    centered
    class="recharge-modal recharge-modal-branded recharge-pay-modal"
    wrap-class-name="create-flow-modal recharge-modal-wrap recharge-pay-modal-wrap"
    :mask-style="rechargePayModalMaskStyle"
    :z-index="1100"
    :mask-closable="false"
    @cancel="handlePayModalClose"
  >
    <div class="recharge-pay-modal__body">
      <button
        type="button"
        class="recharge-pay-modal__close"
        aria-label="关闭"
        @click="handlePayModalClose"
      >
        <span aria-hidden="true">×</span>
      </button>

      <div class="recharge-pay-modal__summary">
        <div class="recharge-pay-modal__summary-amount">
          <span class="recharge-pay-modal__summary-label">支付金额：¥</span>
          <span class="recharge-pay-modal__summary-num">{{ payModalAmountText }}</span>
          <span class="recharge-pay-modal__summary-yuan">元</span>
        </div>
        <ul class="recharge-pay-modal__summary-list">
          <li>· 商品内容：{{ payModalCreditsDisplay }} Credits</li>
          <li>· 商品数量：1个</li>
          <li>· 商品单价：¥{{ payModalUnitPrice }}</li>
        </ul>
      </div>

      <div class="recharge-pay-modal__pay-row">
        <span class="recharge-pay-modal__pay-label">支付方式</span>
        <div class="recharge-pay-modal__methods">
          <button
            type="button"
            :class="[
              'recharge-pay-method',
              { 'recharge-pay-method--active': payType === 'alipay' }
            ]"
            @click="payType = 'alipay'"
          >
            <img :src="iconZfg" alt="" class="recharge-pay-method__icon" width="22" height="22" />
            支付宝
          </button>
          <button
            type="button"
            :class="['recharge-pay-method', { 'recharge-pay-method--active': payType === 'wxpay' }]"
            @click="payType = 'wxpay'"
          >
            <img :src="iconWxPay" alt="" class="recharge-pay-method__icon" width="22" height="22" />
            微信支付
          </button>
        </div>
      </div>

      <p class="recharge-pay-modal__lead-hint">
        {{ payType === 'wxpay' ? '请使用微信扫码支付' : '请使用支付宝扫码支付' }}
      </p>

      <div
        class="recharge-modal__qr-wrap recharge-modal__qr-wrap--pay"
        :class="{ 'recharge-modal__qr-wrap--expired': showRefreshQrButton }"
      >
        <template v-if="qrImageSrc">
          <img :src="qrImageSrc" alt="支付二维码" class="recharge-modal__qr" />
          <div class="recharge-modal__scan-line" aria-hidden="true" />
          <button
            v-if="showRefreshQrButton"
            type="button"
            class="recharge-pay-qr-refresh-overlay"
            :disabled="creatingOrder"
            :aria-busy="creatingOrder"
            @click="handleRefreshQr"
          >
            <span class="recharge-pay-qr-refresh-overlay__text">{{
              creatingOrder ? '刷新中…' : '刷新二维码'
            }}</span>
          </button>
        </template>
        <div v-else class="recharge-modal__qr-empty">
          {{ creatingOrder ? '正在生成支付二维码…' : '请稍候' }}
        </div>
      </div>

      <p class="recharge-pay-modal__disclaimer">充值包服务属于虚拟商品，不支持无理由退款</p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import type {
  RechargePackageItem,
  RechargeOrderCreateData,
  RechargeOrderRow
} from '~/types/business-api'
import {
  rechargePackageList,
  rechargeOrderCancel,
  rechargeOrderCreate,
  rechargeOrderList,
  rechargeOrderQuery,
  rechargeOrderRepay
} from '~/utils/businessApi'
import { payQrToImageSrc } from '~/utils/payQrImage'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
/** 扫码弹窗：微信（资源文件名为 wx-icon.svg，与稿 we-icon 对应） */
import iconWxPay from '~/assets/img/icon/wx-icon.svg'
import iconZfg from '~/assets/img/icon/zfg-icon.svg'

const userStore = useUserStore()

/** 第二步扫码支付弹窗蒙层毛玻璃（第一步充值中心不加） */
const rechargePayModalMaskStyle: CSSProperties = {
  WebkitBackdropFilter: 'blur(10px)',
  backdropFilter: 'blur(10px)',
  backgroundColor: 'rgba(8, 12, 22, 0.52)'
}

const rechargeProfileLoggedIn = computed(() => !!userStore.token)

/** 主标题：优先展示 username（与 localStorage user-info 一致） */
const rechargeProfileNameLine = computed(() => {
  if (!rechargeProfileLoggedIn.value) return '未登录'
  const u = userStore.user
  if (!u) return '用户'
  const name = u.username?.trim()
  if (name) return name
  if (u.email?.trim()) return u.email.trim()
  if (u.id) return `ID${u.id}`
  return '用户'
})

/** 悬停完整信息：便于区分同名或核对账号 */
const rechargeProfileTooltip = computed(() => {
  const u = userStore.user
  if (!u) return ''
  const parts: string[] = []
  if (u.username?.trim()) parts.push(u.username.trim())
  if (u.id) parts.push(`ID${u.id}`)
  if (u.email?.trim()) parts.push(u.email.trim())
  return parts.join(' · ')
})

interface Props {
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  paid: []
}>()

const router = useRouter()

function openRechargeFaq() {
  emit('update:open', false)
  router.push('/about#faq')
}

function openMemberAgreement() {
  emit('update:open', false)
  router.push('/about')
}

const packages = ref<RechargePackageItem[]>([])
const selectedPackageId = ref<number | null>(null)
const payType = ref<'wxpay' | 'alipay'>('alipay')
const creatingOrder = ref(false)

const showPayModal = ref(false)
/** 正在发起「立即购买」的套餐 id */
const buyingPackageId = ref<number | null>(null)

const qrImageSrc = ref('')
const currentOrderNo = ref('')
const currentAmount = ref<number | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null
let qrSeq = 0

const selectedPackage = computed(
  () => packages.value.find((p) => p.id === selectedPackageId.value) ?? null
)

const showOrders = ref(false)
/** 订单列表筛选：与接口 payStatus 对应，全部不传 */
const orderTab = ref<'all' | 'pending' | 'paid' | 'closed'>('all')
const orders = ref<RechargeOrderRow[]>([])
const ordersLoading = ref(false)
const repayingOrderNo = ref('')
const cancellingOrderNo = ref('')
/** 订单列表中高亮（去支付跳转） */
const highlightOrderNo = ref('')
/** 从订单管理「立即支付」进入扫码页时携带的订单行（用于金额/Credits 展示，因未选套餐） */
const repayOrderRow = ref<RechargeOrderRow | null>(null)
/** 二维码有效期内不展示「刷新」，过期后展示 */
const showRefreshQrButton = ref(false)
let qrExpiryTimer: ReturnType<typeof setTimeout> | null = null

function formatPrice(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '--'
  if (Number.isInteger(x)) return String(x)
  const t = x.toFixed(2)
  return t.replace(/\.?0+$/, '')
}

/** 扫码弹窗内展示金额（下单后以订单为准） */
const payModalAmountText = computed(() => {
  if (currentAmount.value != null && !Number.isNaN(Number(currentAmount.value))) {
    return String(currentAmount.value)
  }
  if (repayOrderRow.value) {
    return formatPrice(Number(repayOrderRow.value.payPrice))
  }
  const p = selectedPackage.value
  if (p) return String(p.payPrice)
  return '--'
})

const payModalCreditsDisplay = computed(() => {
  if (repayOrderRow.value) {
    const c = repayOrderRow.value.credits
    const n = Number(c)
    if (!Number.isFinite(n)) return '—'
    return Number.isInteger(n) ? String(n) : formatPrice(n)
  }
  const c = selectedPackage.value?.credits
  if (c == null) return '—'
  const n = Number(c)
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : formatPrice(n)
})

const payModalUnitPrice = computed(() => {
  if (repayOrderRow.value) {
    return formatPrice(Number(repayOrderRow.value.payPrice))
  }
  const p = selectedPackage.value?.payPrice
  if (p == null) return '--'
  return formatPrice(Number(p))
})

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function handleClose() {
  stopPolling()
  clearQrExpiryTimer()
  showRefreshQrButton.value = false
  highlightOrderNo.value = ''
  repayOrderRow.value = null
  showPayModal.value = false
  emit('update:open', false)
}

function clearQrExpiryTimer() {
  if (qrExpiryTimer) {
    clearTimeout(qrExpiryTimer)
    qrExpiryTimer = null
  }
}

/** 接口返回的 pendingRemainSeconds 倒计时结束后才显示「刷新二维码」；未返回则默认 180 秒 */
function scheduleQrExpiry(remainSeconds: number | null | undefined) {
  clearQrExpiryTimer()
  showRefreshQrButton.value = false
  const sec = remainSeconds != null && remainSeconds > 0 ? remainSeconds : 180
  qrExpiryTimer = setTimeout(() => {
    showRefreshQrButton.value = true
    qrExpiryTimer = null
  }, sec * 1000)
}

function handlePayModalClose() {
  stopPolling()
  clearQrExpiryTimer()
  showRefreshQrButton.value = false
  qrSeq++
  qrImageSrc.value = ''
  currentOrderNo.value = ''
  currentAmount.value = null
  repayOrderRow.value = null
  showPayModal.value = false
}

async function loadPackages() {
  try {
    const list = await rechargePackageList()
    packages.value = list
  } catch (e: any) {
    message.error(e?.msg ?? e?.message ?? '获取充值套餐失败')
  }
}

async function applyQrAndStartPolling(res: RechargeOrderCreateData, seq: number) {
  if (seq !== qrSeq) return
  currentOrderNo.value = res.orderNo || ''
  currentAmount.value =
    res.pendingPayPrice ?? repayOrderRow.value?.payPrice ?? selectedPackage.value?.payPrice ?? null
  qrImageSrc.value = res.qrCode ? await payQrToImageSrc(res.qrCode) : ''
  if (seq !== qrSeq) return
  scheduleQrExpiry(res.pendingRemainSeconds)
  startPolling()
}

async function syncQrForSelection() {
  if (!showPayModal.value || !selectedPackageId.value) return
  const seq = ++qrSeq
  creatingOrder.value = true
  try {
    const res = await rechargeOrderCreate({
      packageId: selectedPackageId.value,
      payType: payType.value
    })
    if (seq !== qrSeq) return

    if (res.orderNo && res.qrCode) {
      await applyQrAndStartPolling(res, seq)
      return
    }

    if (res.pendingOrderNo) {
      const r2 = await rechargeOrderRepay(res.pendingOrderNo)
      if (seq !== qrSeq) return
      if (r2.orderNo && r2.qrCode) {
        await applyQrAndStartPolling(r2, seq)
        showOrders.value = false
        return
      }
    }

    message.warning('未获取到支付二维码，请稍后重试')
    qrImageSrc.value = ''
  } catch (e: any) {
    if (seq === qrSeq) {
      if (await tryHandlePendingOrderConflict(e)) {
        qrImageSrc.value = ''
      } else {
        message.error(e?.msg ?? e?.message ?? '创建订单失败')
        qrImageSrc.value = ''
      }
    }
  } finally {
    if (seq === qrSeq) creatingOrder.value = false
  }
}

function openPendingOrderModal(orderNo: string, contentOverride?: string) {
  const content =
    contentOverride?.trim() || `您有一笔待支付订单（${orderNo}），请先完成支付或取消订单后再订阅。`
  Modal.confirm({
    class: 'recharge-confirm-modal',
    wrapClassName: 'create-flow-modal recharge-confirm-wrap',
    title: '待支付订单',
    content,
    okText: '去支付',
    cancelText: '取消',
    centered: true,
    onOk: () => {
      goToOrderAndHighlight(orderNo)
    }
  })
}

/** 后端可能用非 200/0 返回「已有待支付订单」，axios 拦截器 reject 后走 catch，需与成功体 pendingOrderNo 分支一致处理 */
function isPendingOrderConflictError(e: any): boolean {
  const msg = String(e?.msg ?? e?.message ?? '')
  return /待支付|存在.*订单|继续支付|重新创建|未支付完成/.test(msg)
}

function extractPendingOrderNoFromReject(e: any): string | null {
  const d = e?.data
  if (d && typeof d === 'object') {
    const n =
      (d as { pendingOrderNo?: string; orderNo?: string }).pendingOrderNo ??
      (d as { orderNo?: string }).orderNo
    if (n) return String(n)
  }
  const n2 = e?.pendingOrderNo ?? e?.orderNo
  if (n2) return String(n2)
  return null
}

async function resolvePendingOrderNoForModal(e: any): Promise<string | null> {
  const direct = extractPendingOrderNoFromReject(e)
  if (direct) return direct
  try {
    const { rows } = await rechargeOrderList({ payStatus: 'pending', pageNum: 1, pageSize: 20 })
    const p = rows.find((r) => r.payStatus === 'pending')
    return p?.orderNo ?? null
  } catch {
    return null
  }
}

/** 返回 true 表示已用 Modal 处理，不应再 toast 报错，且不应打开扫码弹窗 */
async function tryHandlePendingOrderConflict(e: any): Promise<boolean> {
  if (!isPendingOrderConflictError(e)) return false
  showPayModal.value = false
  const orderNo = await resolvePendingOrderNoForModal(e)
  const contentBase = String(e?.msg ?? '').trim() || '您有待支付订单，请先完成支付或取消后再订阅。'
  if (orderNo) {
    openPendingOrderModal(orderNo, contentBase)
  } else {
    Modal.confirm({
      class: 'recharge-confirm-modal',
      wrapClassName: 'create-flow-modal recharge-confirm-wrap',
      title: '待支付订单',
      content: contentBase,
      okText: '去支付',
      cancelText: '取消',
      centered: true,
      async onOk() {
        orderTab.value = 'pending'
        showOrders.value = true
        await loadOrders()
        await nextTick()
        const first = orders.value.find((r) => r.payStatus === 'pending')
        if (first?.orderNo) await goToOrderAndHighlight(first.orderNo)
      }
    })
  }
  return true
}

async function goToOrderAndHighlight(orderNo: string) {
  orderTab.value = 'pending'
  highlightOrderNo.value = orderNo
  showOrders.value = true
  await loadOrders()
  await nextTick()
  const safe =
    typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(orderNo) : orderNo.replace(/"/g, '\\"')
  const el = document.querySelector(`[data-order-no="${safe}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(() => {
    highlightOrderNo.value = ''
  }, 3500)
}

async function handleBuyNow(pkg: RechargePackageItem) {
  selectedPackageId.value = pkg.id
  payType.value = 'alipay'
  buyingPackageId.value = pkg.id
  try {
    const res = await rechargeOrderCreate({
      packageId: pkg.id,
      payType: 'alipay'
    })

    const hasNewQr = !!(res.orderNo && res.qrCode)
    if (res.pendingOrderNo && !hasNewQr) {
      showPayModal.value = false
      openPendingOrderModal(res.pendingOrderNo)
      return
    }

    if (hasNewQr) {
      showPayModal.value = true
      await nextTick()
      const seq = ++qrSeq
      creatingOrder.value = true
      try {
        await applyQrAndStartPolling(res, seq)
      } finally {
        creatingOrder.value = false
      }
      return
    }

    message.warning('未获取到支付信息，请稍后重试')
  } catch (e: any) {
    if (await tryHandlePendingOrderConflict(e)) return
    message.error(e?.msg ?? e?.message ?? '创建订单失败')
  } finally {
    buyingPackageId.value = null
  }
}

async function refreshRepayQr() {
  if (!currentOrderNo.value) {
    message.warning('订单信息异常，请关闭后重试')
    return
  }
  const seq = ++qrSeq
  creatingOrder.value = true
  try {
    const res = await rechargeOrderRepay(currentOrderNo.value)
    if (seq !== qrSeq) return
    if (res.orderNo && res.qrCode) {
      await applyQrAndStartPolling(res, seq)
      return
    }
    if (res.pendingOrderNo) {
      const r2 = await rechargeOrderRepay(res.pendingOrderNo)
      if (seq !== qrSeq) return
      if (r2.orderNo && r2.qrCode) {
        await applyQrAndStartPolling(r2, seq)
        return
      }
    }
    message.warning('未获取到支付二维码，请稍后重试')
  } catch (e: any) {
    if (seq === qrSeq) {
      message.error(e?.msg ?? e?.message ?? '刷新二维码失败')
    }
  } finally {
    if (seq === qrSeq) creatingOrder.value = false
  }
}

function handleRefreshQr() {
  if (!showPayModal.value) {
    message.warning('请先完成支付流程')
    return
  }
  if (repayOrderRow.value) {
    void refreshRepayQr()
    return
  }
  if (!selectedPackageId.value) {
    message.warning('请先完成支付流程')
    return
  }
  syncQrForSelection()
}

function startPolling() {
  stopPolling()
  if (!currentOrderNo.value) return
  pollTimer = setInterval(async () => {
    try {
      const order = await rechargeOrderQuery(currentOrderNo.value)
      currentAmount.value = order.payPrice
      if (order.payStatus === 'paid') {
        stopPolling()
        message.success('充值成功')
        showPayModal.value = false
        emit('paid')
        emit('update:open', false)
      } else if (order.payStatus === 'failed' || order.payStatus === 'closed') {
        stopPolling()
        message.warning('订单已失效，请重新发起支付')
      }
    } catch {
      // 轮询时静默，避免刷屏
    }
  }, 2500)
}

async function loadOrders() {
  ordersLoading.value = true
  try {
    const payStatusMap: Record<typeof orderTab.value, string | undefined> = {
      all: undefined,
      pending: 'pending',
      paid: 'paid',
      closed: 'closed'
    }
    const payStatus = payStatusMap[orderTab.value]
    const data = await rechargeOrderList({
      pageNum: 1,
      pageSize: 20,
      ...(payStatus ? { payStatus } : {})
    })
    console.log(data)
    orders.value = data.rows
  } catch (e: any) {
    message.error(e?.msg ?? e?.message ?? '获取订单列表失败')
  } finally {
    ordersLoading.value = false
  }
}

/** 订单列表「立即支付」：与「立即购买」一致，先打开扫码弹窗 → 请求继续支付 → 再展示二维码并轮询 */
async function handleRepay(row: RechargeOrderRow) {
  repayingOrderNo.value = row.orderNo
  repayOrderRow.value = row
  showOrders.value = false
  showPayModal.value = true
  await nextTick()
  const seq = ++qrSeq
  creatingOrder.value = true
  try {
    const res = await rechargeOrderRepay(row.orderNo)
    if (seq !== qrSeq) return
    if (res.orderNo && res.qrCode) {
      await applyQrAndStartPolling(res, seq)
      message.success('已获取支付二维码')
      return
    }
    if (res.pendingOrderNo) {
      const r2 = await rechargeOrderRepay(res.pendingOrderNo)
      if (seq !== qrSeq) return
      if (r2.orderNo && r2.qrCode) {
        await applyQrAndStartPolling(r2, seq)
        message.success('已获取支付二维码')
        return
      }
    }
    message.warning('未获取到支付二维码，请稍后重试')
    handlePayModalClose()
  } catch (e: any) {
    if (seq === qrSeq) {
      message.error(e?.msg ?? e?.message ?? '继续支付失败')
      handlePayModalClose()
    }
  } finally {
    if (seq === qrSeq) creatingOrder.value = false
    repayingOrderNo.value = ''
  }
}

function handleCancelOrder(orderNo: string) {
  Modal.confirm({
    class: 'recharge-confirm-modal',
    wrapClassName: 'create-flow-modal recharge-confirm-wrap',
    title: '确认取消支付',
    content: '确定要取消该待支付订单吗？取消后需重新下单支付。',
    okText: '确定',
    cancelText: '取消',
    centered: true,
    async onOk() {
      cancellingOrderNo.value = orderNo
      try {
        await rechargeOrderCancel(orderNo)
        message.success('取消成功')
        await loadOrders()
      } catch (e: any) {
        message.error(e?.msg ?? e?.message ?? '取消订单失败')
        throw e
      } finally {
        cancellingOrderNo.value = ''
      }
    }
  })
}

function formatPayStatus(v: string) {
  if (v === 'pending') return '待支付'
  if (v === 'paid') return '已支付'
  if (v === 'failed') return '支付失败'
  if (v === 'closed') return '已取消'
  if (v === 'refunded') return '已退款'
  return v
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      stopPolling()
      clearQrExpiryTimer()
      showRefreshQrButton.value = false
      highlightOrderNo.value = ''
      repayOrderRow.value = null
      qrSeq++
      qrImageSrc.value = ''
      currentOrderNo.value = ''
      currentAmount.value = null
      showPayModal.value = false
      return
    }
    payType.value = 'alipay'
    await loadPackages()
    if (packages.value.length) {
      selectedPackageId.value = packages.value[0].id
    } else {
      selectedPackageId.value = null
    }
    await loadOrders()
  },
  { immediate: true }
)

watch(showOrders, (open) => {
  if (open) loadOrders()
})

watch(payType, () => {
  if (showPayModal.value && selectedPackageId.value && !repayOrderRow.value) {
    syncQrForSelection()
  }
})

onBeforeUnmount(() => {
  stopPolling()
  clearQrExpiryTimer()
})
</script>

<style lang="scss" scoped>
.recharge-modal__body {
  min-width: 0;
}
.recharge-modal__body--step1 {
  display: block;
}
.recharge-modal__profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  box-sizing: border-box;
  height: 56px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: rgba(32, 36, 52, 1);
  .recharge-modal__profile-text {
    min-width: 0;
    flex: 1;
    .recharge-modal__profile-desc {
      font-size: 13px;
      line-height: 1.45;
      color: #8e97a5 !important;
      margin: 0;
    }
  }
}

.recharge-modal__profile--guest .recharge-modal__profile-name {
  color: #8e97a5;
}

.recharge-modal__profile-avatar {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(14, 89, 250, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.recharge-modal__profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.recharge-modal__profile-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recharge-modal__sub {
  margin: 0 0 1rem;
  color: #8e97a5;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}

.recharge-modal__packages {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .recharge-modal__packages {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .recharge-modal__packages {
    grid-template-columns: 1fr;
  }
}
.recharge-package {
  position: relative;
  box-sizing: border-box;
  height: 190px;
  padding: 34px 24px 16px 24px;
  border: 2px solid transparent;
  border-radius: 8px;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  background-image: url(../../assets/img/icon/topUp-nor.svg);
  color: #fff;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  .recharge-package__inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    height: 100%;
    text-align: left;

    .recharge-package__price-block {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      width: 100%;
      margin-bottom: 14px;

      .recharge-package__origin {
        font-size: 14px;
        color: rgba(142, 151, 165, 1) !important;
        text-decoration: line-through;
      }
    }

    .recharge-package__points {
      font-size: 14px;
      color: #8e97a5;
      line-height: 1.2;

      span {
        color: rgba(74, 231, 253, 1) !important;
      }
    }
  }
}
@media (max-width: 1440px) {
  .recharge-package {
    .recharge-package__inner {
      height: auto;
    }
  }
}

.recharge-package:hover {
  background-image: url(../../assets/img/icon/topUp-sel.svg);
  // border-color: rgba(74, 231, 253, 1);
}

.recharge-package__num {
  margin-top: 6px;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  line-height: 1.1;
}

.recharge-package__label {
  margin-top: 2px;
  font-size: 14px;
  color: #8e97a5;
  line-height: 1.2;
}

.recharge-package__grow {
  flex: 1;
  min-height: 4px;
}

.recharge-package__price {
  font-size: 32px;
  font-family: AlimamaShuHeiTi-Bold;
  color: #fff;
  line-height: 1.1;
}

.recharge-package__buy {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(270deg, #00abd8 0%, #0e59fa 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.recharge-package__buy:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.recharge-modal__footer-bottom {
  margin-top: 44px;
  padding: 16px 16px 54px;
  text-align: center;
  border-radius: 8px;
}

.recharge-modal__footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0;
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
}

.recharge-modal__footer-link {
  margin: 0;
  padding: 2px 4px;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: color 0.2s ease;
}

.recharge-modal__footer-link:hover {
  color: #4ae7fd;
}

.recharge-modal__footer-divider {
  margin: 0 12px;
  color: rgba(255, 255, 255, 0.35);
  font-weight: 300;
  user-select: none;
}

.recharge-modal__footer-agree {
  margin: 12px 0 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.55;
  color: #8e97a5;
  text-align: center;
}

.recharge-modal__footer-agree-text {
  margin-right: 2px;
}

.recharge-modal__footer-agree-link {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: #8e97a5;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.2s ease;
}

.recharge-modal__footer-agree-link:hover {
  color: #4ae7fd;
  text-decoration: underline;
}

.recharge-pay-modal__body {
  position: relative;
  padding: 44px 20px 20px;
  box-sizing: border-box;
  .recharge-pay-modal__summary {
    min-height: 132px;
    box-sizing: border-box;
    padding: 16px 18px 14px;
    border-radius: 8px;
    background: rgba(32, 36, 52, 1);
    .recharge-pay-modal__summary-list {
      margin: 12px 0 0;
      padding: 0 0 0 20px;
      list-style: none;
      font-size: 13px;
      line-height: 1.65;
      text-align: left;
      max-width: 280px;
      li {
        color: #8e97a5 !important;
      }
    }
  }
}

.recharge-pay-modal__close {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 2;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s ease;
}

.recharge-pay-modal__close:hover {
  color: #4ae7fd;
}

.recharge-pay-modal__summary-amount {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  text-align: center;
}

.recharge-pay-modal__summary-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.82);
}

.recharge-pay-modal__summary-num {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.recharge-pay-modal__summary-yuan {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.82);
}

.recharge-pay-modal__pay-row {
  display: flex;
  align-items: center;
  gap: 38px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.recharge-pay-modal__pay-label {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.recharge-pay-modal__methods {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}

.recharge-pay-method {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(47, 57, 73, 1);
  background: rgba(18, 18, 18, 0.65);
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.recharge-pay-method__icon {
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.recharge-pay-method:hover:not(.recharge-pay-method--active) {
  background: linear-gradient(270deg, rgba(14, 89, 250, 0.2) 0%, rgba(0, 171, 216, 0.2) 100%);
  border: 1px solid rgba(74, 231, 253, 0.3);
  color: #fff;
}

.recharge-pay-method--active {
  background: linear-gradient(270deg, rgba(14, 89, 250, 0.2) 0%, rgba(0, 171, 216, 0.2) 100%);
  border: 1px solid rgba(74, 231, 253, 0.3);
  color: #fff;
}

.recharge-pay-modal__lead-hint {
  margin: 14px 0 10px;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}

.ant-modal-body .recharge-pay-modal__body .recharge-pay-modal__disclaimer {
  margin: 16px 0 0;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: #8e97a5 !important;
}

.recharge-modal__qr-wrap {
  position: relative;
  margin-top: 10px;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.recharge-modal__qr-wrap--pay {
  width: 180px;
  height: 180px;
  margin: 0 auto;
  aspect-ratio: auto;
  flex-shrink: 0;
}

.recharge-modal__qr-wrap--expired .recharge-modal__scan-line {
  animation: none;
  opacity: 0;
}

/* 二维码过期后盖在码上，交互参考登录页微信码区（此处仅过期时显示，非 hover） */
.recharge-pay-qr-refresh-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 12px;
  border: none;
  border-radius: inherit;
  background: rgba(14, 17, 24, 0.72);
  cursor: pointer;
  transition: background 0.2s ease;
}

.recharge-pay-qr-refresh-overlay:hover:not(:disabled) {
  background: rgba(14, 17, 24, 0.82);
}

.recharge-pay-qr-refresh-overlay:disabled {
  cursor: wait;
}

//.recharge-pay-qr-refresh-overlay:focus-visible {
//  outline: 2px solid rgba(74, 231, 253, 0.85);
//  outline-offset: -2px;
//}

.recharge-pay-qr-refresh-overlay__text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 148px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-align: center;
  line-height: 1.35;
  background: linear-gradient(270deg, rgba(14, 89, 250, 0.95) 0%, rgba(0, 171, 216, 0.95) 100%);
  box-shadow: 0 4px 14px rgba(14, 89, 250, 0.35);
}

.recharge-modal__qr {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 扫码线：自上而下循环（青色系） */
.recharge-modal__scan-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 2;
  height: 12px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(74, 231, 253, 0),
    rgba(74, 231, 253, 0.4),
    rgba(74, 231, 253, 0.95),
    rgba(74, 231, 253, 0.4),
    rgba(74, 231, 253, 0)
  );
  box-shadow:
    0 0 10px rgba(74, 231, 253, 0.55),
    0 0 20px rgba(74, 231, 253, 0.2);
  animation: recharge-qr-scan 2.4s linear infinite;
}

@keyframes recharge-qr-scan {
  0% {
    top: 0;
  }
  100% {
    top: calc(100% - 12px);
  }
}

.recharge-modal__qr-empty {
  color: #8e97a5;
  font-size: 12px;
  padding: 10px;
  text-align: center;
}

.order-toolbar {
  margin-bottom: 8px;
}

.order-status-tabs {
  margin-bottom: 12px;
}

.order-status-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.order-status-tabs :deep(.ant-tabs-nav::before) {
  border-color: rgba(74, 231, 253, 0.2);
}

.order-status-tabs :deep(.ant-tabs-tab) {
  color: #8e97a5;
  padding: 8px 12px;
}

.order-status-tabs :deep(.ant-tabs-tab:hover) {
  color: rgba(74, 231, 253, 0.85);
}

.order-status-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: rgba(74, 231, 253, 1) !important;
}

.order-status-tabs :deep(.ant-tabs-ink-bar) {
  background: rgba(74, 231, 253, 1);
}

.order-empty {
  color: #8e97a5;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-card {
  border: 1px solid rgba(74, 231, 253, 0.2);
  border-radius: 8px;
  padding: 10px;
}

.order-card__title {
  color: #fff;
  font-weight: 600;
}

.order-card__meta {
  margin-top: 4px;
  color: #8e97a5;
  font-size: 12px;
}

.order-card__actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.order-card__actions--pay {
  align-items: center;
}

.order-card--highlight {
  animation: recharge-order-highlight 1.1s ease-in-out 2;
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.75);
  border-radius: 8px;
}

@keyframes recharge-order-highlight {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.75);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(74, 231, 253, 0.45);
  }
}
</style>

<style>
/*
 * 仅第二步支付弹窗：蒙层毛玻璃（wrap 带 recharge-pay-modal-wrap，与第一步区分）。
 */
.ant-modal-root:has(.ant-modal-wrap.recharge-pay-modal-wrap) .ant-modal-mask {
  -webkit-backdrop-filter: blur(10px) !important;
  backdrop-filter: blur(10px) !important;
}

/* 充值 / 扫码弹窗：与「导入场景」等弹窗一致的标题区与外壳（含首页等非 create 壳场景） */
.ant-modal.recharge-modal-branded .ant-modal-content {
  padding: 0 !important;
  overflow: hidden;
  border-radius: 12px !important;
  background: #191a1d !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55) !important;
}

.ant-modal.recharge-modal-branded .ant-modal-header {
  margin: 0 !important;
  padding: 1.25rem 1.5rem 0.75rem !important;
  border-bottom: none !important;
  background: #191a1d !important;
}

.ant-modal.recharge-modal-branded .ant-modal-title {
  width: 100%;
}

.ant-modal.recharge-modal-branded .ant-modal-close {
  top: 1rem !important;
  inset-inline-end: 1rem !important;
  color: rgba(255, 255, 255, 0.75) !important;
}

.ant-modal.recharge-modal-branded .ant-modal-close:hover {
  color: #4ae7fd !important;
}

.ant-modal.recharge-modal-branded .ant-modal-body {
  padding: 0 !important;
  background: #191a1d !important;
}

.ant-modal.recharge-main-modal .ant-modal-body .recharge-modal__body--step1 {
  padding: 16px 24px 0;
}

/* 扫码支付弹窗：无标题栏，内容由 body 内自定义关闭与摘要区 */
.ant-modal.recharge-pay-modal.recharge-modal-branded .ant-modal-header {
  display: none !important;
}

.ant-modal.recharge-pay-modal .ant-modal-body .recharge-pay-modal__body {
  padding: 64px 24px 12px !important;
}

/* 取消订单确认框：与流程弹窗深色主题一致 */
.recharge-confirm-wrap .ant-modal-content,
.recharge-confirm-modal .ant-modal-content {
  background: rgba(34, 44, 64, 0.985) !important;
  border: 1px solid rgba(74, 231, 253, 0.09) !important;
  box-shadow: 0 24px 56px rgba(8, 12, 24, 0.45) !important;
  border-radius: 8px !important;
}

.recharge-confirm-wrap .ant-modal-confirm-body,
.recharge-confirm-modal .ant-modal-confirm-body {
  color: #e6edf3 !important;
}

.recharge-confirm-wrap .ant-modal-confirm-title,
.recharge-confirm-modal .ant-modal-confirm-title {
  color: #fff !important;
}

.recharge-confirm-wrap .ant-modal-confirm-content,
.recharge-confirm-modal .ant-modal-confirm-content {
  color: #a8b4c4 !important;
}

.recharge-confirm-wrap .ant-modal-confirm-body > .anticon,
.recharge-confirm-modal .ant-modal-confirm-body > .anticon {
  color: #4ae7fd !important;
}

.recharge-confirm-wrap .ant-modal-confirm-btns .ant-btn,
.recharge-confirm-modal .ant-modal-confirm-btns .ant-btn {
  border-radius: 8px;
}
</style>
