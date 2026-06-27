import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      /** 弹出系统通知。点击后聚焦应用窗口。 */
      showNotification: (title: string, body: string) => void
    }
  }
}
