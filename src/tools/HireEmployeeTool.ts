/**
 * hire_employee 工具
 * 
 * 雇佣新员工
 * 
 * 注意：第一版暂不实现此功能
 */

import { tool } from "@opencode-ai/plugin"

export const hireEmployeeTool = tool({
  description: "雇佣新员工",
  args: {
    name: tool.schema.string().describe("员工名称"),
    role: tool.schema.string().describe("角色类型"),
  },
  async execute(args, context) {
    // 第一版暂不实现
    return `雇佣功能暂未实现`
  },
})
