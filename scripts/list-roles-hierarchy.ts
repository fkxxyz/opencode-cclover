#!/usr/bin/env bun

/**
 * List all preset roles in hierarchical structure
 * Sorted by hiring relationships, management roles first, independent tool roles last
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"

interface RoleMetadata {
  name: string
  description?: string
  soul?: boolean
  responsibilities?: string[]
  boundaries?: string[]
  requiredArgs?: Record<string, { type: string; description: string }>
  canHire?: string[]
  groups?: string[]
}

interface RoleInfo {
  filename: string
  metadata: RoleMetadata
  canHireResolved: string[] // Resolved actual role names list
}

/**
 * Read role file and parse YAML frontmatter
 */
async function readRoleFile(filePath: string): Promise<RoleInfo | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    const lines = content.split("\n")

    // Find YAML frontmatter
    if (lines[0] !== "---") {
      console.error(`Warning: ${filePath} does not have YAML frontmatter`)
      return null
    }

    let endIndex = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        endIndex = i
        break
      }
    }

    if (endIndex === -1) {
      console.error(`Warning: ${filePath} has incomplete YAML frontmatter`)
      return null
    }

    const yamlContent = lines.slice(1, endIndex).join("\n")
    const metadata = yaml.parse(yamlContent) as RoleMetadata

    return {
      filename: path.basename(filePath, ".md"),
      metadata,
      canHireResolved: [],
    }
  } catch (error: any) {
    console.error(`Error reading ${filePath}:`, error.message)
    return null
  }
}

/**
 * Check if role name matches glob pattern
 */
function matchGlob(roleName: string, pattern: string): boolean {
  // Simple glob matching implementation
  const regexPattern = pattern
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")

  const regex = new RegExp(`^${regexPattern}$`, "i")
  return regex.test(roleName)
}

/**
 * Parse canHire field, convert glob and group references to actual role names
 */
function resolveCanHire(
  roles: Map<string, RoleInfo>,
  roleInfo: RoleInfo
): string[] {
  const canHire = roleInfo.metadata.canHire || []
  const resolved = new Set<string>()

  for (const pattern of canHire) {
    if (pattern.startsWith("group:")) {
      // Handle group references
      const groupName = pattern.slice(6)
      for (const [roleName, info] of roles.entries()) {
        if (info.metadata.groups?.includes(groupName)) {
          resolved.add(roleName)
        }
      }
    } else if (pattern.includes("*")) {
      // Handle glob patterns
      for (const roleName of roles.keys()) {
        if (matchGlob(roleName, pattern)) {
          resolved.add(roleName)
        }
      }
    } else {
      // Exact match
      if (roles.has(pattern)) {
        resolved.add(pattern)
      }
    }
  }

  return Array.from(resolved)
}

/**
 * Sort by hierarchical depth and influence
 * 1. Start BFS from "root nodes" (in-degree=0 and out-degree>0)
 * 2. Output by level, within same level sort by out-degree descending
 * 3. Independent nodes (in-degree=0 and out-degree=0) at the end
 */
function hierarchicalSort(roles: Map<string, RoleInfo>): string[] {
  // Build in-degree table and adjacency list
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  // Initialize
  for (const roleName of roles.keys()) {
    inDegree.set(roleName, 0)
    outDegree.set(roleName, 0)
    adjList.set(roleName, [])
  }

  // Build graph
  for (const [roleName, roleInfo] of roles.entries()) {
    const hiredRoles = roleInfo.canHireResolved
    outDegree.set(roleName, hiredRoles.length)

    for (const hiredRole of hiredRoles) {
      adjList.get(roleName)!.push(hiredRole)
      inDegree.set(hiredRole, inDegree.get(hiredRole)! + 1)
    }
  }

  // Find root nodes (in-degree=0 and out-degree>0) and independent nodes (in-degree=0 and out-degree=0)
  const rootNodes: string[] = []
  const independentNodes: string[] = []

  for (const roleName of roles.keys()) {
    const inDeg = inDegree.get(roleName)!
    const outDeg = outDegree.get(roleName)!

    if (inDeg === 0) {
      if (outDeg > 0) {
        rootNodes.push(roleName)
      } else {
        independentNodes.push(roleName)
      }
    }
  }

  // Sort root nodes by out-degree descending
  rootNodes.sort((a, b) => {
    const outA = outDegree.get(a)!
    const outB = outDegree.get(b)!
    if (outA !== outB) return outB - outA
    return a.localeCompare(b)
  })

  // Sort independent nodes alphabetically
  independentNodes.sort()

  // BFS traversal, output by level
  const result: string[] = []
  const visited = new Set<string>()
  const queue: Array<{ name: string; level: number }> = []

  // Add root nodes to queue
  for (const root of rootNodes) {
    queue.push({ name: root, level: 0 })
    visited.add(root)
  }

  // Group by level
  const levelGroups = new Map<number, string[]>()

  while (queue.length > 0) {
    const { name, level } = queue.shift()!

    if (!levelGroups.has(level)) {
      levelGroups.set(level, [])
    }
    levelGroups.get(level)!.push(name)

    // Add child nodes to queue
    const children = adjList.get(name)!
    for (const child of children) {
      if (!visited.has(child)) {
        visited.add(child)
        queue.push({ name: child, level: level + 1 })
      }
    }
  }

  // Output by level, within same level sort by out-degree descending
  const levels = Array.from(levelGroups.keys()).sort((a, b) => a - b)
  for (const level of levels) {
    const nodesInLevel = levelGroups.get(level)!
    nodesInLevel.sort((a, b) => {
      const outA = outDegree.get(a)!
      const outB = outDegree.get(b)!
      if (outA !== outB) return outB - outA
      return a.localeCompare(b)
    })
    result.push(...nodesInLevel)
  }

  // Add independent nodes
  result.push(...independentNodes)

  // Check if all nodes are visited
  if (result.length !== roles.size) {
    console.error("Warning: Some roles are not reachable from root nodes")
    // Add unvisited nodes
    for (const roleName of roles.keys()) {
      if (!result.includes(roleName)) {
        result.push(roleName)
      }
    }
  }

  return result
}

/**
 * Generate hierarchy info (for mermaid diagram generation)
 */
interface HierarchyInfo {
  levelGroups: Map<number, string[]>
  independentNodes: string[]
  adjList: Map<string, string[]>
  outDegree: Map<string, number>
}

function getHierarchyInfo(roles: Map<string, RoleInfo>): HierarchyInfo {
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  // Initialize
  for (const roleName of roles.keys()) {
    inDegree.set(roleName, 0)
    outDegree.set(roleName, 0)
    adjList.set(roleName, [])
  }

  // Build graph
  for (const [roleName, roleInfo] of roles.entries()) {
    const hiredRoles = roleInfo.canHireResolved
    outDegree.set(roleName, hiredRoles.length)

    for (const hiredRole of hiredRoles) {
      adjList.get(roleName)!.push(hiredRole)
      inDegree.set(hiredRole, inDegree.get(hiredRole)! + 1)
    }
  }

  // Find root nodes and independent nodes
  const rootNodes: string[] = []
  const independentNodes: string[] = []

  for (const roleName of roles.keys()) {
    const inDeg = inDegree.get(roleName)!
    const outDeg = outDegree.get(roleName)!

    if (inDeg === 0) {
      if (outDeg > 0) {
        rootNodes.push(roleName)
      } else {
        independentNodes.push(roleName)
      }
    }
  }

  rootNodes.sort((a, b) => {
    const outA = outDegree.get(a)!
    const outB = outDegree.get(b)!
    if (outA !== outB) return outB - outA
    return a.localeCompare(b)
  })

  independentNodes.sort()

  // BFS traversal
  const visited = new Set<string>()
  const queue: Array<{ name: string; level: number }> = []

  for (const root of rootNodes) {
    queue.push({ name: root, level: 0 })
    visited.add(root)
  }

  const levelGroups = new Map<number, string[]>()

  while (queue.length > 0) {
    const { name, level } = queue.shift()!

    if (!levelGroups.has(level)) {
      levelGroups.set(level, [])
    }
    levelGroups.get(level)!.push(name)

    const children = adjList.get(name)!
    for (const child of children) {
      if (!visited.has(child)) {
        visited.add(child)
        queue.push({ name: child, level: level + 1 })
      }
    }
  }

  return { levelGroups, independentNodes, adjList, outDegree }
}

/**
 * Generate Mermaid diagram
 */
function generateMermaidDiagram(
  roles: Map<string, RoleInfo>,
  hierarchyInfo: HierarchyInfo
): string {
  const lines: string[] = []
  lines.push("```mermaid")
  lines.push("graph TD")
  lines.push("")

  // Add Boss node
  lines.push("    Boss[Boss]")
  lines.push("")

  // Generate node ID mapping (avoid special characters)
  const nodeIdMap = new Map<string, string>()
  let nodeCounter = 0
  for (const roleName of roles.keys()) {
    nodeIdMap.set(roleName, `N${nodeCounter++}`)
  }

  // Define nodes by level
  const { levelGroups, independentNodes, adjList } = hierarchyInfo

  const levels = Array.from(levelGroups.keys()).sort((a, b) => a - b)

  for (const level of levels) {
    lines.push(`    %% Level ${level}`)
    const nodesInLevel = levelGroups.get(level)!

    for (const roleName of nodesInLevel) {
      const nodeId = nodeIdMap.get(roleName)!
      const roleInfo = roles.get(roleName)!
      const groups = roleInfo.metadata.groups || []
      const groupText = groups.length > 0 ? `<br/>[${groups.join(", ")}]` : ""
      lines.push(`    ${nodeId}["${roleName}${groupText}"]`)
    }
    lines.push("")
  }

  // Independent nodes
  if (independentNodes.length > 0) {
    lines.push("    %% Independent tool roles")
    for (const roleName of independentNodes) {
      const nodeId = nodeIdMap.get(roleName)!
      lines.push(`    ${nodeId}["${roleName}"]`)
    }
    lines.push("")
  }

  // Boss to level 0 connections
  lines.push("    %% Boss hiring relationships")
  if (levelGroups.has(0)) {
    for (const roleName of levelGroups.get(0)!) {
      const nodeId = nodeIdMap.get(roleName)!
      lines.push(`    Boss -.->|can hire| ${nodeId}`)
    }
  }
  lines.push("")

  // Hiring relationships between levels
  lines.push("    %% Inter-role hiring relationships")
  for (const [roleName, children] of adjList.entries()) {
    if (children.length > 0) {
      const fromId = nodeIdMap.get(roleName)!
      for (const child of children) {
        const toId = nodeIdMap.get(child)!
        lines.push(`    ${fromId} -->|hires| ${toId}`)
      }
    }
  }
  lines.push("")

  // Style definitions - dynamically generate for unlimited levels
  lines.push("    %% Style definitions")
  lines.push(
    "    classDef bossStyle fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px,color:#fff"
  )

  // Predefined color scheme (supports unlimited levels, cycles through)
  const layerColors = [
    { fill: "#4dabf7", stroke: "#1971c2", color: "#fff" }, // Blue
    { fill: "#51cf66", stroke: "#2f9e44", color: "#fff" }, // Green
    { fill: "#ffd43b", stroke: "#f59f00", color: "#000" }, // Yellow
    { fill: "#ff8787", stroke: "#fa5252", color: "#fff" }, // Orange-red
    { fill: "#a78bfa", stroke: "#7c3aed", color: "#fff" }, // Purple
    { fill: "#fb923c", stroke: "#ea580c", color: "#fff" }, // Orange
    { fill: "#38bdf8", stroke: "#0284c7", color: "#fff" }, // Sky blue
    { fill: "#4ade80", stroke: "#16a34a", color: "#fff" }, // Bright green
    { fill: "#f472b6", stroke: "#db2777", color: "#fff" }, // Pink
    { fill: "#facc15", stroke: "#ca8a04", color: "#000" }, // Gold
  ]

  // Dynamically generate styles for each level
  for (const level of levels) {
    const colorIndex = level % layerColors.length
    const color = layerColors[colorIndex]
    const styleClass = `layer${level}Style`
    lines.push(
      `    classDef ${styleClass} fill:${color.fill},stroke:${color.stroke},stroke-width:2px,color:${color.color}`
    )
  }

  lines.push(
    "    classDef independentStyle fill:#e0e0e0,stroke:#999,stroke-width:1px,color:#000"
  )
  lines.push("")

  // Apply styles
  lines.push("    class Boss bossStyle")

  for (const level of levels) {
    const styleClass = `layer${level}Style`
    const nodesInLevel = levelGroups.get(level)!
    const nodeIds = nodesInLevel.map((name) => nodeIdMap.get(name)!).join(",")
    lines.push(`    class ${nodeIds} ${styleClass}`)
  }

  if (independentNodes.length > 0) {
    const nodeIds = independentNodes
      .map((name) => nodeIdMap.get(name)!)
      .join(",")
    lines.push(`    class ${nodeIds} independentStyle`)
  }

  lines.push("```")
  return lines.join("\n")
}

/**
 * Format role information output
 */
function formatRoleInfo(roleInfo: RoleInfo): string {
  const { metadata, canHireResolved } = roleInfo
  const lines: string[] = []

  lines.push(`\n${"=".repeat(80)}`)
  lines.push(`Role Name: ${metadata.name}`)
  lines.push(`File Name: ${roleInfo.filename}.md`)

  if (metadata.description) {
    lines.push(`Description: ${metadata.description}`)
  }

  if (metadata.responsibilities && metadata.responsibilities.length > 0) {
    lines.push(`Responsibilities:`)
    for (const responsibility of metadata.responsibilities) {
      lines.push(`  - ${responsibility}`)
    }
  }

  if (metadata.boundaries && metadata.boundaries.length > 0) {
    lines.push(`Boundaries:`)
    for (const boundary of metadata.boundaries) {
      lines.push(`  - ${boundary}`)
    }
  }

  if (metadata.groups && metadata.groups.length > 0) {
    lines.push(`Groups: ${metadata.groups.join(", ")}`)
  }

  if (canHireResolved.length > 0) {
    lines.push(`Can Hire (${canHireResolved.length}):`)
    for (const hired of canHireResolved.sort()) {
      lines.push(`  - ${hired}`)
    }
  } else {
    lines.push(`Can Hire: (none)`)
  }

  return lines.join("\n")
}

/**
 * Main function
 */
async function main() {
  const rolesDir = path.join(import.meta.dir, "../src/roles")

  // Read all role files
  const files = await fs.readdir(rolesDir)
  const roleFiles = files.filter((f) => f.endsWith(".md"))

  console.log(`Found ${roleFiles.length} role files\n`)

  // Parse all roles
  const roles = new Map<string, RoleInfo>()
  for (const file of roleFiles) {
    const filePath = path.join(rolesDir, file)
    const roleInfo = await readRoleFile(filePath)
    if (roleInfo) {
      roles.set(roleInfo.metadata.name, roleInfo)
    }
  }

  console.log(`Successfully parsed ${roles.size} roles\n`)

  // Parse canHire field
  for (const roleInfo of roles.values()) {
    roleInfo.canHireResolved = resolveCanHire(roles, roleInfo)
  }

  // Get hierarchy info
  const hierarchyInfo = getHierarchyInfo(roles)

  // Generate sorted list
  const sortedRoleNames: string[] = []
  const levels = Array.from(hierarchyInfo.levelGroups.keys()).sort(
    (a, b) => a - b
  )
  for (const level of levels) {
    const nodesInLevel = hierarchyInfo.levelGroups.get(level)!
    nodesInLevel.sort((a, b) => {
      const outA = hierarchyInfo.outDegree.get(a)!
      const outB = hierarchyInfo.outDegree.get(b)!
      if (outA !== outB) return outB - outA
      return a.localeCompare(b)
    })
    sortedRoleNames.push(...nodesInLevel)
  }
  sortedRoleNames.push(...hierarchyInfo.independentNodes)

  // Generate Mermaid diagram
  const mermaidDiagram = generateMermaidDiagram(roles, hierarchyInfo)

  // Output Mermaid diagram
  console.log("=".repeat(80))
  console.log("Role Hiring Relationships Diagram (Mermaid)")
  console.log("=".repeat(80))
  console.log(mermaidDiagram)
  console.log("")

  // Output detailed list
  console.log("=".repeat(80))
  console.log(
    "Role Hierarchical Structure (sorted by hiring chain depth, management roles first, independent tools last)"
  )
  console.log("=".repeat(80))

  for (const roleName of sortedRoleNames) {
    const roleInfo = roles.get(roleName)!
    console.log(formatRoleInfo(roleInfo))
  }

  console.log("\n" + "=".repeat(80))
  console.log(`Total: ${sortedRoleNames.length} roles`)
  console.log("=".repeat(80))
}

main().catch(console.error)
