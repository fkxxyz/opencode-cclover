import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import IconButton from "@mui/material/IconButton"
import { ExternalLink } from "lucide-react"
import { apiClient } from "../../services"
import type { Employee } from "../../types"

export function BossList() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [bosses, setBosses] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return

    apiClient
      .getBosses(projectId)
      .then(setBosses)
      .catch((err: Error) => {
        console.error("获取 boss 列表失败:", err)
      })
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading || bosses.length === 0) {
    return null
  }

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        backgroundColor: "background.paper",
      }}
    >
      {bosses.map((boss, index) => (
        <Box
          key={boss.name}
          sx={{
            display: "flex",
            alignItems: "center",
            height: 56,
            paddingX: 2,
            borderBottom: index < bosses.length - 1 ? "1px solid" : "none",
            borderColor: "divider",
            "&:hover": {
              backgroundColor: "action.hover",
            },
          }}
        >
          {/* Boss 不显示状态指示器 */}

          {/* Boss 信息 */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                flexShrink: 0,
                minWidth: 140,
              }}
            >
              {boss.name}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                flexShrink: 0,
                minWidth: 120,
              }}
            >
              {boss.role}
            </Typography>
          </Box>

          {/* 查看详情按钮 */}
          <IconButton
            size="small"
            onClick={() => navigate(`/projects/${projectId}/boss/${boss.name}`)}
            sx={{
              flexShrink: 0,
              ml: 2,
            }}
            title="查看详情"
          >
            <ExternalLink size={16} />
          </IconButton>
        </Box>
      ))}
    </Box>
  )
}
