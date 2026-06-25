import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  completeAssistantParts,
  storedMessagesToChatMessages,
  textPart,
  upsertToolCallPart
} from './index'

test('restores assistant tool calls from stored session history', () => {
  const messages = storedMessagesToChatMessages([
    {
      role: 'assistant',
      content: '我先查一下。',
      tool_calls: [
        {
          id: 'call-search',
          function: {
            name: 'search_files',
            arguments: '{"query":"tool.start"}'
          }
        }
      ]
    },
    {
      role: 'tool',
      content: 'found 2 matches',
      tool_call_id: 'call-search',
      tool_name: 'search_files'
    }
  ])

  assert.equal(messages.length, 1)
  assert.equal(messages[0]?.role, 'assistant')
  assert.deepEqual(messages[0]?.parts, [
    { type: 'text', text: '我先查一下。' },
    {
      type: 'tool-call',
      toolCallId: 'call-search',
      toolName: 'search_files',
      args: { query: 'tool.start' },
      argsText: '{"query":"tool.start"}',
      result: 'found 2 matches',
      isError: false
    }
  ])
})

test('keeps one assistant turn together when stored history resumes after a tool result', () => {
  const messages = storedMessagesToChatMessages([
    {
      role: 'assistant',
      reasoning: '需要先查文件。',
      tool_calls: [
        {
          id: 'call-read',
          function: {
            name: 'read_file',
            arguments: '{"path":"src/App.tsx"}'
          }
        }
      ]
    },
    {
      role: 'tool',
      content: 'App source',
      tool_call_id: 'call-read',
      tool_name: 'read_file'
    },
    {
      role: 'assistant',
      reasoning: '看完了。',
      content: '结论是应该合并显示。'
    }
  ])

  assert.equal(messages.length, 1)
  assert.equal(messages[0]?.role, 'assistant')
  assert.deepEqual(messages[0]?.parts, [
    { type: 'reasoning', text: '需要先查文件。' },
    {
      type: 'tool-call',
      toolCallId: 'call-read',
      toolName: 'read_file',
      args: { path: 'src/App.tsx' },
      argsText: '{"path":"src/App.tsx"}',
      result: 'App source',
      isError: false
    },
    { type: 'reasoning', text: '看完了。' },
    { type: 'text', text: '结论是应该合并显示。' }
  ])
})

test('completes assistant text without moving tool call parts', () => {
  const parts = completeAssistantParts(
    [
      textPart('旧文本'),
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'web_search',
        result: 'done'
      }
    ],
    '完整文本',
    ''
  )

  assert.deepEqual(parts, [
    { type: 'text', text: '完整文本' },
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'web_search',
      result: 'done'
    }
  ])
})

test('updates a running tool call in place when the complete event arrives', () => {
  const started = upsertToolCallPart(
    [textPart('先查：')],
    {
      tool_id: 'call-read',
      name: 'read_file',
      context: 'packages/shared/src/index.ts',
      args_text: '{"path":"packages/shared/src/index.ts"}'
    },
    'running'
  )

  const completed = upsertToolCallPart(
    started,
    {
      tool_id: 'call-read',
      name: 'read_file',
      result_text: 'export interface ChatMessage',
      summary: 'Read index.ts',
      duration_s: 0.42
    },
    'complete'
  )

  assert.deepEqual(completed, [
    { type: 'text', text: '先查：' },
    {
      type: 'tool-call',
      toolCallId: 'call-read',
      toolName: 'read_file',
      args: { path: 'packages/shared/src/index.ts' },
      argsText: '{"path":"packages/shared/src/index.ts"}',
      context: 'packages/shared/src/index.ts',
      result: 'export interface ChatMessage',
      resultText: 'export interface ChatMessage',
      summary: 'Read index.ts',
      durationS: 0.42,
      isError: false
    }
  ])
})
