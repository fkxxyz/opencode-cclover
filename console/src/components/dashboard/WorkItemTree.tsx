import { useCallback, useEffect, useMemo, useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import { AlertCircle, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { apiClient } from "../../services"
import type { Employee, RootTask, WorkItem } from "../../types"
import {
  buildWorkItemTree,
  getLatestRootTask,
  type WorkItemTreeNode,
} from "./workItemTreeModel"

interface WorkItemTreeProps {
  projectId: string
}

interface WorkItemNodeProps {
  node: WorkItemTreeNode
  level: number
  selectedWorkItemId: string | null
  expandedNodes: Set<string>
  employeeNamesById: Map<string, string>
  onSelect: (node: WorkItemTreeNode) => void
  onToggle: (workItemId: string) => void
}

function getEmployeeDisplayName(
  employeeId: string,
  employeeNamesById: Map<string, string>
) {
  const name = employeeNamesById.get(employeeId)
  if (!name) return `未知员工：${employeeId}`
  return `${name} (${employeeId})`
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "无"
}

function WorkItemNode({
  node,
  level,
  selectedWorkItemId,
  expandedNodes,
  employeeNamesById,
  onSelect,
  onToggle,
}: WorkItemNodeProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedNodes.has(node.workItem.workItemId)
  const isSelected = selectedWorkItemId === node.workItem.workItemId

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (hasChildren) onToggle(node.workItem.workItemId)
  }

  return (
    <>
      <Box
        onClick={() => onSelect(node)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          minHeight: 48,
          pl: 1 + level * 3,
          pr: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          cursor: "pointer",
          backgroundColor: isSelected ? "action.selected" : "background.paper",
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        <Box
          onClick={handleToggle}
          sx={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={18} />
            ) : (
              <ChevronRight size={18} />
            )
          ) : null}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {node.workItem.description || node.workItem.workItemId}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {node.workItem.workItemId} ·{" "}
            {getEmployeeDisplayName(
              node.workItem.employeeId,
              employeeNamesById
            )}
          </Typography>
        </Box>
        {node.unresolvedParentWorkItemId && (
          <Chip size="small" color="warning" label="父项缺失" />
        )}
      </Box>
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <WorkItemNode
            key={child.workItem.workItemId}
            node={child}
            level={level + 1}
            selectedWorkItemId={selectedWorkItemId}
            expandedNodes={expandedNodes}
            employeeNamesById={employeeNamesById}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
        {value || "无"}
      </Typography>
    </Box>
  )
}

function WorkItemDetail({
  node,
  employeeNamesById,
}: {
  node: WorkItemTreeNode | null
  employeeNamesById: Map<string, string>
}) {
  if (!node) {
    return (
      <Typography variant="body2" color="text.secondary">
        选择一个工作项查看详情。
      </Typography>
    )
  }

  const workItem = node.workItem
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {node.unresolvedParentWorkItemId && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AlertCircle size={16} />
          <Typography variant="caption" color="warning.main">
            未解析父工作项：{node.unresolvedParentWorkItemId}
          </Typography>
        </Box>
      )}
      <DetailRow label="workItemId" value={workItem.workItemId} />
      <DetailRow label="rootTaskId" value={workItem.rootTaskId} />
      <DetailRow
        label="parentWorkItemId"
        value={workItem.parentWorkItemId ?? "无"}
      />
      <DetailRow
        label="employeeId"
        value={getEmployeeDisplayName(workItem.employeeId, employeeNamesById)}
      />
      <DetailRow label="description" value={workItem.description} />
      <DetailRow label="dependsOn" value={formatList(workItem.dependsOn)} />
      <DetailRow label="worktreeRef" value={workItem.worktreeRef ?? "无"} />
      <DetailRow label="createdAt" value={workItem.createdAt} />
      <DetailRow label="updatedAt" value={workItem.updatedAt} />
    </Box>
  )
}

export function WorkItemTree({ projectId }: WorkItemTreeProps) {
  const [rootTasks, setRootTasks] = useState<RootTask[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<WorkItemTreeNode | null>(
    null
  )
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const latestRootTask = useMemo(
    () => getLatestRootTask(rootTasks),
    [rootTasks]
  )
  const tree = useMemo(() => buildWorkItemTree(workItems), [workItems])
  const allNodes = useMemo(
    () => [...tree.rootNodes, ...tree.orphanNodes],
    [tree.rootNodes, tree.orphanNodes]
  )
  const employeeNamesById = useMemo(
    () =>
      new Map(
        employees.map((employee) => [employee.employeeId, employee.name])
      ),
    [employees]
  )

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setError(null)
      setSelectedNode(null)
      setExpandedNodes(new Set())
      try {
        const [loadedRootTasks, loadedEmployees] = await Promise.all([
          apiClient.getRootTasks(projectId),
          apiClient.getEmployees(projectId).catch((err: Error) => {
            console.error("获取员工列表失败:", err)
            return []
          }),
        ])
        if (!isMounted) return

        const latest = getLatestRootTask(loadedRootTasks)
        const loadedWorkItems = latest
          ? await apiClient.getWorkItems(projectId, {
              rootTaskId: latest.rootTaskId,
            })
          : []
        if (!isMounted) return

        setRootTasks(loadedRootTasks)
        setEmployees(loadedEmployees)
        setWorkItems(loadedWorkItems)
      } catch (err) {
        console.error("获取工作项树失败:", err)
        if (isMounted) setError(err instanceof Error ? err.message : "加载失败")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [projectId])

  useEffect(() => {
    const ids = new Set<string>()
    const collectIds = (nodes: WorkItemTreeNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) ids.add(node.workItem.workItemId)
        collectIds(node.children)
      }
    }
    collectIds(allNodes)
    setExpandedNodes(ids)
    setSelectedNode(allNodes[0] ?? null)
  }, [allNodes])

  const handleToggle = useCallback((workItemId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(workItemId)) next.delete(workItemId)
      else next.add(workItemId)
      return next
    })
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <Typography variant="body2" color="text.secondary">
          加载根任务和工作项...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Typography variant="body2" color="error">
        工作项加载失败：{error}
      </Typography>
    )
  }

  if (!latestRootTask) {
    return (
      <Typography variant="body2" color="text.secondary">
        暂无根任务。
      </Typography>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {latestRootTask.summary || latestRootTask.rootTaskId}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          latest rootTaskId: {latestRootTask.rootTaskId} · createdAt:{" "}
          {latestRootTask.createdAt} · createdBy: {latestRootTask.createdBy}
        </Typography>
      </Box>
      {workItems.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          最新根任务暂无工作项。
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
            },
            gap: 2,
          }}
        >
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              overflow: "auto",
              maxHeight: 480,
              backgroundColor: "background.paper",
            }}
          >
            {tree.rootNodes.map((node) => (
              <WorkItemNode
                key={node.workItem.workItemId}
                node={node}
                level={0}
                selectedWorkItemId={selectedNode?.workItem.workItemId ?? null}
                expandedNodes={expandedNodes}
                employeeNamesById={employeeNamesById}
                onSelect={setSelectedNode}
                onToggle={handleToggle}
              />
            ))}
            {tree.orphanNodes.length > 0 && (
              <>
                <Box sx={{ px: 1.5, py: 1, backgroundColor: "warning.light" }}>
                  <Typography variant="caption" fontWeight={600}>
                    父项缺失的工作项
                  </Typography>
                </Box>
                {tree.orphanNodes.map((node) => (
                  <WorkItemNode
                    key={node.workItem.workItemId}
                    node={node}
                    level={0}
                    selectedWorkItemId={
                      selectedNode?.workItem.workItemId ?? null
                    }
                    expandedNodes={expandedNodes}
                    employeeNamesById={employeeNamesById}
                    onSelect={setSelectedNode}
                    onToggle={handleToggle}
                  />
                ))}
              </>
            )}
          </Box>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 2,
              backgroundColor: "background.paper",
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              工作项详情
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <WorkItemDetail
              node={selectedNode}
              employeeNamesById={employeeNamesById}
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}
