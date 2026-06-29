import dayjs from 'dayjs'

/** 中文星期短标签，和 Session History 的窄宽度列表更匹配。 */
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/**
 * 把 Hermes 会话时间戳规范化为 dayjs 可读取的毫秒时间戳。
 *
 * Hermes session 行使用秒级时间戳；浏览器事件和测试里常用毫秒级时间戳。
 * 这里兼容两者，避免 UI 因数据来源不同显示到 1970 年。
 *
 * @param timestamp - 秒级或毫秒级 Unix 时间戳
 * @returns 毫秒级 Unix 时间戳
 */
function normalizeTimestampMs(timestamp: number): number {
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
}

/**
 * 将会话最近活动时间格式化为侧边栏里的短时间文本。
 *
 * @param timestamp - 最近活动时间，支持秒级或毫秒级 Unix 时间戳
 * @param nowInput - 当前时间；测试传入固定时间，运行时默认使用当前时间
 * @returns 今天显示 HH:mm，昨天显示“昨天”，近一周显示星期，今年显示 M/D，跨年显示 YYYY/M/D
 */
export function formatSessionActivityTime(
  timestamp: number,
  nowInput: Date | number = Date.now()
): string {
  const activity = dayjs(normalizeTimestampMs(timestamp))
  const now = dayjs(nowInput)

  if (activity.isSame(now, 'day')) return activity.format('HH:mm')
  if (activity.isSame(now.subtract(1, 'day'), 'day')) return '昨天'

  const dayDiff = now.startOf('day').diff(activity.startOf('day'), 'day')
  if (dayDiff > 1 && dayDiff < 7) return WEEKDAY_LABELS[activity.day()]

  if (activity.isSame(now, 'year')) return activity.format('M/D')

  return activity.format('YYYY/M/D')
}
