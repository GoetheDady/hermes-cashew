import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getMessageBubbleRowClass } from './message-layout'

describe('message bubble layout', () => {
  it('right-aligns user messages and left-aligns assistant messages', () => {
    assert.match(getMessageBubbleRowClass('user'), /\bjustify-end\b/)
    assert.match(getMessageBubbleRowClass('assistant'), /\bjustify-start\b/)
  })
})
