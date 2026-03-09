import { ReactNode, useState, useRef, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import { Menu, Moon, Sun, Settings } from "lucide-react"
import useMediaQuery from "@mui/material/useMediaQuery"
import { useTheme } from "@mui/material/styles"
import { useSettings } from "../../contexts/SettingsContext"
import { SettingsDialog } from "../settings/SettingsDialog"

export function Layout({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { toggleTheme, resolvedTheme } = useSettings()
  const location = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [location.pathname])

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
        {/* 顶部工具栏 */}
        <Box
          sx={{
            p: 1,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            display: "flex",
            alignItems: "center",
            justifyContent: isMobile ? "space-between" : "flex-end",
          }}
        >
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
            >
              <Menu />
            </IconButton>
          )}
          <Box sx={{ display: "flex", gap: 1 }}>
            {/* 主题切换按钮 */}
            <IconButton
              onClick={toggleTheme}
              aria-label="toggle theme"
              size="small"
            >
              {resolvedTheme === "dark" ? (
                <Sun size={20} />
              ) : (
                <Moon size={20} />
              )}
            </IconButton>
            {/* 设置按钮 */}
            <IconButton
              onClick={() => setSettingsOpen(true)}
              aria-label="settings"
              size="small"
            >
              <Settings size={20} />
            </IconButton>
          </Box>
        </Box>
        <Box
          ref={contentRef}
          sx={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </Box>
      </Box>

      {/* 设置对话框 */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Box>
  )
}
