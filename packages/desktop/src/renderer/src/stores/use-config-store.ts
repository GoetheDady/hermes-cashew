import { create } from 'zustand'
import type {
  ModelOptionProvider,
  ModelOptionsResult,
  ReasoningConfigResult,
  ReasoningLevel
} from '@hermes/shared'
import { REASONING_LEVELS } from '@hermes/shared'
import type { GatewayClient } from '@/lib/gateway-client'

/**
 * 模型 / 思考强度配置 store。
 *
 * 初始化时从网关拉取当前配置，用户变更后即时通过 config.set 写回网关。
 * GatewayClient 由外部注入（store 不持有连接生命周期）。
 */
interface ConfigState {
  // ── 模型 ──
  providers: ModelOptionProvider[]
  currentModel: string
  currentProvider: string
  modelsLoading: boolean
  modelsError: string | null

  // ── 思考强度 ──
  reasoningEffort: ReasoningLevel
  reasoningLoading: boolean
  reasoningError: string | null

  // ── Actions ──
  /** 拉取模型列表及当前模型。client 为当前已连接的网关客户端。 */
  fetchModelOptions: (client: GatewayClient) => Promise<void>

  /** 拉取当前思考强度配置。 */
  fetchReasoningConfig: (client: GatewayClient) => Promise<void>

  /** 切换模型，即时写入网关。 */
  setModel: (client: GatewayClient, providerSlug: string, modelId: string) => Promise<void>

  /** 切换思考强度，即时写入网关。 */
  setReasoningEffort: (client: GatewayClient, effort: ReasoningLevel) => Promise<void>
}

function modelValue(modelId: string, providerSlug: string): string {
  return `${modelId} --provider ${providerSlug}`
}

function parseReasoning(raw: unknown): ReasoningLevel {
  if (typeof raw === 'string' && (REASONING_LEVELS as readonly string[]).includes(raw)) {
    return raw as ReasoningLevel
  }
  return 'medium'
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  // ── 初始值 ──
  providers: [],
  currentModel: '',
  currentProvider: '',
  modelsLoading: false,
  modelsError: null,

  reasoningEffort: 'medium',
  reasoningLoading: false,
  reasoningError: null,

  // ── fetchModelOptions ──
  fetchModelOptions: async (client: GatewayClient) => {
    set({ modelsLoading: true, modelsError: null })
    try {
      const result = await client.request<ModelOptionsResult>('model.options')
      set({
        providers: result.providers ?? [],
        currentModel: result.model ?? '',
        currentProvider: result.provider ?? '',
        modelsLoading: false
      })
    } catch (e) {
      set({
        modelsLoading: false,
        modelsError: e instanceof Error ? e.message : '获取模型列表失败'
      })
    }
  },

  // ── fetchReasoningConfig ──
  fetchReasoningConfig: async (client: GatewayClient) => {
    set({ reasoningLoading: true, reasoningError: null })
    try {
      const result = await client.request<ReasoningConfigResult>('config.get', {
        key: 'reasoning'
      })
      set({
        reasoningEffort: parseReasoning(result.value),
        reasoningLoading: false
      })
    } catch (e) {
      set({
        reasoningLoading: false,
        reasoningError: e instanceof Error ? e.message : '获取思考强度失败'
      })
    }
  },

  // ── setModel ──
  setModel: async (client: GatewayClient, providerSlug: string, modelId: string) => {
    const prev = { model: get().currentModel, provider: get().currentProvider }

    // 乐观更新
    set({ currentModel: `${providerSlug}/${modelId}`, currentProvider: providerSlug })

    try {
      await client.request('config.set', {
        key: 'model',
        value: modelValue(modelId, providerSlug)
      })
      // 选中后刷新 provider 列表以更新 is_current 标记
      try {
        const refreshed = await client.request<ModelOptionsResult>('model.options')
        set({
          providers: refreshed.providers ?? [],
          currentModel: refreshed.model ?? get().currentModel,
          currentProvider: refreshed.provider ?? get().currentProvider
        })
      } catch {
        /* 刷新失败不阻塞，保持乐观状态 */
      }
    } catch (e) {
      // 回滚
      set({ currentModel: prev.model, currentProvider: prev.provider })
      throw e
    }
  },

  // ── setReasoningEffort ──
  setReasoningEffort: async (client: GatewayClient, effort: ReasoningLevel) => {
    const prev = get().reasoningEffort

    // 乐观更新
    set({ reasoningEffort: effort })

    try {
      await client.request('config.set', {
        key: 'reasoning',
        value: effort
      })
    } catch (e) {
      // 回滚
      set({ reasoningEffort: prev })
      throw e
    }
  }
}))
