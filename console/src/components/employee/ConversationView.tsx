import { useEffect, useState } from "react"
import { Card, CardContent } from "../ui/card"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import useMediaQuery from "@mui/material/useMediaQuery"
import { useTheme } from "@mui/material/styles"
import { ConversationList } from "./ConversationList"
import { MessagePanel } from "./MessagePanel"

interface ConversationViewProps {
  projectId: string
  employeeName: string
  selectedPeer?: string | null
  onPeerChange?: (peer: string | null) => void
}

export function ConversationView({
  projectId,
  employeeName,
  selectedPeer: externalSelectedPeer,
  onPeerChange,
}: ConversationViewProps) {
  const [internalSelectedPeer, setInternalSelectedPeer] = useState<string | null>(null)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))
  // 使用外部传入的 selectedPeer，如果没有则使用内部状态
  const selectedPeer = externalSelectedPeer !== undefined ? externalSelectedPeer : internalSelectedPeer
  // 同步外部状态到内部状态
  useEffect(() => {
    if (externalSelectedPeer !== undefined) {
      setInternalSelectedPeer(externalSelectedPeer)
    }
  }, [externalSelectedPeer])

  const handleSelectPeer = (peer: string) => {
    if (onPeerChange) {
      onPeerChange(peer)
    } else {
      setInternalSelectedPeer(peer)
    }
  }

  const handleBack = () => {
    if (onPeerChange) {
      onPeerChange(null)
    } else {
      setInternalSelectedPeer(null)
    }
  }

  return (
    <Card>
      <CardContent sx={{ p: 0, height: 600, display: "flex" }}>
        {/* 移动端：显示对话列表或消息面板 */}
        {isMobile ? (
          <>
            {!selectedPeer ? (
              <ConversationList
                projectId={projectId}
                employeeName={employeeName}
                selectedPeer={selectedPeer}
                onSelectPeer={handleSelectPeer}
              />
            ) : (
              <MessagePanel
                projectId={projectId}
                employeeName={employeeName}
                peer={selectedPeer}
                onBack={handleBack}
              />
            )}
          </>
        ) : (
          /* 桌面端：双栏布局 */
          <>
            <ConversationList
              projectId={projectId}
              employeeName={employeeName}
              selectedPeer={selectedPeer}
              onSelectPeer={handleSelectPeer}
            />
            {selectedPeer ? (
              <MessagePanel
                projectId={projectId}
                employeeName={employeeName}
                peer={selectedPeer}
              />
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography color="text.secondary">请选择一个对话</Typography>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
