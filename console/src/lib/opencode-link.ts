/**
 * 生成 OpenCode session 链接
 * @param endpoint OpenCode 端点 (例如: http://127.0.0.1:4099)
 * @param projectPath 项目路径 (例如: /run/media/fkxxyz/wsl/home/fkxxyz/pro/fkxxyz/opencode-cclover)
 * @param sessionId Session ID (例如: ses_349cbf9a9ffeMfPuKPnxlQ2hhZ)
 * @returns OpenCode session 链接
 */
export function generateOpenCodeSessionLink(
  endpoint: string,
  projectPath: string,
  sessionId: string
): string {
  // 对项目路径进行 base64 编码
  const encodedPath = btoa(projectPath)
  return `${endpoint}/${encodedPath}/session/${sessionId}`
}

/**
 * 截断 session id 用于显示
 * @param sessionId Session ID
 * @param length 保留的字符数 (默认 8)
 * @returns 截断后的 session id
 */
export function truncateSessionId(sessionId: string, length = 8): string {
  return `${String(sessionId).slice(0, length)}...`
}
