import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import useMediaQuery from "@mui/material/useMediaQuery"
import { useTheme } from "@mui/material/styles"
import type { PeerWithLastMessage } from "../../types"

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "刚刚"
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  })
}
interface ConversationListProps {
  selectedPeer: string | null
  onSelectPeer: (peer: string) => void
  peers: PeerWithLastMessage[]
  loading: boolean
}

export function ConversationList({
  selectedPeer,
  onSelectPeer,
  peers,
  loading,
}: ConversationListProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))

  if (loading) {
    return (
      <Box
        sx={{
          width: isMobile ? "100%" : 280,
          borderRight: isMobile ? 0 : 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (peers.length === 0) {
    return (
      <Box
        sx={{
          width: isMobile ? "100%" : 280,
          borderRight: isMobile ? 0 : 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Typography color="text.secondary" variant="body2">
          暂无对话
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: isMobile ? "100%" : 280,
        borderRight: isMobile ? 0 : 1,
        borderColor: "divider",
        minHeight: 0,
        overflowY: "auto",
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle2" fontWeight="medium">
          对话列表
        </Typography>
      </Box>
      <List sx={{ p: 0 }}>
        {peers.map((peer) => (
          <ListItem key={peer.name} disablePadding>
            <ListItemButton
              selected={selectedPeer === peer.name}
              onClick={() => onSelectPeer(peer.name)}
              sx={{
                py: 1.5,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                },
              }}
            >
              <ListItemText
                primary={
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={
                        selectedPeer === peer.name ? "medium" : "normal"
                      }
                    >
                      {peer.name}
                    </Typography>
                    {peer.lastMessageTime && (
                      <Typography
                        variant="caption"
                        sx={{
                          color:
                            selectedPeer === peer.name
                              ? "rgba(255, 255, 255, 0.7)"
                              : "text.secondary",
                          ml: 1,
                        }}
                      >
                        {formatTimestamp(peer.lastMessageTime)}
                      </Typography>
                    )}
                  </Box>
                }
                secondary={
                  peer.lastMessageContent && (
                    <Typography
                      variant="caption"
                      sx={{
                        color:
                          selectedPeer === peer.name
                            ? "rgba(255, 255, 255, 0.7)"
                            : "text.secondary",
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {peer.lastMessageContent}
                    </Typography>
                  )
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )
}
