import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatSessionActivityTime } from './session-activity-time'

describe('formatSessionActivityTime', () => {
  const now = new Date('2026-06-29T15:30:00+08:00')

  it('shows clock time for activity today', () => {
    assert.equal(formatSessionActivityTime(new Date('2026-06-29T09:05:00+08:00').getTime(), now), '09:05')
  })

  it('shows yesterday for activity on the previous day', () => {
    assert.equal(formatSessionActivityTime(new Date('2026-06-28T22:10:00+08:00').getTime(), now), '昨天')
  })

  it('shows weekday for activity in the last week', () => {
    assert.equal(formatSessionActivityTime(new Date('2026-06-25T10:00:00+08:00').getTime(), now), '周四')
  })

  it('shows month/day for activity in the current year', () => {
    assert.equal(formatSessionActivityTime(new Date('2026-03-02T10:00:00+08:00').getTime(), now), '3/2')
  })

  it('shows full year/month/day for activity outside the current year', () => {
    assert.equal(formatSessionActivityTime(new Date('2025-12-31T10:00:00+08:00').getTime(), now), '2025/12/31')
  })

  it('accepts second-based timestamps from Hermes session rows', () => {
    const seconds = Math.floor(new Date('2026-06-29T14:32:00+08:00').getTime() / 1000)

    assert.equal(formatSessionActivityTime(seconds, now), '14:32')
  })
})
