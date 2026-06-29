import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canUseSessionHistoryHoverTrigger,
  getSessionHistoryClickSurface,
  SESSION_HISTORY_HOVER_TRIGGER_CLASS,
  SESSION_HISTORY_NARROW_BREAKPOINT
} from './session-history-layout'

describe('session history layout model', () => {
  it('uses a drawer for narrow explicit clicks and a sidebar for large explicit clicks', () => {
    assert.equal(getSessionHistoryClickSurface(SESSION_HISTORY_NARROW_BREAKPOINT - 1), 'drawer')
    assert.equal(getSessionHistoryClickSurface(SESSION_HISTORY_NARROW_BREAKPOINT), 'sidebar')
  })

  it('only enables the hover trigger after a large-window sidebar has been manually closed', () => {
    assert.equal(
      canUseSessionHistoryHoverTrigger({
        hasSidebarBeenManuallyClosed: true,
        isSidebarOpen: false,
        viewportWidth: SESSION_HISTORY_NARROW_BREAKPOINT
      }),
      true
    )
    assert.equal(
      canUseSessionHistoryHoverTrigger({
        hasSidebarBeenManuallyClosed: false,
        isSidebarOpen: false,
        viewportWidth: SESSION_HISTORY_NARROW_BREAKPOINT
      }),
      false
    )
    assert.equal(
      canUseSessionHistoryHoverTrigger({
        hasSidebarBeenManuallyClosed: true,
        isSidebarOpen: true,
        viewportWidth: SESSION_HISTORY_NARROW_BREAKPOINT
      }),
      false
    )
    assert.equal(
      canUseSessionHistoryHoverTrigger({
        hasSidebarBeenManuallyClosed: true,
        isSidebarOpen: false,
        viewportWidth: SESSION_HISTORY_NARROW_BREAKPOINT - 1
      }),
      false
    )
  })

  it('keeps the hover trigger at the requested 12px Tailwind width', () => {
    assert.match(SESSION_HISTORY_HOVER_TRIGGER_CLASS, /\bw-3\b/)
  })
})
