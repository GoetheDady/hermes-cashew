import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * 渲染进程可调用的通知 API。
 *
 * showNotification 发送到主进程处理——因为 Electron 的 Notification 模块
 * 只能从主进程创建。
 */
const api = {
  /**
   * 弹出系统通知，点击后聚焦当前应用窗口。
   *
   * @param title - 通知标题（通常为 "hermes-cashew"）
   * @param body - 通知正文（Hermes 生成的追问文案）
   */
  showNotification: (title: string, body: string) => {
    ipcRenderer.send('show-notification', { title, body })
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
