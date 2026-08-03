// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { sanitizeDisplayHtml } from '../utils/safeDisplayHtml'

describe('safe display html', () => {
  it('drops executable elements and event handlers', () => {
    const result = sanitizeDisplayHtml(
      '<p onclick="alert(1)">正文<script>alert(2)</script><img src="x" onerror="alert(3)"></p>'
    )
    expect(result).toContain('<p>正文<img src="x"></p>')
    expect(result).not.toContain('script')
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('onerror')
  })

  it('removes unsafe URL protocols and protects blank targets', () => {
    const result = sanitizeDisplayHtml(
      '<a href="javascript:alert(1)" target="_blank">危险</a><a href="https://safe.example">安全</a>'
    )
    expect(result).toContain('<a target="_blank" rel="noopener noreferrer">危险</a>')
    expect(result).toContain('<a href="https://safe.example">安全</a>')
    expect(result).not.toContain('javascript:')
  })
})
