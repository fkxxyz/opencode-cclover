import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Box } from "@mui/material"
import { ProjectProvider } from "./contexts/ProjectContext"
import { Layout } from "./components/layout/Layout"
import { Overview, EmployeeDetail, ProjectManagement } from "./pages"
function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Layout>
          <Box sx={{ minHeight: "100vh" }}>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/employee/:name" element={<EmployeeDetail />} />
              <Route path="/projects" element={<ProjectManagement />} />
            </Routes>
          </Box>
        </Layout>
      </ProjectProvider>
    </BrowserRouter>
  )
}
export default App
