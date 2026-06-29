import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getSessionHistoryItemClass, SESSION_SIDEBAR_CLASS } from '../lib/session-sidebar-layout'

describe('session sidebar layout', () => {
  it('fills the animated sidebar container from top to bottom', () => {
    assert.match(SESSION_SIDEBAR_CLASS, /\bh-full\b/)
    assert.match(SESSION_SIDEBAR_CLASS, /\bflex-col\b/)
  })

  it('styles session items as a quiet list instead of bordered cards', () => {
    assert.match(getSessionHistoryItemClass(false), /\bborder-0\b/)
    assert.match(getSessionHistoryItemClass(false), /\bbg-transparent\b/)
    assert.match(getSessionHistoryItemClass(true), /\bbg-sidebar-accent\/80\b/)
  })
})
