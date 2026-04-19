import { describe, expect, test } from "bun:test"
import {
  getApiBaseUrl,
  getWebSocketUrl,
  resolveBackendOrigin,
} from "./backend-config"

describe("backend config", () => {
  test("开发模式允许使用环境变量覆盖 backend origin", () => {
    const origin = resolveBackendOrigin({
      dev: true,
      envBackendOrigin: "http://localhost:4097",
      windowOrigin: "http://localhost:5173",
    })

    expect(origin).toBe("http://localhost:4097")
    expect(getApiBaseUrl(origin)).toBe("http://localhost:4097/api")
    expect(getWebSocketUrl(origin)).toBe("ws://localhost:4097/ws")
  })

  test("生产模式强制同源并忽略环境变量", () => {
    const origin = resolveBackendOrigin({
      dev: false,
      envBackendOrigin: "http://localhost:4097",
      windowOrigin: "https://console.example.com",
    })

    expect(origin).toBe("https://console.example.com")
    expect(getApiBaseUrl(origin)).toBe("https://console.example.com/api")
    expect(getWebSocketUrl(origin)).toBe("wss://console.example.com/ws")
  })

  test("开发模式未配置环境变量时默认同源", () => {
    const origin = resolveBackendOrigin({
      dev: true,
      envBackendOrigin: undefined,
      windowOrigin: "http://127.0.0.1:5173",
    })

    expect(origin).toBe("http://127.0.0.1:5173")
  })
})
