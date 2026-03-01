import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import type { EmployeeHierarchy, EmployeeStatus } from "../../types"

interface HierarchyTreeProps {
  hierarchy: EmployeeHierarchy
  onNodeClick?: (employee: { name: string; role: string }) => void
}

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  active: "#10b981",
  idle: "#eab308",
  error: "#ef4444",
  inactive: "#6b7280"
}

export function HierarchyTree({ hierarchy, onNodeClick }: HierarchyTreeProps) {
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

  // 渲染树状图
  useEffect(() => {
    if (!svgRef.current || !hierarchy) return

    const { width, height } = dimensions
    const margin = { top: 40, right: 120, bottom: 40, left: 120 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // 清空之前的内容
    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)

    // 创建主容器组
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // 创建缩放行为
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    // 创建树布局
    const treeLayout = d3.tree<EmployeeHierarchy>().size([innerHeight, innerWidth])

    // 转换数据为层次结构
    const root = d3.hierarchy(hierarchy)
    const treeData = treeLayout(root)

    // 创建连接线生成器
    const linkGenerator = d3
      .linkHorizontal<d3.HierarchyPointLink<EmployeeHierarchy>, d3.HierarchyPointNode<EmployeeHierarchy>>()
      .x((d) => d.y)
      .y((d) => d.x)

    // 绘制连接线
    g.selectAll(".link")
      .data(treeData.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", linkGenerator)
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 2)

    // 创建节点组
    const nodes = g
      .selectAll(".node")
      .data(treeData.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")

    // 绘制节点圆圈
    nodes
      .append("circle")
      .attr("r", 8)
      .attr("fill", (d) => STATUS_COLORS[d.data.status])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)

    // 添加节点文本
    nodes
      .append("text")
      .attr("dy", -15)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#1e293b")
      .text((d) => d.data.name)

    nodes
      .append("text")
      .attr("dy", 25)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#64748b")
      .text((d) => d.data.role)

    // 创建 Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "hierarchy-tree-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(0, 0, 0, 0.8)")
      .style("color", "#fff")
      .style("padding", "8px 12px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000")

    // 添加交互事件
    nodes
      .on("click", (event, d) => {
        event.stopPropagation()
        if (onNodeClick) {
          onNodeClick({ name: d.data.name, role: d.data.role })
        }
      })
      .on("mouseover", (_event, d) => {
        tooltip
          .style("visibility", "visible")
          .html(
            `<div><strong>${d.data.name}</strong></div>` +
              `<div>角色: ${d.data.role}</div>` +
              `<div>状态: ${d.data.status}</div>`
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

    // 清理函数
    return () => {
      tooltip.remove()
    }
  }, [hierarchy, onNodeClick, dimensions])

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}
