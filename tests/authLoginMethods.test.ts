import { describe, expect, it } from 'vitest'
import {
  getCodeLoginPresentation,
  getWechatLoginPresentation,
  isValidCodeLoginTarget,
  resolveCodeLoginChannel
} from '../utils/authLoginMethods'

describe('auth login method presentation', () => {
  it('uses combined wording only when both code channels are enabled', () => {
    expect(getCodeLoginPresentation(true, true)).toMatchObject({
      enabled: true,
      tabLabel: '手机/邮箱',
      accountPlaceholder: '请输入手机号或邮箱'
    })
  })

  it('uses phone-only wording and channel when only SMS is enabled', () => {
    expect(getCodeLoginPresentation(true, false)).toMatchObject({
      tabLabel: '手机号',
      accountPlaceholder: '请输入手机号'
    })
    expect(resolveCodeLoginChannel('test@example.com', true, false)).toBe('sms')
    expect(isValidCodeLoginTarget('test@example.com', 'sms')).toBe(false)
    expect(isValidCodeLoginTarget('13888888888', 'sms')).toBe(true)
  })

  it('uses email-only wording and channel when only email is enabled', () => {
    expect(getCodeLoginPresentation(false, true)).toMatchObject({
      tabLabel: '邮箱',
      accountPlaceholder: '请输入邮箱'
    })
    expect(resolveCodeLoginChannel('13888888888', false, true)).toBe('email')
    expect(isValidCodeLoginTarget('13888888888', 'email')).toBe(false)
    expect(isValidCodeLoginTarget('test@example.com', 'email')).toBe(true)
  })

  it('disables code login when both channels are closed', () => {
    expect(getCodeLoginPresentation(false, false)).toMatchObject({
      enabled: false,
      accountPlaceholder: '请输入账号'
    })
    expect(resolveCodeLoginChannel('anything', false, false)).toBeNull()
  })

  it('switches the right side between WeChat QR and a restrained fallback', () => {
    expect(getWechatLoginPresentation(true)).toEqual({
      enabled: true,
      title: '微信扫码登录',
      description: '请在微信中扫描登录'
    })
    expect(getWechatLoginPresentation(false)).toEqual({
      enabled: false,
      title: '便捷登录',
      description: '请使用左侧账号方式登录'
    })
  })
})
