import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Box } from "@mui/material"
import { Layout } from "./components/layout/Layout"
import {
  Overview,
  EmployeeDetail,
  ProjectManagement,
  BossDetail,
  RoleManagement,
} from "./pages"
import { Toaster } from "./lib/toast"
function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Layout>
        <Box sx={{ minHeight: "100vh" }}>
          <Routes>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectManagement />} />
            <Route path="/projects/:projectId" element={<Overview />} />
            <Route
              path="/projects/:projectId/employee/:name"
              element={<EmployeeDetail />}
            />
            <Route
              path="/projects/:projectId/boss/:name"
              element={<BossDetail />}
            />
            <Route
              path="/projects/:projectId/roles"
              element={<RoleManagement />}
            />
          </Routes>
        </Box>
      </Layout>
    </BrowserRouter>
  )
}
export default App
