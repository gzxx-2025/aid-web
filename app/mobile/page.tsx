'use client'

import { HtmlShellClass } from '@/components/app/HtmlShellClass'
import { message } from 'antd'
import logoMod from '~/assets/img/home/logo-new.svg'
import picMod from '~/assets/img/icon/pic.svg'
import { assetUrl } from '~/utils/assetUrl'

const logoUrl = assetUrl(logoMod)
const picUrl = assetUrl(picMod)

/** 移动端拦截页：请使用电脑端打开 */
export default function MobilePage() {
  async function copyPcUrl() {
    const text = 'https://www.aidstudio.com.cn'
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

  return (
    <div className="mobile-home relative min-h-screen overflow-hidden text-white bg-[linear-gradient(337deg,rgba(14,89,250,0.2)_0%,rgba(0,171,216,0.2)_100%)]">
      <HtmlShellClass classes="mobile-only-shell" />
      <div className="mobile-home__panel relative z-[1] w-[min(100%,420px)] mx-auto rounded-[18px] pt-[4px] px-[20px] pb-[18px]">
        <img src={logoUrl} alt="" className="mobile-home__logo block w-[50px] h-[50px] object-contain" />
        <div className="mobile-home__hero rounded-[14px] overflow-hidden">
          <img src={picUrl} alt="首页视觉" className="mobile-home__hero-img block w-full h-auto" />
        </div>
        <div className="mobile-home__pc-tip mt-[18px] pt-[10px] px-[10px] pb-[12px] rounded-[14px] text-center">
          <p className="m-0 text-[13px] text-[#dce7f8]">请使用电脑端打开本网页</p>
          <p className="mt-[2px] mb-[10px] text-[14px] tracking-[0.01em] text-[#46d8ff]">
            www.aidstudio.com.cn
          </p>
          <button
            type="button"
            className="mobile-home__copy-btn h-[44px] border-none rounded-full bg-[linear-gradient(90deg,#09c7ff_0%,#0a6dff_100%)] text-white text-[16px] tracking-[0.02em] px-[64px] active:translate-y-[1px] active:brightness-95"
            onClick={copyPcUrl}
          >
            复制电脑端地址
          </button>
        </div>
      </div>
    </div>
  )
}
