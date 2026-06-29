import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SESSION_SIDEBAR_CLASS } from '../lib/session-sidebar-layout'

describe('session sidebar layout', () => {
  it('fills the animated sidebar container from top to bottom', () => {
    assert.match(SESSION_SIDEBAR_CLASS, /\bh-full\b/)
    assert.match(SESSION_SIDEBAR_CLASS, /\bflex-col\b/)
  })
})
