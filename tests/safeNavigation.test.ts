import { describe, expect, it } from 'vitest'
import { resolveSafeHttpUrl, resolveSafeInternalPath } from '../utils/safeNavigation'

const BASE_URL = 'https://aid.example.com/works?page=1'

describe('safe navigation', () => {
  it('allows only HTTP(S) external links', () => {
    expect(resolveSafeHttpUrl('https://docs.example.com/guide', BASE_URL)).toBe(
      'https://docs.example.com/guide'
    )
    expect(resolveSafeHttpUrl('/faq', BASE_URL)).toBe('https://aid.example.com/faq')
    expect(resolveSafeHttpUrl('javascript:alert(1)', BASE_URL)).toBeNull()
    expect(resolveSafeHttpUrl('data:text/html,<script>alert(1)</script>', BASE_URL)).toBeNull()
  })

  it('keeps internal links on the current origin', () => {
    expect(resolveSafeInternalPath('/works/12?tab=video#result', BASE_URL)).toBe(
      '/works/12?tab=video#result'
    )
    expect(resolveSafeInternalPath('faq', BASE_URL)).toBe('/faq')
    expect(resolveSafeInternalPath('//evil.example/path', BASE_URL)).toBeNull()
    expect(resolveSafeInternalPath('https://evil.example/path', BASE_URL)).toBeNull()
  })
})
