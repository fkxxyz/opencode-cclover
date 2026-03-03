import { ReactNode, useState } from "react"
import { Sidebar } from "./Sidebar"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import { Menu } from "lucide-react"
import useMediaQuery from "@mui/material/useMediaQuery"
import { useTheme } from "@mui/material/styles"

export function Layout({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Sidebar
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isMobile && (
          <Box
            sx={{
              p: 1,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
            >
              <Menu />
            </IconButton>
          </Box>
        )}
        <Box sx={{ flex: 1, overflow: "auto" }}>{children}</Box>
      </Box>
    </Box>
  )
}
