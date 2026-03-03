import toast, { Toaster } from "react-hot-toast"

// 统一的 Toast 配置
export const toastConfig = {
  duration: 4000,
  position: "top-right" as const,
  style: {
    background: "#363636",
    color: "#fff",
  },
  success: {
    duration: 3000,
    iconTheme: {
      primary: "#4ade80",
      secondary: "#fff",
    },
  },
  error: {
    duration: 5000,
    iconTheme: {
      primary: "#ef4444",
      secondary: "#fff",
    },
  },
}

// 封装常用的 toast 方法
export const showSuccess = (message: string) => {
  toast.success(message, toastConfig.success)
}

export const showError = (message: string, error?: Error) => {
  // 开发环境显示详细错误
  if (import.meta.env.DEV && error) {
    console.error(error)
  }
  toast.error(message, toastConfig.error)
}

export const showInfo = (message: string) => {
  toast(message, toastConfig)
}

export const showLoading = (message: string) => {
  return toast.loading(message)
}

export { Toaster }
