import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MemoryManager, Memory, Task } from "../../src/core/MemoryManager"
import { generateMermaid } from "../../src/utils/MermaidGenerator"
import * as fs from "fs/promises"
import * as path from "path"

const TEST_WORKSPACE = "/tmp/cclover-test-workspace"

describe("MemoryManager", () => {
  let manager: MemoryManager

  beforeEach(async () => {
    // 清理测试工作空间
    try {
      await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    } catch (error) {
      // 忽略错误
    }

    manager = new MemoryManager(TEST_WORKSPACE)
  })

  afterEach(async () => {
    // 清理测试工作空间
    try {
      await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    } catch (error) {
      // 忽略错误
    }
  })

  describe("read/write", () => {
    test("should return empty memory for non-existent employee", async () => {
      const memory = await manager.read("emp_alice")

      expect(memory).toEqual({
        knowledge: [],
        tasks: [],
        args: {},
        roleData: {},
      })
    })

    test("should write and read memory", async () => {
      const memory: Memory = {
        knowledge: ["I am good at math"],
        tasks: [],
        args: { foo: "bar" },
      }

      await manager.write("emp_alice", memory)
      const readMemory = await manager.read("emp_alice")

      // args 应该被写入
      expect(readMemory.knowledge).toEqual(["I am good at math"])
      expect(readMemory.args).toEqual({ foo: "bar" })
    })

    test("should create directory if not exists", async () => {
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {},
      }

      await manager.write("bob", memory)

      const memoryPath = path.join(
        TEST_WORKSPACE,
        "employees",
        "bob",
        "memory.yaml"
      )
      const exists = await fs
        .access(memoryPath)
        .then(() => true)
        .catch(() => false)

      expect(exists).toBe(true)
    })
  })

  describe("task management", () => {
    test("should add task", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      })

      const memory = await manager.read("emp_alice")
      expect(memory.tasks).toHaveLength(1)
      expect(memory.tasks[0].name).toBe("task1")
      expect(memory.tasks[0].created).toBeDefined()
    })

    test("should throw error when adding duplicate task", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      })

      await expect(
        manager.addTask("emp_alice", {
          name: "task1",
          status: "pending",
          description: "Duplicate task",
          dependencies: [],
        })
      ).rejects.toThrow('Task "task1" already exists')
    })

    test("should update task", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      })

      await manager.updateTask("emp_alice", "task1", {
        status: "in_progress",
      })

      const task = await manager.getTask("emp_alice", "task1")
      expect(task?.status).toBe("in_progress")
    })

    test("should add completed timestamp when status changes to completed", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      })

      await manager.updateTask("emp_alice", "task1", {
        status: "completed",
        result: "Done",
      })

      const task = await manager.getTask("emp_alice", "task1")
      expect(task?.status).toBe("completed")
      expect(task?.result).toBe("Done")
      expect(task?.completed).toBeDefined()
    })

    test("should throw error when updating non-existent task", async () => {
      await expect(
        manager.updateTask("emp_alice", "nonexistent", { status: "completed" })
      ).rejects.toThrow('Task "nonexistent" not found')
    })

    test("should delete task", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      })

      await manager.deleteTask("emp_alice", "task1")

      const memory = await manager.read("emp_alice")
      expect(memory.tasks).toHaveLength(0)
    })

    test("should throw error when deleting non-existent task", async () => {
      await expect(
        manager.deleteTask("emp_alice", "nonexistent")
      ).rejects.toThrow('Task "nonexistent" not found')
    })

    test("should get task", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      })

      const task = await manager.getTask("emp_alice", "task1")
      expect(task).not.toBeNull()
      expect(task?.name).toBe("task1")
    })

    test("should return null for non-existent task", async () => {
      const task = await manager.getTask("emp_alice", "nonexistent")
      expect(task).toBeNull()
    })
  })

  describe("getExecutableTasks", () => {
    test("should return pending tasks with no dependencies", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: [],
      })

      const executable = await manager.getExecutableTasks("emp_alice")
      expect(executable).toHaveLength(2)
    })

    test("should not return tasks with unmet dependencies", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      })

      const executable = await manager.getExecutableTasks("emp_alice")
      expect(executable).toHaveLength(1)
      expect(executable[0].name).toBe("task1")
    })

    test("should return tasks when dependencies are completed", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "completed",
        description: "Task 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      })

      const executable = await manager.getExecutableTasks("emp_alice")
      expect(executable).toHaveLength(1)
      expect(executable[0].name).toBe("task2")
    })

    test("should not return in_progress or completed tasks", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "in_progress",
        description: "Task 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "completed",
        description: "Task 2",
        dependencies: [],
      })

      const executable = await manager.getExecutableTasks("emp_alice")
      expect(executable).toHaveLength(0)
    })

    test("should return tasks when dependencies are cancelled", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "cancelled",
        description: "Task 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      })

      const executable = await manager.getExecutableTasks("emp_alice")
      expect(executable).toHaveLength(1)
      expect(executable[0].name).toBe("task2")
    })
  })

  describe("generateMermaid", () => {
    test("should generate empty graph for no tasks", async () => {
      const memory = await manager.read("emp_alice")
      const mermaid = generateMermaid(memory.tasks)
      expect(mermaid).toContain("graph TD")
      expect(mermaid).toContain("Empty[无任务]")
    })

    test("should generate nodes for tasks", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "completed",
        description: "Task 2",
        dependencies: [],
      })

      const memory = await manager.read("emp_alice")
      const mermaid = generateMermaid(memory.tasks)
      expect(mermaid).toContain("graph TD")
      expect(mermaid).toContain("pending: task1")
      expect(mermaid).toContain("completed: task2")
    })

    test("should generate edges for dependencies", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "completed",
        description: "Task 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      })

      const memory = await manager.read("emp_alice")
      const mermaid = generateMermaid(memory.tasks)
      expect(mermaid).toContain("task1 --> task2")
    })
  })

  describe("summarize", () => {
    test("should update knowledge and args, preserve tasks", async () => {
      // 添加初始记忆
      await manager.write("emp_alice", {
        knowledge: ["old knowledge"],
        tasks: [
          {
            name: "task1",
            status: "completed",
            description: "Task 1",
            dependencies: [],
            created: new Date().toISOString(),
          },
        ],
        args: { old: "value" },
      })

      // 总结
      await manager.summarize("emp_alice", {
        knowledge: ["new knowledge"],
        args: { new: "value" },
      })

      const memory = await manager.read("emp_alice")
      expect(memory.knowledge).toEqual(["new knowledge"])
      expect(memory.args).toEqual({ new: "value" })
      expect(memory.tasks).toHaveLength(1) // tasks 保持不变
    })

    test("should preserve roleData when summarizing", async () => {
      // 添加初始记忆（包含 roleData）
      await manager.write("emp_alice", {
        knowledge: ["old knowledge"],
        tasks: [],
        args: { old: "value" },
        roleData: { ownedUnits: ["unit1", "unit2"] },
      })

      // 总结
      await manager.summarize("emp_alice", {
        knowledge: ["new knowledge"],
        args: { new: "value" },
      })

      const memory = await manager.read("emp_alice")
      expect(memory.knowledge).toEqual(["new knowledge"])
      expect(memory.args).toEqual({ new: "value" })
      expect(memory.roleData).toEqual({ ownedUnits: ["unit1", "unit2"] }) // roleData 保持不变
    })
  })

  describe("roleData", () => {
    test("should read roleData from memory.yaml", async () => {
      await manager.write("emp_alice", {
        knowledge: [],
        tasks: [],
        args: {},
        roleData: { ownedUnits: ["unit1"], delegatedBy: "boss" },
      })

      const memory = await manager.read("emp_alice")
      expect(memory.roleData).toEqual({
        ownedUnits: ["unit1"],
        delegatedBy: "boss",
      })
    })

    test("should return empty object for missing roleData", async () => {
      await manager.write("emp_alice", {
        knowledge: [],
        tasks: [],
        args: {},
      })

      const memory = await manager.read("emp_alice")
      expect(memory.roleData).toEqual({})
    })

    test("should update roleData with updateRoleData", async () => {
      await manager.write("emp_alice", {
        knowledge: [],
        tasks: [],
        args: {},
        roleData: { ownedUnits: ["unit1"] },
      })

      await manager.updateRoleData("emp_alice", {
        ownedUnits: ["unit1", "unit2"],
        delegatedBy: "boss",
      })

      const memory = await manager.read("emp_alice")
      expect(memory.roleData).toEqual({
        ownedUnits: ["unit1", "unit2"],
        delegatedBy: "boss",
      })
    })

    test("should get roleData with getRoleData", async () => {
      await manager.write("emp_alice", {
        knowledge: [],
        tasks: [],
        args: {},
        roleData: { ownedUnits: ["unit1"] },
      })

      const roleData = await manager.getRoleData("emp_alice")
      expect(roleData).toEqual({ ownedUnits: ["unit1"] })
    })

    test("should return empty object when roleData is missing", async () => {
      await manager.write("emp_alice", {
        knowledge: [],
        tasks: [],
        args: {},
      })

      const roleData = await manager.getRoleData("emp_alice")
      expect(roleData).toEqual({})
    })
  })

  describe("detectCycle", () => {
    test("should return false for no cycle", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      })

      const hasCycle = await manager.detectCycle("emp_alice")
      expect(hasCycle).toBe(false)
    })

    test("should return true for direct cycle", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: ["task2"],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      })

      const hasCycle = await manager.detectCycle("emp_alice")
      expect(hasCycle).toBe(true)
    })

    test("should return true for indirect cycle", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: ["task2"],
      })

      await manager.addTask("emp_alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task3"],
      })

      await manager.addTask("emp_alice", {
        name: "task3",
        status: "pending",
        description: "Task 3",
        dependencies: ["task1"],
      })

      const hasCycle = await manager.detectCycle("emp_alice")
      expect(hasCycle).toBe(true)
    })
  })

  describe("deleteTaskWithCleanup", () => {
    test("should delete task with no dependents", async () => {
      await manager.addTask("emp_alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      })

      const result = await manager.deleteTaskWithCleanup("emp_alice", "task1")

      expect(result.affectedTasks).toEqual([])
      const memory = await manager.read("emp_alice")
      expect(memory.tasks).toHaveLength(0)
    })

    test("should delete task and clean dependencies", async () => {
      await manager.addTask("emp_alice", {
        name: "taskA",
        status: "pending",
        description: "Task A",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "taskB",
        status: "pending",
        description: "Task B",
        dependencies: ["taskA"],
      })

      await manager.addTask("emp_alice", {
        name: "taskC",
        status: "pending",
        description: "Task C",
        dependencies: ["taskA"],
      })

      const result = await manager.deleteTaskWithCleanup("emp_alice", "taskA")

      expect(result.affectedTasks).toEqual(["taskB", "taskC"])
      const memory = await manager.read("emp_alice")
      expect(memory.tasks).toHaveLength(2)

      const taskB = memory.tasks.find((t) => t.name === "taskB")
      const taskC = memory.tasks.find((t) => t.name === "taskC")

      expect(taskB?.dependencies).toEqual([])
      expect(taskC?.dependencies).toEqual([])
    })

    test("should throw error when deleting non-existent task", async () => {
      await expect(
        manager.deleteTaskWithCleanup("emp_alice", "nonexistent")
      ).rejects.toThrow('Task "nonexistent" not found')
    })

    test("should handle multiple dependents correctly", async () => {
      await manager.addTask("emp_alice", {
        name: "base",
        status: "pending",
        description: "Base task",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "dep1",
        status: "pending",
        description: "Dependent 1",
        dependencies: ["base"],
      })

      await manager.addTask("emp_alice", {
        name: "dep2",
        status: "pending",
        description: "Dependent 2",
        dependencies: ["base", "dep1"],
      })

      const result = await manager.deleteTaskWithCleanup("emp_alice", "base")

      expect(result.affectedTasks).toContain("dep1")
      expect(result.affectedTasks).toContain("dep2")

      const memory = await manager.read("emp_alice")
      const dep2 = memory.tasks.find((t) => t.name === "dep2")
      expect(dep2?.dependencies).toEqual(["dep1"])
    })
  })

  describe("decomposeTask", () => {
    test("should decompose task with no original dependencies", async () => {
      await manager.addTask("emp_alice", {
        name: "parent",
        status: "in_progress",
        description: "Parent task",
        dependencies: [],
      })

      await manager.decomposeTask("emp_alice", "parent", [
        { name: "sub1", description: "Subtask 1" },
        { name: "sub2", description: "Subtask 2" },
      ])

      const memory = await manager.read("emp_alice")
      expect(memory.tasks).toHaveLength(3)

      const parent = memory.tasks.find((t) => t.name === "parent")
      const sub1 = memory.tasks.find((t) => t.name === "sub1")
      const sub2 = memory.tasks.find((t) => t.name === "sub2")

      expect(parent?.status).toBe("pending")
      expect(parent?.dependencies).toEqual(["sub1", "sub2"])
      expect(parent?.completed).toBeUndefined()

      expect(sub1?.status).toBe("pending")
      expect(sub1?.dependencies).toEqual([])

      expect(sub2?.status).toBe("pending")
      expect(sub2?.dependencies).toEqual([])
    })

    test("should decompose task with original dependencies", async () => {
      await manager.addTask("emp_alice", {
        name: "dep1",
        status: "completed",
        description: "Dependency 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "dep2",
        status: "completed",
        description: "Dependency 2",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "parent",
        status: "in_progress",
        description: "Parent task",
        dependencies: ["dep1", "dep2"],
      })

      await manager.decomposeTask("emp_alice", "parent", [
        { name: "sub1", description: "Subtask 1" },
        { name: "sub2", description: "Subtask 2" },
      ])

      const memory = await manager.read("emp_alice")
      const sub1 = memory.tasks.find((t) => t.name === "sub1")
      const sub2 = memory.tasks.find((t) => t.name === "sub2")

      expect(sub1?.dependencies).toEqual(["dep1", "dep2"])
      expect(sub2?.dependencies).toEqual(["dep1", "dep2"])
    })

    test("should handle subtask additional dependencies", async () => {
      await manager.addTask("emp_alice", {
        name: "dep1",
        status: "completed",
        description: "Dependency 1",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "parent",
        status: "pending",
        description: "Parent task",
        dependencies: ["dep1"],
      })

      await manager.decomposeTask("emp_alice", "parent", [
        { name: "sub1", description: "Subtask 1" },
        { name: "sub2", description: "Subtask 2", dependencies: ["sub1"] },
      ])

      const memory = await manager.read("emp_alice")
      const sub1 = memory.tasks.find((t) => t.name === "sub1")
      const sub2 = memory.tasks.find((t) => t.name === "sub2")

      expect(sub1?.dependencies).toEqual(["dep1"])
      expect(sub2?.dependencies).toEqual(["dep1", "sub1"])
    })

    test("should throw error when decomposing non-existent task", async () => {
      await expect(
        manager.decomposeTask("emp_alice", "nonexistent", [
          { name: "sub1", description: "Subtask 1" },
        ])
      ).rejects.toThrow('Task "nonexistent" not found')
    })

    test("should throw error when subtask name already exists", async () => {
      await manager.addTask("emp_alice", {
        name: "parent",
        status: "pending",
        description: "Parent task",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "existing",
        status: "pending",
        description: "Existing task",
        dependencies: [],
      })

      await expect(
        manager.decomposeTask("emp_alice", "parent", [
          { name: "existing", description: "Subtask 1" },
        ])
      ).rejects.toThrow('Subtask name "existing" already exists')
    })

    test("should preserve other tasks dependencies on parent", async () => {
      await manager.addTask("emp_alice", {
        name: "parent",
        status: "pending",
        description: "Parent task",
        dependencies: [],
      })

      await manager.addTask("emp_alice", {
        name: "dependent",
        status: "pending",
        description: "Dependent task",
        dependencies: ["parent"],
      })

      await manager.decomposeTask("emp_alice", "parent", [
        { name: "sub1", description: "Subtask 1" },
      ])

      const memory = await manager.read("emp_alice")
      const dependent = memory.tasks.find((t) => t.name === "dependent")

      expect(dependent?.dependencies).toEqual(["parent"])
    })
  })

  describe("updateArgs", () => {
    test("should update args field", async () => {
      // 初始化记忆
      await manager.write("emp_alice", {
        knowledge: [],
        tasks: [],
        args: { old: "value" },
      })

      // 更新 args
      await manager.updateArgs("emp_alice", { new: "value", count: 123 })

      // 验证更新
      const memory = await manager.read("emp_alice")
      expect(memory.args).toEqual({ new: "value", count: 123 })
    })

    test("should write args correctly", async () => {
      await manager.write("emp_alice", {
        knowledge: [],
        tasks: [],
        args: {},
      })

      await manager.updateArgs("emp_alice", { foo: "bar" })

      // 直接读取文件验证 args 被更新
      const memoryPath = path.join(
        TEST_WORKSPACE,
        "employees",
        "emp_alice",
        "memory.yaml"
      )
      const content = await fs.readFile(memoryPath, "utf-8")
      const data = require("yaml").parse(content)

      expect(data.args).toEqual({ foo: "bar" })
    })

    test("should preserve knowledge and tasks when updating args", async () => {
      await manager.write("emp_alice", {
        knowledge: ["important knowledge"],
        tasks: [
          {
            name: "task1",
            status: "pending",
            description: "Test task",
            dependencies: [],
            created: new Date().toISOString(),
          },
        ],
        args: {},
      })

      await manager.updateArgs("emp_alice", { foo: "bar" })

      const memory = await manager.read("emp_alice")
      expect(memory.knowledge).toEqual(["important knowledge"])
      expect(memory.tasks).toHaveLength(1)
      expect(memory.args).toEqual({ foo: "bar" })
    })
  })
})
