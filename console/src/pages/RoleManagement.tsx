import { useParams } from "react-router-dom"
import { useRoles } from "../hooks/useRoles"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Accordion from "@mui/material/Accordion"
import AccordionSummary from "@mui/material/AccordionSummary"
import AccordionDetails from "@mui/material/AccordionDetails"
import Chip from "@mui/material/Chip"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import { Loader2, ChevronDown } from "lucide-react"

export function RoleManagement() {
  const { projectId } = useParams<{ projectId: string }>()
  const { roles, loading, error } = useRoles(projectId)

  // 加载状态
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Loader2 className="h-6 w-6 animate-spin" />
          <Typography color="text.secondary">加载中...</Typography>
        </Box>
      </Box>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="error">加载角色失败: {error.message}</Typography>
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
        {/* 页面标题 */}
        <Box>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            角色管理
          </Typography>
          <Typography variant="body2" color="text.secondary">
            所有可用角色（来自 preset、global 和 project 源）
          </Typography>
        </Box>

        {/* 角色列表 */}
        {roles.length === 0 ? (
          <Typography color="text.secondary">暂无角色</Typography>
        ) : (
          roles.map((role) => (
            <Accordion key={role.name}>
              <AccordionSummary
                expandIcon={<ChevronDown />}
                sx={{
                  "& .MuiAccordionSummary-content": {
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  },
                }}
              >
                <Typography variant="h6">{role.name}</Typography>
                <Chip
                  label={role.source}
                  size="small"
                  color={
                    role.source === "preset"
                      ? "primary"
                      : role.source === "global"
                        ? "secondary"
                        : "default"
                  }
                />
              </AccordionSummary>

              <AccordionDetails>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {/* 描述 */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      描述
                    </Typography>
                    <Typography>{role.description}</Typography>
                  </Box>

                  {/* 必需参数 */}
                  {role.requiredArgs &&
                    Object.keys(role.requiredArgs).length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          必需参数
                        </Typography>
                        <List dense>
                          {Object.entries(role.requiredArgs).map(
                            ([name, spec]) => (
                              <ListItem key={name}>
                                <ListItemText
                                  primary={name}
                                  secondary={`${spec.type}: ${spec.description}`}
                                />
                              </ListItem>
                            )
                          )}
                        </List>
                      </Box>
                    )}

                  {/* 可雇佣角色 */}
                  {role.canHire && role.canHire.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        可雇佣角色
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {role.canHire.map((pattern) => (
                          <Chip key={pattern} label={pattern} size="small" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* 角色组 */}
                  {role.groups && role.groups.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        角色组
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {role.groups.map((group) => (
                          <Chip
                            key={group}
                            label={group}
                            size="small"
                            color="primary"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Box>
    </Box>
  )
}
