import { useState, useEffect } from "react"
import { ApiClient } from "../services/api"
import type { Project, CandidateProject } from "../types"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Trash2, Plus, RefreshCw } from "lucide-react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

const apiClient = new ApiClient()

export function ProjectManagement() {
  const [projects, setProjects] = useState<Project[]>([])
  const [candidates, setCandidates] = useState<CandidateProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 添加项目表单状态
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectPath, setNewProjectPath] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [projectsData, candidatesData] = await Promise.all([
        apiClient.getProjects(),
        apiClient.getCandidateProjects(),
      ])
      setProjects(projectsData)
      setCandidates(candidatesData)
    } catch (err: any) {
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleAddProject = async (name: string, path: string) => {
    try {
      await apiClient.addProject(name, path)
      await loadData()
      setNewProjectName("")
      setNewProjectPath("")
    } catch (err: any) {
      setError(err.message || "Failed to add project")
    }
  }

  const handleAddFromCandidate = async (candidate: CandidateProject) => {
    const name = candidate.path.split("/").pop() || "Unnamed Project"
    await handleAddProject(name, candidate.path)
  }

  const handleDeleteProject = async (path: string) => {
    if (!confirm(`Are you sure you want to delete project: ${path}?`)) {
      return
    }

    try {
      await apiClient.deleteProject(path)
      await loadData()
    } catch (err: any) {
      setError(err.message || "Failed to delete project")
    }
  }

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <RefreshCw className="w-8 h-8 animate-spin" />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Box
        sx={{
          maxWidth: "lg",
          mx: "auto",
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h3" fontWeight="bold">
            Project Management
          </Typography>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </Box>

        {error && (
          <Box
            sx={{
              p: 2,
              bgcolor: "error.light",
              color: "error.contrastText",
              borderRadius: 1,
            }}
          >
            <Typography>{error}</Typography>
          </Box>
        )}

        {/* 当前项目列表 */}
        <Card>
          <CardHeader>
            <CardTitle>Current Projects ({projects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Project ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>No projects configured</TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow key={project.projectId}>
                      <TableCell>{project.projectName}</TableCell>
                      <TableCell>{project.directory}</TableCell>
                      <TableCell>{project.projectId}</TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleDeleteProject(project.directory)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 候选项目列表 */}
        <Card>
          <CardHeader>
            <CardTitle>
              Candidate Projects ({candidates.length})
              <Typography variant="body2" color="text.secondary">
                Projects that triggered "Please add this project" warning
              </Typography>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>First Seen</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>No candidate projects</TableCell>
                  </TableRow>
                ) : (
                  candidates.map((candidate) => (
                    <TableRow key={candidate.path}>
                      <TableCell>{candidate.path}</TableCell>
                      <TableCell>
                        {new Date(candidate.firstSeenAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {new Date(candidate.lastSeenAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{candidate.seenCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleAddFromCandidate(candidate)}
                          variant="default"
                          size="sm"
                        >
                          <Plus />
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 手动添加项目 */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box>
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="My Project"
                  value={newProjectName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewProjectName(e.target.value)
                  }
                />
              </Box>
              <Box>
                <Label htmlFor="project-path">Project Path</Label>
                <Input
                  id="project-path"
                  placeholder="/path/to/project"
                  value={newProjectPath}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewProjectPath(e.target.value)
                  }
                />
              </Box>
              <Button
                onClick={() => handleAddProject(newProjectName, newProjectPath)}
                disabled={!newProjectName || !newProjectPath}
              >
                <Plus />
                Add Project
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
