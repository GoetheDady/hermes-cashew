# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

由于本仓库用本地 markdown tracker，"label" 即写在每个 issue 文件顶部的 `Status:` 行里的字符串。

| Label in mattpocock/skills | Label in our tracker（本仓库） | Meaning / 含义                           |
| -------------------------- | ------------------------------ | ---------------------------------------- |
| `needs-triage`             | `待分诊`                       | 维护者需评估此 issue                     |
| `needs-info`               | `待补充信息`                   | 等报告者补充更多信息                     |
| `ready-for-agent`          | `可交付-agent`                 | 规格完整，可交给 AFK agent 直接实现      |
| `ready-for-human`          | `待人工`                       | 需要人工实现                             |
| `wontfix`                  | `不予处理`                     | 不予行动                                 |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table — 即在 issue 文件里写 `Status: 可交付-agent`。

Edit the right-hand column to match whatever vocabulary you actually use.
