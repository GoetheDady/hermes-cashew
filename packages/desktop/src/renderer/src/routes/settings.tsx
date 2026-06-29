import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import type { ReasoningLevel } from '@hermes/shared'
import { REASONING_LEVELS, REASONING_LABELS } from '@hermes/shared'
import { useGateway } from '@/hooks/use-gateway'
import { useMidnightHour } from '@/hooks/use-midnight-hour'
import { useGatewayClient } from '@/contexts/gateway'
import { useConfigStore } from '@/stores/use-config-store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { CashewPresenceIndicator } from '@/components/cashew-presence-indicator'
import { getCashewPresence } from '@/lib/cashew-presence'
import { getTopControlsRowClass, getTrafficLightInsetPx } from '@/lib/window-chrome'
import { ArrowLeft, Cpu, Brain } from 'lucide-react'

/**
 * 设置页面：独立展示模型选择与推理参数配置。
 *
 * 视觉与聊天页共用同一套 Cashew 氛围（time-atmosphere / midnight-atmosphere
 * 背景色温、顶部控制行 + Presence 胶囊、max-w-3xl），避免设置页沦为游离的
 * 通用控制面板。模型/推理配置通过 GatewayClient 直接调用 config.get /
 * config.set，与聊天页共享同一个 client 实例（来自 GatewayProvider）；
 * 列表本身由 GatewayProvider 在握手就绪时拉取，这里只读取 store。
 */
export function Settings(): React.JSX.Element {
  const navigate = useNavigate()
  const clientRef = useGatewayClient()
  const { conn, ready } = useGateway()
  const isMidnight = useMidnightHour()
  const reducedMotion = useReducedMotion()

  const providers = useConfigStore((s) => s.providers)
  const currentModel = useConfigStore((s) => s.currentModel)
  const currentProvider = useConfigStore((s) => s.currentProvider)
  const reasoningEffort = useConfigStore((s) => s.reasoningEffort)
  const setModel = useConfigStore((s) => s.setModel)
  const setReasoningEffort = useConfigStore((s) => s.setReasoningEffort)

  const [dragValue, setDragValue] = useState<number | null>(null)
  const sliderValue = dragValue ?? REASONING_LEVELS.indexOf(reasoningEffort)
  const selectedModelValue = selectedModelSelectValue(currentProvider, currentModel)

  const modelItems = useMemo(() => {
    const items: { providerSlug: string; providerName: string; modelId: string }[] = []
    for (const p of providers) {
      for (const m of p.models) {
        items.push({ providerSlug: p.slug, providerName: p.name, modelId: m })
      }
    }
    return items
  }, [providers])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof modelItems>()
    for (const item of modelItems) {
      const g = map.get(item.providerSlug)
      if (g) g.push(item)
      else map.set(item.providerSlug, [item])
    }
    return map
  }, [modelItems])

  const handleModelChange = (value: string): void => {
    const client = clientRef.current
    if (!client) return
    const [providerSlug, modelId] = value.split(':', 2)
    void setModel(client, providerSlug, modelId).catch(() => {})
  }

  const handleSliderChange = useCallback((value: number[]) => {
    setDragValue(value[0])
  }, [])

  const handleSliderCommit = useCallback(
    (value: number[]) => {
      setDragValue(null)
      const client = clientRef.current
      if (!client) return
      const effort = REASONING_LEVELS[value[0]] as ReasoningLevel
      void setReasoningEffort(client, effort).catch(() => {})
    },
    [clientRef, setReasoningEffort]
  )

  const effortDescriptions: Record<ReasoningLevel, string> = {
    none: '关闭推理，最快响应',
    minimal: '最小推理，几乎不增加延迟',
    low: '轻度推理',
    medium: '中等推理，默认平衡',
    high: '深度推理，质量优先',
    xhigh: '极致推理，最高质量'
  }

  // 设置页没有会话上下文，Presence 只反映连接状态：传 hasActiveSession=true
  // 让 getCashewPresence 跳过「等你选择」等会话分支，落在 ready / connecting /
  // unavailable 上，与设置页语义一致。
  const presence = getCashewPresence({
    conn,
    ready,
    isSessionLoading: false,
    hasActiveSession: true,
    isStreaming: false,
    hasActiveToolCall: false,
    isIdle: false,
    isMidnight
  })

  const topControlsRowClass = getTopControlsRowClass()
  const trafficLightInsetPx = getTrafficLightInsetPx()

  return (
    <div
      className={`time-atmosphere relative flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground${isMidnight ? ' midnight-atmosphere' : ''}`}
    >
      {/* 顶部控制行：与聊天页同款 chrome，左 Presence、右返回聊天。 */}
      <div className={topControlsRowClass} style={{ left: trafficLightInsetPx }}>
        <div className="flex items-center gap-2">
          <CashewPresenceIndicator presence={presence} reducedMotion={reducedMotion} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="app-no-drag h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/chat')}
          title="返回聊天"
        >
          <ArrowLeft className="size-3.5" />
          返回聊天
        </Button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-9">
        <div className="mx-auto w-full max-w-3xl px-6">
          <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理模型选择和推理参数</p>
        </div>

        {/* 设置卡片区：沿用与聊天输入框一致的卡片语言，不加呼吸动效——设置页应当安静。 */}
        <div className="mx-auto mt-8 w-full max-w-3xl space-y-6 px-6">
          {/* 模型选择卡片 */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Cpu className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">模型选择</h2>
                <p className="text-xs text-muted-foreground">选择要使用的 AI 模型</p>
              </div>
            </div>

            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                正在加载模型列表…请先连接到 Hermes 网关。
              </p>
            ) : (
              <Select
                value={selectedModelValue}
                onValueChange={handleModelChange}
                disabled={modelItems.length === 0}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="选择模型…">{currentModel || '选择模型…'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from(grouped.entries()).map(([slug, items]) => (
                    <SelectGroup key={slug}>
                      <SelectLabel>{items[0]?.providerName ?? slug}</SelectLabel>
                      {items.map((item) => (
                        <SelectItem
                          key={`${item.providerSlug}:${item.modelId}`}
                          value={`${item.providerSlug}:${item.modelId}`}
                        >
                          {item.modelId}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}

            {currentModel && (
              <p className="mt-3 text-xs text-muted-foreground">
                当前模型：{currentProvider}/{currentModel}
              </p>
            )}
          </div>

          {/* 推理参数卡片 */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">推理强度</h2>
                <p className="text-xs text-muted-foreground">控制模型思考深度</p>
              </div>
            </div>

            <div className="space-y-4">
              <Slider
                min={0}
                max={5}
                step={1}
                value={[sliderValue]}
                onValueChange={handleSliderChange}
                onValueCommit={handleSliderCommit}
                className="w-full"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{REASONING_LABELS[reasoningEffort]}</span>
                <span className="text-xs text-muted-foreground">
                  {effortDescriptions[reasoningEffort] ?? ''}
                </span>
              </div>
            </div>
          </div>

          {/* 底部留白 */}
          <div className="h-12" />
        </div>
      </div>
    </div>
  )
}

/**
 * 把 store 里的当前 provider/model 还原成 Select 受控值（`${slug}:${modelId}`）。
 *
 * @param providerSlug - 当前 provider slug，如 "anthropic"
 * @param model - 当前模型，可能带 `${slug}/` 前缀，如 "anthropic/claude-sonnet-4.6"
 * @returns 用于 Select value 的 `${slug}:${modelId}`；缺省返回空串
 */
function selectedModelSelectValue(providerSlug: string, model: string): string {
  if (!providerSlug || !model) return ''
  const providerPrefix = `${providerSlug}/`
  const modelId = model.startsWith(providerPrefix) ? model.slice(providerPrefix.length) : model
  return `${providerSlug}:${modelId}`
}
