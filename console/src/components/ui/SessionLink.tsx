import { Link } from "@mui/material"
import { useSettings } from "../../contexts/SettingsContext"
import {
  generateOpenCodeSessionLink,
  truncateSessionId,
} from "../../lib/opencode-link"

interface SessionLinkProps {
  sessionId: string
  projectPath: string
  truncate?: boolean
  truncateLength?: number
}

/**
 * Session ID 链接组件
 * 渲染一个可点击的蓝色链接，跳转到 OpenCode session 页面
 */
export function SessionLink({
  sessionId,
  projectPath,
  truncate = true,
  truncateLength = 8,
}: SessionLinkProps) {
  const { settings } = useSettings()
  const link = generateOpenCodeSessionLink(
    settings.endpoint,
    projectPath,
    sessionId
  )
  const displayText = truncate
    ? truncateSessionId(sessionId, truncateLength)
    : sessionId

  return (
    <Link
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        color: "primary.main",
        textDecoration: "none",
        "&:hover": {
          textDecoration: "underline",
        },
      }}
    >
      {displayText}
    </Link>
  )
}
