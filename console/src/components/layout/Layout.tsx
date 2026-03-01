import { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import Box from "@mui/material/Box"

export function Layout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Sidebar />
      <Box sx={{ flex: 1, overflow: "auto" }}>{children}</Box>
    </Box>
  )
}
