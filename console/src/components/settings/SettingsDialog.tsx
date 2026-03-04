import { useState } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  CircularProgress,
} from "@mui/material"
import { useSettings } from "../../contexts/SettingsContext"
import type { Settings, ThemeMode } from "../../types/settings"

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings()
  const [localSettings, setLocalSettings] = useState<Settings>(settings)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const handleSave = () => {
    updateSettings(localSettings)
    onClose()
  }

  const handleCancel = () => {
    setLocalSettings(settings)
    setTestResult(null)
    onClose()
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`${localSettings.endpoint}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        setTestResult({
          success: true,
          message: "连接成功！",
        })
      } else {
        setTestResult({
          success: false,
          message: `连接失败: ${response.status} ${response.statusText}`,
        })
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `连接失败: ${error.message || "未知错误"}`,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>设置</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
          {/* 主题设置 */}
          <FormControl fullWidth>
            <InputLabel>主题模式</InputLabel>
            <Select
              value={localSettings.theme}
              label="主题模式"
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  theme: e.target.value as ThemeMode,
                })
              }
            >
              <MenuItem value="light">浅色</MenuItem>
              <MenuItem value="dark">深色</MenuItem>
              <MenuItem value="system">跟随系统</MenuItem>
            </Select>
          </FormControl>

          {/* 语言设置 */}
          <FormControl fullWidth>
            <InputLabel>语言</InputLabel>
            <Select
              value={localSettings.language}
              label="语言"
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  language: e.target.value,
                })
              }
            >
              <MenuItem value="zh-CN">简体中文</MenuItem>
            </Select>
          </FormControl>

          {/* OpenCode 端点设置 */}
          <Box>
            <TextField
              fullWidth
              label="OpenCode 端点"
              value={localSettings.endpoint}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  endpoint: e.target.value,
                })
              }
              placeholder="http://127.0.0.1:4099"
            />
            <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleTestConnection}
                disabled={testing || !localSettings.endpoint}
              >
                {testing ? <CircularProgress size={20} /> : "测试连接"}
              </Button>
              {testResult && (
                <Typography
                  variant="body2"
                  color={testResult.success ? "success.main" : "error.main"}
                >
                  {testResult.message}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>取消</Button>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}
