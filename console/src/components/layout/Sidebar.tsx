import { Link, useLocation, useParams } from "react-router-dom"
import { Settings } from "lucide-react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import { apiClient } from "../../services"
import { useEffect, useState } from "react"
import type { Project } from "../../types"
export function Sidebar() {
  const location = useLocation()
  const { projectId } = useParams<{ projectId?: string }>()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    apiClient
      .getProjects()
      .then(setProjects)
      .catch((err) => console.error("获取项目列表失败:", err))
      .finally(() => setLoading(false))
  }, [])
  return (
    <Box
      sx={{
        width: 256,
        borderRight: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6">Projects</Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              加载中...
            </Typography>
          </Box>
        ) : (
          projects.map((project) => (
            <Button
              key={project.projectId}
              component={Link}
              to={`/projects/${project.projectId}`}
              sx={{
                width: "100%",
                px: 2,
                py: 1.5,
                textAlign: "left",
                justifyContent: "flex-start",
                borderBottom: 1,
                borderColor: "divider",
                borderRadius: 0,
                ...(projectId === project.projectId && {
                  bgcolor: "primary.light",
                  borderLeft: 4,
                  borderLeftColor: "primary.main",
                }),
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {project.projectName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {project.directory}
                </Typography>
              </Box>
            </Button>
          ))
        )}
      </Box>
      <Box sx={{ borderTop: 1, borderColor: "divider", p: 1 }}>
        <Button
          component={Link}
          to="/projects"
          startIcon={<Settings />}
          sx={{       width: "100%",
            justifyContent: "flex-start",
            ...(location.pathname === "/projects" && {
              bgcolor: "primary.light",
              color: "primary.main",
            }),
          }}
        >
          Manage Projects
        </Button>
      </Box>
    </Box>
  )
}
