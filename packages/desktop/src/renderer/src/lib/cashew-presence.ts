import type { ChatMessage } from '@hermes/shared'
import type { ConnectionState } from './gateway-client'

export type CashewPresenceKind =
  | 'unavailable'
  | 'connecting'
  | 'starting'
  | 'remembering'
  | 'using-tools'
  | 'thinking'
  | 'idle'
  | 'ready'

export type CashewPresenceTone = 'warm' | 'muted' | 'active' | 'danger'

export interface CashewPresenceInput {
  /** 当前 WebSocket 连接状态。 */
  conn: ConnectionState
  /** 网关握手是否已完成。 */
  ready: boolean
  /** 当前是否正在创建或恢复会话。 */
  isSessionLoading: boolean
  /** 当前页面是否已有可发送消息的运行时会话。 */
  hasActiveSession: boolean
  /** 当前是否正在流式接收助手回复。 */
  isStreaming: boolean
  /** 当前 assistant 回复里是否存在未完成的工具调用。 */
  hasActiveToolCall: boolean
  /** 当前是否处于低干扰的空闲态。 */
  isIdle: boolean
  /** 当前是否处于午夜氛围时段。 */
  isMidnight: boolean
}

export interface CashewPresenceState {
  /** 稳定状态 id，用于样式、测试和 aria 文案。 */
  kind: CashewPresenceKind
  /** 展示给用户的短文案。 */
  label: string
  /** 色彩/动效语气，不暴露底层连接细节。 */
  tone: CashewPresenceTone
  /** 是否适合播放轻微呼吸动效。 */
  breathes: boolean
}

/**
 * 把运行时输入压缩成一个小型 Cashew Presence 状态。
 *
 * @param input - 连接、会话、流式与时间氛围输入
 * @returns 用于 UI 展示的稳定 presence 状态
 */
export function getCashewPresence(input: CashewPresenceInput): CashewPresenceState {
  if ((input.conn === 'closed' || input.conn === 'error') && !input.ready) {
    return {
      kind: 'unavailable',
      label: '暂时离线',
      tone: 'danger',
      breathes: false
    }
  }

  if (!input.ready || input.conn === 'connecting') {
    return {
      kind: 'connecting',
      label: '正在醒来',
      tone: 'muted',
      breathes: true
    }
  }

  if (input.isSessionLoading) {
    return {
      kind: 'starting',
      label: '整理对话',
      tone: 'muted',
      breathes: true
    }
  }

  if (!input.hasActiveSession) {
    return {
      kind: 'remembering',
      label: '等你选择',
      tone: 'warm',
      breathes: true
    }
  }

  if (input.hasActiveToolCall) {
    return {
      kind: 'using-tools',
      label: '正在动手',
      tone: 'active',
      breathes: true
    }
  }

  if (input.isStreaming) {
    return {
      kind: 'thinking',
      label: '正在思考',
      tone: 'active',
      breathes: true
    }
  }

  if (input.isIdle) {
    return {
      kind: 'idle',
      label: input.isMidnight ? '夜里陪着' : '安静待命',
      tone: 'warm',
      breathes: true
    }
  }

  return {
    kind: 'ready',
    label: '准备好了',
    tone: 'warm',
    breathes: true
  }
}

/**
 * 判断消息列表里是否有尚未完成的工具调用。
 *
 * @param messages - 当前可见对话消息
 * @returns 只要任一 tool-call 片段尚无 result 字段，就返回 true
 */
export function hasActiveToolCall(messages: ChatMessage[]): boolean {
  return messages.some((message) =>
    message.parts.some((part) => part.type === 'tool-call' && part.result === undefined)
  )
}
