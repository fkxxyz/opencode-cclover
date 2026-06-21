import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Layout } from "./components/layout/Layout"
import {
  Overview,
  EmployeeDetail,
  ProjectManagement,
  BossDetail,
  RoleManagement,
  BossProfile,
  EmployeeProfile,
} from "./pages"
import { Toaster } from "./lib/toast"
function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectManagement />} />
          <Route path="/projects/:projectId" element={<Overview />} />
          <Route
            path="/projects/:projectId/employee/:employeeId"
            element={<EmployeeDetail />}
          />
          <Route
            path="/projects/:projectId/employee/:employeeId/profile"
            element={<EmployeeProfile />}
          />
          <Route
            path="/projects/:projectId/boss/:name"
            element={<BossDetail />}
          />
          <Route
            path="/projects/:projectId/boss/:name/profile"
            element={<BossProfile />}
          />
          <Route
            path="/projects/:projectId/roles"
            element={<RoleManagement />}
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
export default App
