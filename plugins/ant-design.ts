import Antd, { message } from 'ant-design-vue'

export default defineNuxtPlugin((nuxtApp: any) => {
  nuxtApp.vueApp.use(Antd)
  // 全局 Toast 固定在顶部同一位置，不向下堆叠
  message.config({
    top: '24px',
    duration: 3,
    maxCount: 1
  })
})
