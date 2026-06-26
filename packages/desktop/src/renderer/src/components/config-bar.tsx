import { useCallback, useMemo, useState } from 'react'
import type { ReasoningLevel } from '@hermes/shared'
import { REASONING_LEVELS, REASONING_LABELS } from '@hermes/shared'
import { GatewayClient } from '@/lib/gateway-client'
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
import { useConfigStore } from '@/stores/use-config-store'

export interface ConfigBarProps {
  clientRef: React.RefObject<GatewayClient | null>
}

/**
 * 配置栏：模型选择 + 思考强度滑块。
 *
 * 从 Zustand store 读取模型/推理配置，通过 GatewayClient 执行配置变更。
 */
export function ConfigBar({ clientRef }: ConfigBarProps): React.JSX.Element {
  const providers = useConfigStore((s) => s.providers)
  const currentModel = useConfigStore((s) => s.currentModel)
  const currentProvider = useConfigStore((s) => s.currentProvider)
  const reasoningEffort = useConfigStore((s) => s.reasoningEffort)
  const setModel = useConfigStore((s) => s.setModel)
  const setReasoningEffort = useConfigStore((s) => s.setReasoningEffort)

  const [dragValue, setDragValue] = useState<number | null>(null)
  const sliderValue = dragValue ?? REASONING_LEVELS.indexOf(reasoningEffort)
  const effortLabel =
    REASONING_LABELS[
      dragValue != null ? (REASONING_LEVELS[dragValue] as ReasoningLevel) : reasoningEffort
    ]
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

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedModelValue}
        onValueChange={handleModelChange}
        disabled={modelItems.length === 0}
      >
        <SelectTrigger className="h-7 text-xs max-w-[200px]">
          <SelectValue placeholder="选择模型…">
            {currentModel ? (currentModel.split('/').slice(-1)[0] ?? currentModel) : '选择模型…'}
          </SelectValue>
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

      <div className="flex items-center gap-1.5 min-w-[140px]">
        <Slider
          min={0}
          max={5}
          step={1}
          value={[sliderValue]}
          onValueChange={handleSliderChange}
          onValueCommit={handleSliderCommit}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
          {effortLabel}
        </span>
      </div>
    </div>
  )
}

function selectedModelSelectValue(providerSlug: string, model: string): string {
  if (!providerSlug || !model) return ''
  const providerPrefix = `${providerSlug}/`
  const modelId = model.startsWith(providerPrefix) ? model.slice(providerPrefix.length) : model
  return `${providerSlug}:${modelId}`
}
