import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Overview, EmployeeDetail } from "./pages"

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/employee/:name" element={<EmployeeDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App