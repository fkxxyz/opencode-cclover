import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import type { Task, TaskStatus } from "../../types"
import { Box } from "@mui/material"

interface TaskDAGProps {
  tasks: Task[]
  executableTasks: string[]
  onTaskClick?: (task: Task) => void
}

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  completed: "#10b981",
  in_progress: "#3b82f6",
  pending: "#6b7280",
  cancelled: "#ef4444",
}

interface Node extends d3.SimulationNodeDatum {
  id: string
  task: Task
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node
  target: string | Node
}

export function TaskDAG({ tasks, executableTasks, onTaskClick }: TaskDAGProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // 监听容器尺寸变化
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // 渲染力导向图
  useEffect(() => {
    if (!svgRef.current || tasks.length === 0) return

    const { width, height } = dimensions

    // 清空之前的内容
    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)

    // 创建主容器组
    const g = svg.append("g")

    // 创建缩放行为
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    // 准备节点数据
    const nodes: Node[] = tasks.map((task) => ({
      id: task.name,
      task,
    }))

    // 准备边数据 (依赖关系: dependency -> task)
    const links: Link[] = []
    tasks.forEach((task) => {
      task.dependencies.forEach((dep) => {
        links.push({
          source: dep,
          target: task.name,
        })
      })
    })

    // 创建力导向模拟
    const simulation = d3
      .forceSimulation<Node>(nodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance(150)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50))

    // 创建箭头标记
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8")

    // 绘制连接线
    const link = g
      .selectAll(".link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)")

    // 创建节点组
    const node = g
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on("drag", (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    // 绘制节点圆圈
    node
      .append("circle")
      .attr("r", 20)
      .attr("fill", (d) => TASK_STATUS_COLORS[d.task.status])
      .attr("stroke", (d) =>
        executableTasks.includes(d.id) ? "#fbbf24" : "#fff"
      )
      .attr("stroke-width", (d) => (executableTasks.includes(d.id) ? 4 : 2))

    // 添加节点文本
    node
      .append("text")
      .attr("dy", 35)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#1e293b")
      .text((d) => d.task.name)

    // 创建 Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "task-dag-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(0, 0, 0, 0.8)")
      .style("color", "#fff")
      .style("padding", "8px 12px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("max-width", "300px")

    // 添加交互事件
    node
      .on("click", (event, d) => {
        event.stopPropagation()
        if (onTaskClick) {
          onTaskClick(d.task)
        }
      })
      .on("mouseover", (_event, d) => {
        tooltip
          .style("visibility", "visible")
          .html(
            `<div><strong>${d.task.name}</strong></div>` +
              `<div>状态: ${d.task.status}</div>` +
              `<div>描述: ${d.task.description}</div>` +
              (executableTasks.includes(d.id)
                ? `<div style="color: #fbbf24;">✓ 可执行</div>`
                : "")
          )
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", `${event.pageY - 10}px`)
          .style("left", `${event.pageX + 10}px`)
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden")
      })

    // 更新位置
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as Node).x!)
        .attr("y1", (d) => (d.source as Node).y!)
        .attr("x2", (d) => (d.target as Node).x!)
        .attr("y2", (d) => (d.target as Node).y!)

      node.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })

    // 清理函数
    return () => {
      simulation.stop()
      tooltip.remove()
    }
  }, [tasks, executableTasks, onTaskClick, dimensions])

  return (
    <Box ref={containerRef} sx={{ width: "100%", height: "100%" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
    </Box>
  )
}
