import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Hermes Cashew 自己持有的设备级工作空间目录名。 */
const WORKSPACE_DIR_NAME = '.hermes-cashew'

/**
 * 解析 Hermes Cashew 后端的设备级工作空间目录。
 *
 * @returns 当前设备用户 home 下的 `.hermes-cashew` 绝对路径
 */
export function resolveWorkspaceDir(): string {
  return join(homedir(), WORKSPACE_DIR_NAME)
}

/**
 * 确保 Hermes Cashew 的设备级工作空间目录存在。
 *
 * @returns 已确认存在的工作空间绝对路径
 * @throws 当目录无法创建或访问时抛出底层文件系统错误
 */
export async function ensureWorkspaceDir(): Promise<string> {
  const workspaceDir = resolveWorkspaceDir()
  // recursive 让启动过程幂等：目录已存在时不报错，缺失时补齐。
  await mkdir(workspaceDir, { recursive: true })
  return workspaceDir
}
