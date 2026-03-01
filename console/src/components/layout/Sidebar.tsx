import { useProjectContext } from "../../contexts/ProjectContext"
import { Link, useLocation } from "react-router-dom"
import { Settings } from "lucide-react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
export function Sidebar() {
  const { projects, currentProject, setCurrentProject } = useProjectContext()
  const location = useLocation()
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
        {projects.map((project) => (
          <Button
            key={project.projectId}
            onClick={() => setCurrentProject(project.projectId)}
            sx={{
              width: "100%",
              px: 2,
              py: 1.5,
              textAlign: "left",
              justifyContent: "flex-start",
              borderBottom: 1,
              borderColor: "divider",
              borderRadius: 0,
              ...(currentProject === project.projectId && {
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
        ))}
      </Box>
      <Box sx={{ borderTop: 1, borderColor: "divider", p: 1 }}>
        <Button
          component={Link}
          to="/projects"
          startIcon={<Settings />}
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
}
