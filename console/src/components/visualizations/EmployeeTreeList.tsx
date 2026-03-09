import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import IconButton from "@mui/material/IconButton"
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pause,
  Play,
} from "lucide-react"
import type { EmployeeHierarchy, EmployeeStatus } from "../../types"
import { apiClient } from "../../services"

interface EmployeeTreeListProps {
  hierarchy: EmployeeHierarchy
  onRefresh?: () => void
}

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  busy: "#10b981",
  idle: "#eab308",
  error: "#ef4444",
  offline: "#6b7280",
  abnormal: "#f97316",
}

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  busy: "忙碌",
  idle: "空闲",
  error: "错误",
  offline: "离线",
  abnormal: "异常",
}

interface TreeNodeProps {
  node: EmployeeHierarchy
  level: number
  onToggle: (path: string) => void
  expandedNodes: Set<string>
  path: string
  isLast: boolean
  parentLines: boolean[]
  onRefresh?: () => void
}

function TreeNode({
  node,
  level,
  onToggle,
  expandedNodes,
  path,
  isLast,
  parentLines,
  onRefresh,
}: TreeNodeProps) {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedNodes.has(path)
  const indent = level * 32
  const [pauseResumeLoading, setPauseResumeLoading] = useState(false)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      onToggle(path)
    }
  }

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.role === "Boss") {
      navigate(`/projects/${projectId}/boss/${node.name}`)
    } else {
      navigate(`/projects/${projectId}/employee/${node.name}`)
    }
  }

  const handlePauseResume = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!projectId) return

    setPauseResumeLoading(true)
    try {
      if (node.status === "offline") {
        await apiClient.resumeEmployee(projectId, node.name)
      } else {
        await apiClient.pauseEmployee(projectId, node.name)
      }

      // 触发刷新
      onRefresh?.()
    } catch (error) {
      console.error("Pause/Resume failed:", error)
      // TODO: 显示错误提示（可以使用 toast 通知）
    } finally {
      setPauseResumeLoading(false)
    }
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          height: 56,
          paddingLeft: `${indent}px`,
          paddingRight: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          cursor: hasChildren ? "pointer" : "default",
          "&:hover": {
            backgroundColor: "action.hover",
          },
          position: "relative",
          overflow: "hidden",
        }}
        onClick={handleToggle}
      >
        {/* 绘制连接线 */}
        {level > 0 && (
          <svg
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: indent,
              height: 56,
              pointerEvents: "none",
            }}
          >
            {/* 绘制父级的垂直线 */}
            {parentLines.map((shouldDraw, idx) => {
              if (!shouldDraw) return null
              const x = (idx + 1) * 32 - 16
              return (
                <line
                  key={idx}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={56}
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
              )
            })}

            {/* 当前节点的连接线 */}
            <g>
              {/* 垂直线 */}
              <line
                x1={indent - 16}
                y1={0}
                x2={indent - 16}
                y2={isLast ? 28 : 56}
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />
              {/* 水平曲线 */}
              <path
                d={`M ${indent - 16} 28 Q ${indent - 8} 28, ${indent - 8} 28 L ${indent} 28`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />
            </g>
          </svg>
        )}

        {/* 展开/折叠图标 */}
        <Box sx={{ width: 24, height: 24, flexShrink: 0, mr: 1.5 }}>
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )
          ) : null}
        </Box>

        {/* 状态指示器 */}
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: STATUS_COLORS[node.status],
            flexShrink: 0,
            mr: 2,
          }}
          title={STATUS_LABELS[node.status]}
        />

        {/* 员工信息 */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexGrow: 1,
            minWidth: 0,
            overflow: "auto",
            "&::-webkit-scrollbar": {
              height: 6,
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: 3,
            },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 140,
            }}
          >
            {node.name}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flexShrink: 0,
              minWidth: 120,
            }}
          >
            {node.role}
          </Typography>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: STATUS_COLORS[node.status],
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {STATUS_LABELS[node.status]}
            </Typography>
          </Box>
        </Box>

        {/* 暂停/恢复按钮 */}
        {node.role !== "Boss" && (
          <IconButton
            size="small"
            onClick={handlePauseResume}
            disabled={pauseResumeLoading}
            sx={{
              flexShrink: 0,
              ml: 2,
            }}
            title={node.status === "offline" ? "恢复" : "暂停"}
          >
            {node.status === "offline" ? (
              <Play size={16} />
            ) : (
              <Pause size={16} />
            )}
          </IconButton>
        )}

        {/* 查看详情按钮 */}
        <IconButton
          size="small"
          onClick={handleViewDetails}
          sx={{
            flexShrink: 0,
            ml: 1,
          }}
          title="查看详情"
        >
          <ExternalLink size={16} />
        </IconButton>
      </Box>

      {/* 子节点 */}
      {hasChildren && isExpanded && (
        <>
          {node.children.map((child, index) => {
            const childIsLast = index === node.children.length - 1
            const newParentLines = [...parentLines, !isLast]
            return (
              <TreeNode
                key={`${path}-${index}`}
                node={child}
                level={level + 1}
                onToggle={onToggle}
                expandedNodes={expandedNodes}
                path={`${path}-${index}`}
                isLast={childIsLast}
                parentLines={newParentLines}
                onRefresh={onRefresh}
              />
            )
          })}
        </>
      )}
    </>
  )
}

export function EmployeeTreeList({
  hierarchy,
  onRefresh,
}: EmployeeTreeListProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // 默认全部展开 - 递归收集所有节点路径
    const allPaths = new Set<string>()
    const collectPaths = (node: EmployeeHierarchy, path: string) => {
      if (node.children && node.children.length > 0) {
        allPaths.add(path)
        node.children.forEach((child, index) => {
          collectPaths(child, `${path}-${index}`)
        })
      }
    }
    collectPaths(hierarchy, "root")
    return allPaths
  })

  const handleToggle = (path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "auto",
        maxHeight: "70vh",
        backgroundColor: "background.paper",
      }}
    >
      <TreeNode
        node={hierarchy}
        level={0}
        onToggle={handleToggle}
        expandedNodes={expandedNodes}
        path="root"
        isLast={true}
        parentLines={[]}
        onRefresh={onRefresh}
      />
    </Box>
  )
}
