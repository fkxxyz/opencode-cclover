import { useMessages } from "../../hooks/useMessages"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"

interface MessageListProps {
  projectId: string
  employeeId: string
  peer?: string
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function MessageList({ projectId, employeeId, peer }: MessageListProps) {
  const { messages, loading } = useMessages(projectId, employeeId, peer)
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>消息列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }
  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>消息列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography align="center" color="text.secondary">
            暂无消息
          </Typography>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          消息列表{" "}
          {peer && (
            <Typography component="span" variant="body2" color="text.secondary">
              与 {peer}
            </Typography>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            maxHeight: 600,
            overflowY: "auto",
          }}
        >
          {messages.map((message, index) => {
            const isSent = message.direction === "send"
            return (
              <Box
                key={`${message.timestamp}-${index}`}
                sx={{
                  display: "flex",
                  justifyContent: isSent ? "flex-end" : "flex-start",
                }}
              >
                <Box
                  sx={{
                    maxWidth: "70%",
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: isSent
                      ? "primary.main"
                      : (theme) =>
                          theme.palette.mode === "dark"
                            ? "grey.800"
                            : "grey.200",
                    color: isSent
                      ? "primary.contrastText"
                      : (theme) =>
                          theme.palette.mode === "dark"
                            ? "grey.100"
                            : "grey.900",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" fontWeight="medium">
                      {isSent ? message.from : message.from}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isSent
                          ? "rgba(255, 255, 255, 0.7)"
                          : (theme) =>
                              theme.palette.mode === "dark"
                                ? "grey.400"
                                : "text.secondary",
                      }}
                    >
                      {formatTimestamp(message.timestamp)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {message.content}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
}
