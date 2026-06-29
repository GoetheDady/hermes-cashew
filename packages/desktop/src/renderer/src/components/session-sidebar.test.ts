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
    // 沉井语言：选中态用更满的蜂蜜金底 + 字重加重，与悬停的淡冲洗明确区分。
    assert.match(getSessionHistoryItemClass(true), /\bbg-sidebar-accent\/85\b/)
    assert.match(getSessionHistoryItemClass(true), /\bfont-semibold\b/)
    // 悬停只走淡冲洗，不能与选中态同浓度。
    assert.match(getSessionHistoryItemClass(false), /\bhover:bg-sidebar-accent\/45\b/)
    assert.doesNotMatch(getSessionHistoryItemClass(false), /\bbg-sidebar-accent\/85\b/)
  })
})
