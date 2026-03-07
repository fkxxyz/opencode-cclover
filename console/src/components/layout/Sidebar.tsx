import { Link, useLocation, useParams } from "react-router-dom"
import { Settings, Users } from "lucide-react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Drawer from "@mui/material/Drawer"
import { apiClient } from "../../services"
import { useEffect, useState } from "react"
import type { Project } from "../../types"
interface SidebarProps {
  isMobile: boolean
  mobileOpen: boolean
  onClose: () => void
}
export function Sidebar({ isMobile, mobileOpen, onClose }: SidebarProps) {
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
  const sidebarContent = (
    <Box
      sx={{
        width: 256,
        display: "flex",
        flexDirection: "column",
        height: "100%",
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
              onClick={isMobile ? onClose : undefined}
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
        {projectId && (
          <Button
            component={Link}
            to={`/projects/${projectId}/roles`}
            startIcon={<Users />}
            onClick={isMobile ? onClose : undefined}
            sx={{
              width: "100%",
              justifyContent: "flex-start",
              ...(location.pathname === `/projects/${projectId}/roles` && {
                bgcolor: "primary.light",
                color: "primary.main",
              }),
            }}
          >
            Roles
          </Button>
        )}
        <Button
          component={Link}
          to="/projects"
          startIcon={<Settings />}
          onClick={isMobile ? onClose : undefined}
          sx={{
            width: "100%",
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
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: 256,
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    )
  }
  return (
    <Box
      sx={{
        width: 256,
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      {sidebarContent}
    </Box>
  )
}
