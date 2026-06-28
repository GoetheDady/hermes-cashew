import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ChatMessage } from '@hermes/shared'
import { getCashewPresence, hasActiveToolCall } from './cashew-presence'

describe('getCashewPresence', () => {
  it('reports unavailable when the gateway is closed before ready', () => {
    assert.equal(
      getCashewPresence({
        conn: 'closed',
        ready: false,
        isSessionLoading: false,
        hasActiveSession: false,
        isStreaming: false,
        hasActiveToolCall: false,
        isIdle: false,
        isMidnight: false
      }).kind,
      'unavailable'
    )
  })

  it('prefers tool activity over generic streaming', () => {
    const state = getCashewPresence({
      conn: 'open',
      ready: true,
      isSessionLoading: false,
      hasActiveSession: true,
      isStreaming: true,
      hasActiveToolCall: true,
      isIdle: false,
      isMidnight: false
    })

    assert.equal(state.kind, 'using-tools')
    assert.equal(state.label, '正在动手')
  })

  it('uses a warmer idle label during midnight atmosphere', () => {
    assert.equal(
      getCashewPresence({
        conn: 'open',
        ready: true,
        isSessionLoading: false,
        hasActiveSession: true,
        isStreaming: false,
        hasActiveToolCall: false,
        isIdle: true,
        isMidnight: true
      }).label,
      '夜里陪着'
    )
  })
})

describe('hasActiveToolCall', () => {
  it('detects a running tool call without a result', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        parts: [{ type: 'tool-call', toolCallId: 't1', toolName: 'read_file' }]
      }
    ]

    assert.equal(hasActiveToolCall(messages), true)
  })

  it('ignores completed tool calls', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-call',
            toolCallId: 't1',
            toolName: 'read_file',
            result: 'done'
          }
        ]
      }
    ]

    assert.equal(hasActiveToolCall(messages), false)
  })
})
