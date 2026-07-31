<template>
  <Teleport to="body">
    <transition
      name="invite-promo-panel-slide"
      appear
      @after-enter="onAfterEnter"
      @after-leave="onAfterLeave"
    >
      <div
        v-if="open"
        ref="floatingRoot"
        class="invite-promo-panel"
        :class="{ 'is-confetti-on': confettiOn }"
        :style="floatingStyle"
        role="dialog"
        aria-label="邀请好友得积分"
      >
        <button
          type="button"
          class="invite-promo-panel__close"
          aria-label="关闭"
          @click="emit('close')"
        >
          <span class="invite-promo-panel__close-icon" aria-hidden="true" />
        </button>

        <div class="invite-promo-panel__confetti" aria-hidden="true">
          <span
            v-for="piece in confettiPieces"
            :key="piece.id"
            class="invite-promo-panel__confetti-piece"
            :class="`invite-promo-panel__confetti-piece--${piece.shape}`"
            :style="piece.style"
          />
        </div>

        <img
          class="invite-promo-panel__pic"
          :src="picYqUrl"
          alt=""
          width="272"
          height="202"
        />

        <h3 class="invite-promo-panel__title">邀请好友 得积分</h3>
        <p class="invite-promo-panel__desc">
          好友充值后<br />获得{{ rebateRatioText }}%的积分
        </p>

        <button type="button" class="invite-promo-panel__cta" @click="emit('invite')">
          立即邀请
        </button>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import picYqUrl from '~/assets/img/home/pic_yq.svg'
import bgDialogUrl from '~/assets/img/home/yq_dialog.svg'

withDefaults(
  defineProps<{
    open: boolean
    floatingStyle?: Record<string, string>
    /** 返佣比例文案，缺省 10 */
    rebateRatioText?: string
  }>(),
  {
    floatingStyle: () => ({}),
    rebateRatioText: '10'
  }
)

const emit = defineEmits<{
  close: []
  invite: []
}>()

const floatingRoot = ref<HTMLElement | null>(null)
const bgUrl = bgDialogUrl
const confettiOn = ref(false)

const CONFETTI_COLORS = ['#5B8CFF', '#00D4FF', '#FF6B9D', '#FFD166', '#7CFFB2', '#C77DFF', '#FF8A5B']

type ConfettiShape = 'rect' | 'dot' | 'ribbon'

const confettiPieces = Array.from({ length: 22 }, (_, i) => {
  const shapes: ConfettiShape[] = ['rect', 'dot', 'ribbon']
  return {
    id: i,
    shape: shapes[i % shapes.length],
    style: {
      '--cx': `${6 + ((i * 41) % 88)}%`,
      '--delay': `${(i % 11) * 0.07}s`,
      '--dur': `${2.2 + (i % 6) * 0.28}s`,
      '--drift': `${-28 + ((i * 17) % 56)}px`,
      '--spin': `${180 + ((i * 53) % 360)}deg`,
      '--size-w': `${5 + (i % 4) * 2}px`,
      '--size-h': `${8 + (i % 5) * 2}px`,
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    } as Record<string, string>
  }
})

function prefersReducedMotion(): boolean {
  if (!import.meta.client) return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function onAfterEnter() {
  if (prefersReducedMotion()) {
    confettiOn.value = false
    return
  }
  confettiOn.value = true
}

function onAfterLeave() {
  confettiOn.value = false
}

defineExpose({
  floatingRoot
})
</script>

<style scoped>
.invite-promo-panel {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  width: 300px;
  height: 382px;
  padding: 24px 14px 20px;
  border-radius: 8px;
  background-color: #111621;
  background-image: v-bind('`url(${bgUrl})`');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.invite-promo-panel__close {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.invite-promo-panel__close-icon {
  display: block;
  width: 14px;
  height: 14px;
  position: relative;
}

.invite-promo-panel__close-icon::before,
.invite-promo-panel__close-icon::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background: #fff;
}

.invite-promo-panel__close-icon::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.invite-promo-panel__close-icon::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.invite-promo-panel__confetti {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.invite-promo-panel__confetti-piece {
  position: absolute;
  top: -12px;
  left: var(--cx);
  width: var(--size-w);
  height: var(--size-h);
  opacity: 0;
  transform: translate3d(0, 0, 0) rotate(0deg);
  will-change: transform, opacity;
}

.invite-promo-panel__confetti-piece--dot {
  width: var(--size-w);
  height: var(--size-w);
  border-radius: 50%;
}

.invite-promo-panel__confetti-piece--ribbon {
  width: 3px;
  height: var(--size-h);
  border-radius: 1px;
}

.invite-promo-panel__confetti-piece--rect {
  border-radius: 1px;
}

.invite-promo-panel.is-confetti-on .invite-promo-panel__confetti-piece {
  animation: invite-promo-confetti-fall var(--dur) cubic-bezier(0.22, 0.61, 0.36, 1)
    var(--delay) infinite;
}

.invite-promo-panel__pic {
  position: relative;
  z-index: 2;
  display: block;
  width: 272px;
  height: 202px;
  object-fit: contain;
  flex-shrink: 0;
  margin-top: 0;
  pointer-events: none;
}

.invite-promo-panel__title {
  position: relative;
  z-index: 2;
  margin: 0;
  width: 236px;
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  text-align: center;
  background: linear-gradient(180deg, #7de8ff 0%, #ffffff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.invite-promo-panel__desc {
  position: relative;
  z-index: 2;
  margin: 8px 0 0;
  width: 230px;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: center;
  color: #fff;
  white-space: pre-line;
}

.invite-promo-panel__cta {
  position: relative;
  z-index: 2;
  margin-top: auto;
  width: 224px;
  height: 46px;
  border: none;
  border-radius: 8px;
  background: var(--home-grad, linear-gradient(270deg, #0e59fa 0%, #00abd8 100%));
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.invite-promo-panel__cta:hover {
  filter: brightness(1.08);
}

.invite-promo-panel-slide-enter-active {
  transition:
    opacity 0.55s cubic-bezier(0.22, 1.15, 0.36, 1),
    transform 0.55s cubic-bezier(0.22, 1.15, 0.36, 1);
}

.invite-promo-panel-slide-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.invite-promo-panel-slide-enter-from {
  opacity: 0;
  transform: translateX(-72px) scale(0.94);
}

.invite-promo-panel-slide-leave-to {
  opacity: 0;
  transform: translateX(-28px) scale(0.98);
}

@keyframes invite-promo-confetti-fall {
  0% {
    opacity: 0;
    transform: translate3d(0, -8px, 0) rotate(0deg);
  }
  12% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--drift), 390px, 0) rotate(var(--spin));
  }
}

@media (prefers-reduced-motion: reduce) {
  .invite-promo-panel-slide-enter-active,
  .invite-promo-panel-slide-leave-active {
    transition: none;
  }

  .invite-promo-panel.is-confetti-on .invite-promo-panel__confetti-piece {
    animation: none;
    opacity: 0;
  }
}
</style>
