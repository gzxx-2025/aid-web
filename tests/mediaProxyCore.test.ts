import { describe, expect, it } from 'vitest'
import { isBlockedMediaHostname } from '../server/utils/mediaProxyCore'

describe('media proxy host validation', () => {
  it.each([
    'localhost',
    'service.internal',
    '127.0.0.1',
    '10.1.2.3',
    '169.254.169.254',
    '192.168.1.1',
    '::1',
    '::ffff:127.0.0.1',
    'fd00::1',
    'fe80::1',
    'fec0::1',
    'ff02::1'
  ])('blocks non-public host %s', (host) => {
    expect(isBlockedMediaHostname(host)).toBe(true)
  })

  it.each(['cdn.example.com', '8.8.8.8', '2606:4700:4700::1111'])(
    'allows public-looking host %s',
    (host) => {
      expect(isBlockedMediaHostname(host)).toBe(false)
    }
  )
})
