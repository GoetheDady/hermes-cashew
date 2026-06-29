import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldShowContinueLast } from './fresh-conversation'

const visible: Parameters<typeof shouldShowContinueLast>[0] = {
  ready: true,
  hasActiveSession: false,
  isSessionLoading: false,
  hasLoadedSessions: true,
  sessionsCount: 1
}

describe('shouldShowContinueLast', () => {
  it('shows when ready, empty, loaded, with history', () => {
    assert.equal(shouldShowContinueLast(visible), true)
  })

  it('hides once a session is active (first message sent or resumed)', () => {
    assert.equal(shouldShowContinueLast({ ...visible, hasActiveSession: true }), false)
  })

  it('hides while a session is being resumed', () => {
    assert.equal(shouldShowContinueLast({ ...visible, isSessionLoading: true }), false)
  })

  it('hides before the gateway is ready', () => {
    assert.equal(shouldShowContinueLast({ ...visible, ready: false }), false)
  })

  it('hides when there is no history to continue', () => {
    assert.equal(shouldShowContinueLast({ ...visible, sessionsCount: 0 }), false)
  })

  it('hides until the session list has been loaded', () => {
    assert.equal(shouldShowContinueLast({ ...visible, hasLoadedSessions: false }), false)
  })
})
