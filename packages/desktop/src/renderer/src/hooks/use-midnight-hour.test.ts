import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isMidnightHour } from './use-midnight-hour'

describe('isMidnightHour', () => {
  it('returns true inside the 0–5 hour window (inclusive)', () => {
    for (const hour of [0, 1, 2, 3, 4, 5]) {
      const now = new Date(2026, 5, 30, hour, 17)
      assert.equal(isMidnightHour(now), true, `hour ${hour} should be midnight`)
    }
  })

  it('returns false outside the midnight window', () => {
    for (const hour of [6, 12, 18, 23]) {
      const now = new Date(2026, 5, 30, hour, 0)
      assert.equal(isMidnightHour(now), false, `hour ${hour} should not be midnight`)
    }
  })
})
