import { useState } from "react"
import { Box, Typography } from "@mui/material"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import type { Memory } from "../../types/index"
interface MemoryViewProps {
  memory: Memory
}
export function MemoryView({ memory }: MemoryViewProps) {
  const [isCustomExpanded, setIsCustomExpanded] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle>记忆</CardTitle>
      </CardHeader>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* 经验知识 */}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            经验知识
          </Typography>
          {memory.knowledge.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              暂无经验知识
            </Typography>
          ) : (
            <Box
              component="ul"
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                m: 0,
                p: 0,
                listStyle: "none",
              }}
            >
              {memory.knowledge.map((item, index) => (
                <Box
                  component="li"
                  key={index}
                  sx={{
                    fontSize: "0.875rem",
                    color: "text.secondary",
                    pl: 2,
                    borderLeft: "2px solid",
                    borderColor: "divider",
                  }}
                >
                  {item}
                </Box>
              ))}
            </Box>
          )}
        </Box>
        {/* 自定义字段 */}
        <Box>
          <Box
            component="button"
            onClick={() => setIsCustomExpanded(!isCustomExpanded)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              background: "none",
              cursor: "pointer",
              p: 0,
              color: "text.primary",
              transition: "color 0.2s",
              "&:hover": {
                color: "primary.main",
              },
            }}
          >
            {isCustomExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            自定义字段
          </Box>
          {isCustomExpanded && (
            <Box sx={{ mt: 1 }}>
              {Object.keys(memory.custom).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  暂无自定义字段
                </Typography>
              ) : (
                <Box
                  component="pre"
                  sx={{
                    fontSize: "0.75rem",
                    bgcolor: "background.default",
                    p: 1.5,
                    borderRadius: 1,
                    overflowX: "auto",
                    m: 0,
                  }}
                >
                  {JSON.stringify(memory.custom, null, 2)}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
