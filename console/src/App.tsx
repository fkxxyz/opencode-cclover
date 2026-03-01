import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ProjectProvider } from "./contexts/ProjectContext"
import { Layout } from "./components/layout/Layout"
import { Overview, EmployeeDetail } from "./pages"
function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Layout>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/employee/:name" element={<EmployeeDetail />} />
            </Routes>
          </div>
        </Layout>
      </ProjectProvider>
    </BrowserRouter>
  )
}
export default App
