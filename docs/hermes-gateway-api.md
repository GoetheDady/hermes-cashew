# Hermes TUI Gateway JSON-RPC API 参考

**传输层:** WebSocket (`/api/ws`) 或 stdio，换行分隔的 JSON-RPC 2.0 帧。

**连接流程:** WebSocket 连接建立后，服务端立即推送 `gateway.ready` 事件。客户端随后发送请求（带 `id`、`method`、`params`），服务端返回对应 `id` 的响应。

**错误码:**
- `-32700` 解析错误
- `-32600` 无效请求
- `-32601` 未知方法
- `-32602` 无效参数
- `-32000` 通用处理错误
- `4001-5035` 应用级错误

---

## Session 方法

### `session.create`
创建新会话。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cols` | `int` | 否 | 终端列宽，默认 80 |

**返回:**
```json
{
    "session_id": "ab12cd34",
    "info": {
        "model": "anthropic/claude-sonnet-4.6",
        "tools": {},
        "skills": {},
        "cwd": "/home/user/project",
        "lazy": true
    }
}
```

### `session.list`
列出已存储的会话。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | `int` | 否 | 最大返回数，默认 200 |

**返回:**
```json
{
    "sessions": [
        {
            "id": "20250101_120000_abc123",
            "title": "我的对话",
            "preview": "前几个字符...",
            "started_at": 1735718400,
            "last_activity_at": 1735720200,
            "message_count": 42,
            "source": "tui"
        }
    ]
}
```

### `session.resume`
恢复已有会话。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 会话 ID |
| `cols` | `int` | 否 | 终端列宽 |

**返回:**
```json
{
    "session_id": "ef56gh78",
    "resumed": "20250101_120000_abc123",
    "message_count": 10,
    "messages": [
        {"role": "user", "text": "你好"},
        {"role": "assistant", "text": "你好！"}
    ]
}
```

### `session.delete`
删除会话。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 会话 ID |

### `session.title`
获取或设置会话标题。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 会话 ID |
| `title` | `string` | 否 | 省略则获取，提供则设置 |

### `session.usage`
获取当前会话的 token 用量。

**返回:**
```json
{
    "model": "anthropic/claude-sonnet-4.6",
    "input": 1234, "output": 567,
    "cache_read": 0, "cache_write": 0,
    "reasoning": 89,
    "total": 1801, "calls": 3,
    "context_used": 1500, "context_max": 200000,
    "context_percent": 1,
    "cost_usd": 0.0123
}
```

### `session.history`
获取会话消息历史。

### `session.undo`
撤销最后一轮对话。

### `session.compress`
压缩会话历史。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 会话 ID |
| `focus_topic` | `string` | 否 | 压缩聚焦主题 |

### `session.close` / `session.branch` / `session.interrupt` / `session.steer`
关闭 / 分支 / 中断 / 引导会话。

---

## Prompt 方法

### `prompt.submit`
提交用户消息，启动 agent 回合。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 会话 ID |
| `text` | `string` | 是 | 用户消息文本 |

> **重要:** 此方法仅接受 `session_id` 和 `text`。模型和思考强度通过 `config.set` 设置，不在 prompt 层面传递。

**返回:** `{"status": "streaming"}`（实际响应通过事件流推送）

### `prompt.background`
后台 agent 执行消息。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 父会话 ID |
| `text` | `string` | 是 | 后台消息文本 |

---

## Model 方法

### `model.options`
获取可用的 provider 及模型列表（供模型选择器使用）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 否 | 会话 ID（用于覆盖当前活跃模型信息） |

**返回:**
```json
{
    "providers": [
        {
            "slug": "anthropic",
            "name": "Anthropic",
            "is_current": true,
            "is_user_defined": false,
            "models": [
                "claude-sonnet-4-20250514",
                "claude-opus-4-20250514"
            ],
            "total_models": 10,
            "source": "built-in",
            "authenticated": true,
            "auth_type": "api_key",
            "key_env": "ANTHROPIC_API_KEY",
            "warning": ""
        }
    ],
    "model": "anthropic/claude-sonnet-4.6",
    "provider": "anthropic"
}
```

**Provider 字段说明:**

| 字段 | 类型 | 说明 |
|------|------|------|
| `slug` | `string` | Provider 标识（如 "anthropic"） |
| `name` | `string` | 显示名称 |
| `is_current` | `bool` | 是否为当前选中 provider |
| `is_user_defined` | `bool` | 是否为用户自定义 provider |
| `models` | `array[string]` | 精选的 agentic 模型 ID 列表（最多 50 个） |
| `total_models` | `int` | 截断前的总数 |
| `source` | `string` | `"built-in"` / `"models.dev"` / `"user-config"` |
| `authenticated` | `bool` | 是否已配置凭证 |
| `auth_type` | `string` | 认证类型 |
| `key_env` | `string` | API key 环境变量名 |
| `warning` | `string` | 未配置时的提示文本 |

### `model.save_key`
保存 provider 的 API key。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | `string` | 是 | Provider 标识 |
| `api_key` | `string` | 是 | API key 值 |

### `model.disconnect`
移除 provider 的凭证。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | `string` | 是 | Provider 标识 |

---

## Config 方法

### `config.set`
设置配置值。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `string` | 是 | 配置键 |
| `value` | varies | 是 | 配置值 |
| `session_id` | `string` | 否 | 会话 ID |

**与模型/思考相关的 key:**

| Key | Value | 说明 |
|-----|-------|------|
| `model` | `"anthropic/claude-sonnet-4.6"` | 切换模型，也可用 `"/model claude-opus-4 --provider anthropic"` 语法 |
| `reasoning` | `"none"` / `"minimal"` / `"low"` / `"medium"` / `"high"` / `"xhigh"` | 设置思考强度 |
| `fast` | `"on"` / `"off"` / `"toggle"` | 快速模式切换 |

### `config.get`
读取配置值。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `string` | 是 | 配置键 |

**常用 key:** `provider`, `reasoning`, `fast`, `prompt`, `skin`

### `config.show`
显示结构化配置摘要。无需参数。

---

## Prompt 发送流程中产生的事件

回合内按序推送的事件：

| 事件类型 | Payload | 时机 |
|---------|---------|------|
| `message.start` | 无 | 回合开始 |
| `thinking.delta` | `{"text": "..."}` | 思考内容流 |
| `reasoning.delta` | `{"text": "..."}` | 推理内容流 |
| `message.delta` | `{"text": "...", "rendered": "..."}` | 响应流 |
| `tool.start` | `{"tool_id": "...", "name": "..."}` | 工具调用开始 |
| `tool.complete` | `{"tool_id": "...", "duration_s": 1.5}` | 工具调用完成 |
| `message.complete` | `{"text": "...", "usage": {...}, "status": "complete"}` | 回合结束 |
| `status.update` | `{"kind": "...", "text": "..."}` | 状态更新 |
| `approval.request` | 审批数据 | 需要工具审批 |
| `error` | `{"message": "..."}` | 错误通知 |

---

## 其他方法速览

| 分类 | 方法 |
|------|------|
| 命令 | `commands.catalog`, `command.resolve`, `command.dispatch`, `slash.exec` |
| 工具 | `tools.list`, `tools.show`, `tools.configure`, `toolsets.list` |
| 响应 | `clarify.respond`, `sudo.respond`, `secret.respond`, `approval.respond` |
| 委托 | `delegation.status`, `delegation.pause`, `subagent.interrupt` |
| 生成树 | `spawn_tree.save`, `spawn_tree.list`, `spawn_tree.load` |
| 图片 | `clipboard.paste`, `image.attach`, `input.detect_drop` |
| 语音 | `voice.toggle`, `voice.record`, `voice.tts` |
| 回滚 | `rollback.list`, `rollback.restore`, `rollback.diff` |
| 补全 | `complete.path`, `complete.slash` |
| 系统 | `setup.status`, `process.stop`, `reload.mcp`, `reload.env` |
| 其他 | `browser.manage`, `shell.exec`, `skills.manage`, `cron.manage`, `plugins.list`, `agents.list`, `insights.get`, `paste.collapse`, `cli.exec` |

---

## 事件类型全集（服务端 → 客户端）

| 事件 | 说明 |
|------|------|
| `gateway.ready` | WebSocket 握手完成 |
| `session.info` | Agent 就绪 / 模型切换 / 人格变化 |
| `message.start` | 回合开始 |
| `message.delta` | 流式响应增量 |
| `message.complete` | 回合完成 |
| `thinking.delta` | 思考增量 |
| `reasoning.delta` | 推理增量 |
| `tool.start` | 工具调用开始 |
| `tool.complete` | 工具调用完成 |
| `tool.progress` | 工具进度更新 |
| `status.update` | 状态栏更新 |
| `approval.request` | 工具审批请求 |
| `clarify.request` | 澄清请求 |
| `sudo.request` | Sudo 密码请求 |
| `secret.request` | 密钥请求 |
| `error` | 错误通知 |
| `background.complete` | 后台 agent 完成 |
| `voice.transcript` | 语音转录 |
| `skin.changed` | 主题切换 |
| `subagent.*` | 子 agent 生命周期 |
