import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import { usePeers } from "../../hooks/usePeers"
import useMediaQuery from "@mui/material/useMediaQuery"
import { useTheme } from "@mui/material/styles"

interface ConversationListProps {
  projectId: string
  employeeName: string
  selectedPeer: string | null
  onSelectPeer: (peer: string) => void
}

export function ConversationList({
  projectId,
  employeeName,
  selectedPeer,
  onSelectPeer,
}: ConversationListProps) {
  const { peers, loading } = usePeers(projectId, employeeName)
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
          <ListItem key={peer} disablePadding>
            <ListItemButton
              selected={selectedPeer === peer}
              onClick={() => onSelectPeer(peer)}
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
                primary={peer}
                primaryTypographyProps={{
                  fontWeight: selectedPeer === peer ? "medium" : "normal",
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )
}
