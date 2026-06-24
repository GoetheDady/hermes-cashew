# Hermes Desktop

Electron 聊天桌面客户端（MVP）。架构：渲染层 ⇄WS⇄ Node 后端（WS 代理 + 看管 `hermes dashboard` 子进程）⇄WS⇄ Hermes dashboard 的 JSON-RPC 网关（`/api/ws`）。后端持有 dashboard token，前端只连 `ws://localhost:8765/ws`。

## Agent skills

### Issue tracker

Issue 与 PRD 以本地 markdown 文件存放在 `.scratch/<feature>/`，无 GitHub remote。See `docs/agents/issue-tracker.md`.

### Triage labels

5 个 canonical 角色映射到中文标签（待分诊 / 待补充信息 / 可交付-agent / 待人工 / 不予处理）。See `docs/agents/triage-labels.md`.

### Domain docs

单 context：根目录一个 `CONTEXT.md` + `docs/adr/`。See `docs/agents/domain.md`.

## Coding guidelines

行为准则，用于减少常见 LLM 编码失误。来源：[multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)。

**Tradeoff:** 这些准则偏向谨慎而非速度。琐碎任务自行判断。

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

实现前：
- 明确陈述你的假设；不确定就问。
- 存在多种解读时全部列出，不要默默选一个。
- 有更简单的做法就说出来；该反驳时反驳。
- 有不清楚的地方就停下，指明困惑点，发问。

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- 不做要求之外的功能。
- 不为一次性代码做抽象。
- 不加未被要求的"灵活性""可配置性"。
- 不为不可能发生的场景写错误处理。
- 写了 200 行但 50 行能搞定，就重写。

自问："资深工程师会不会觉得这过度设计了？" 会，就简化。

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

改动既有代码时：
- 不"顺手改进"相邻代码、注释或格式。
- 不重构没坏的东西。
- 匹配现有风格，即便你会用别的写法。
- 发现无关的死代码，提一句，别删。

你的改动产生孤儿时：
- 移除因你的改动而失效的 import/变量/函数。
- 未经要求不删既有的死代码。

判据：每一行改动都能直接追溯到用户的请求。

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

把任务转成可验证的目标：
- "加校验" → "为非法输入写测试，再让它通过"
- "修 bug" → "写一个能复现的测试，再让它通过"
- "重构 X" → "确保重构前后测试都通过"

多步任务先给出简短计划：

```
1. [步骤] → verify: [检查]
2. [步骤] → verify: [检查]
3. [步骤] → verify: [检查]
```

强成功判据让你能独立循环；弱判据（"让它能用"）会反复需要澄清。

**这些准则生效的标志：** diff 里无谓改动更少，因过度设计导致的返工更少，澄清式提问出现在实现之前而非犯错之后。

### 5. Comments & JSDoc（项目硬性要求）

**写代码要带注释。本节为项目级约定，优先级高于第 2/3 节中"少注释/匹配现有风格"的通用倾向。**

- 关键、非直观的逻辑必须有注释解释**为什么**这么做（意图、边界、坑），而不只是复述代码在做什么。
- 每个方法/函数都要写符合规范的 JSDoc 注释，至少包含：
  - 一句话功能描述
  - `@param {Type} name` — 每个参数及其含义
  - `@returns {Type}` — 返回值（无返回值可省略或标 `@returns {void}`）
  - 会抛错时标 `@throws`
- TypeScript 里类型已由签名表达，JSDoc 的 `{Type}` 可省略，但**描述、`@param` 说明、`@returns` 语义仍需写全**。
- 公共/导出的 API（跨包 `shared` 类型、后端路由 handler、preload 暴露的接口）注释更要完整。
- 注释随代码改动同步更新，不留过期注释。

示例：

```ts
/**
 * 把前端发来的对话消息转发给 Hermes API，并将其 SSE 流原样中继给调用方。
 *
 * @param messages - 完整对话历史（含本轮用户消息），按时间正序
 * @param model - Hermes 模型 id；未指定时由后端用默认模型兜底
 * @returns 可逐块读取的 SSE 流，每块为一个 OpenAI 兼容的 delta
 * @throws 当 Hermes API 不可达或返回非 2xx 时抛出，由路由层转成友好错误
 */
async function relayChat(messages: ChatMessage[], model?: string): Promise<ReadableStream> {
  // ...
}
```
