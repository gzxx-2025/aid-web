<template>
  <div class="mobile-home">
    <div class="mobile-home__panel">
      <img :src="logoUrl"  class="mobile-home__logo" />
      <div class="mobile-home__hero">
        <img :src="picUrl" alt="首页视觉" class="mobile-home__hero-img" />
      </div>
      <div class="mobile-home__pc-tip">
        <p class="mobile-home__pc-tip-title">请使用电脑端打开本网页</p>
        <p class="mobile-home__pc-tip-domain">{{ pcHost }}</p>
        <button type="button" class="mobile-home__copy-btn" @click="copyPcUrl">复制电脑端地址</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import logoUrl from '~/assets/img/home/logo.svg'
import picUrl from '~/assets/img/icon/pic.svg'

definePageMeta({
  layout: false
})

useHead({
  htmlAttrs: {
    class: 'mobile-only-shell'
  }
})

// 电脑端地址取当前站点自身域名，适配任意部署环境
const requestUrl = useRequestURL()
const pcHost = requestUrl.host
const pcOrigin = requestUrl.origin

async function copyPcUrl() {
  const text = pcOrigin
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const input = document.createElement('input')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    message.success('电脑端地址已复制')
  } catch {
    message.error('复制失败，请手动复制地址')
  }
}
</script>

<style scoped>
.mobile-home {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient( 337deg, rgba(14, 89, 250, .2) 0%, rgba(0, 171, 216, .2) 100%);
  color: #fff;
}


.mobile-home__panel {
  position: relative;
  z-index: 1;
  width: min(100%, 420px);
  margin: 0 auto;
  border-radius: 18px;
  padding: 18px 20px 18px;
}

.mobile-home__logo {
  width: 62px;
  height: 22px;
  height: auto;
  display: block;
}

.mobile-home__sub {
  margin: 8px 0 14px;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(230, 237, 243, 0.78);
}

.mobile-home__hero {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(74, 231, 253, 0.24);
  background: rgba(255, 255, 255, 0.02);
}

.mobile-home__hero-img {
  width: 100%;
  height: auto;
  display: block;
}

.mobile-home__content {
  margin-top: 14px;
}

.mobile-home__content h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #4ae7fd;
}

.mobile-home__content p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(230, 237, 243, 0.86);
}

.mobile-home__pc-tip {
  margin-top: 18px;
  padding: 10px 10px 12px;
  border-radius: 14px;
  text-align: center;
}

.mobile-home__pc-tip-title {
  margin: 0;
  font-size: 13px;
  color: #dce7f8;
}

.mobile-home__pc-tip-domain {
  margin: 2px 0 10px;
  font-size: 14px;
  letter-spacing: 0.01em;
  color: #46d8ff;
}

.mobile-home__copy-btn {
  height: 44px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(90deg, #09c7ff 0%, #0a6dff 100%);
  color: #fff;
  font-size: 16px;
  letter-spacing: 0.02em;
  padding: 0 64px;
}

.mobile-home__copy-btn:active {
  transform: translateY(1px);
  filter: brightness(0.95);
}
</style>
