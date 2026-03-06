/**
 * 工具参数描述
 *
 * 由于 OpenCode SDK 不会自动传递 Zod schema 的 .describe() 到 AI,
 * 我们需要通过 tool.definition hook 手动注入这些描述
 */

export const toolParameterDescriptions: Record<
  string,
  Record<string, string>
> = {
  send_message: {
    to: "接收者名称",
    content: "消息内容",
    reference_docs: "参考文档路径列表（可选）",
  },
  edit_tasks: {
    operations: "任务操作列表（添加、更新、删除、分解）",
  },
  create_agent: {
    task_name: "关联的任务名称",
    prompt: "给 agent 的提示词",
  },
  hire_employee: {
    name: "员工名称",
    role: "角色类型",
    initial_message: "可选：招聘成功后立即发送给新员工的第一条消息",
  },
  refresh_roles: {},
}
