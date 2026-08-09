// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyPlainText } from '../utils/clipboard'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('copyPlainText', () => {
  it('uses the Clipboard API in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    await expect(copyPlainText('invite-link')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('invite-link')
  })

  it('falls back to execCommand outside a secure context', async () => {
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })

    await expect(copyPlainText('http://aid.example/login')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back when the Clipboard API rejects the permission request', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })

    await expect(copyPlainText('invite-link')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('invite-link')
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('reports failure when neither copy mechanism succeeds', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false)
    })

    await expect(copyPlainText('invite-link')).resolves.toBe(false)
  })
})
