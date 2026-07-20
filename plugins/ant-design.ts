import Antd from 'ant-design-vue'

export default defineNuxtPlugin((nuxtApp: any) => {
  nuxtApp.vueApp.use(Antd)
})
