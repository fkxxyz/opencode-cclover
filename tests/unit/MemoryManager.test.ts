import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { MemoryManager, Memory, Task } from "../../src/core/MemoryManager";
import { generateMermaid } from "../../src/utils/MermaidGenerator";
import * as fs from "fs/promises";
import * as path from "path";

const TEST_WORKSPACE = "/tmp/cclover-test-workspace";

describe("MemoryManager", () => {
  let manager: MemoryManager;

  beforeEach(async () => {
    // 清理测试工作空间
    try {
      await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
    } catch (error) {
      // 忽略错误
    }

    manager = new MemoryManager(TEST_WORKSPACE);
  });

  afterEach(async () => {
    // 清理测试工作空间
    try {
      await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
    } catch (error) {
      // 忽略错误
    }
  });

  describe("read/write", () => {
    test("should return empty memory for non-existent employee", async () => {
      const memory = await manager.read("alice");

      expect(memory).toEqual({
        knowledge: [],
        tasks: [],
        custom: {},
      });
    });

    test("should write and read memory", async () => {
      const memory: Memory = {
        knowledge: ["I am good at math"],
        tasks: [],
        custom: { foo: "bar" },
      };

      await manager.write("alice", memory);
      const readMemory = await manager.read("alice");

      expect(readMemory).toEqual(memory);
    });

    test("should create directory if not exists", async () => {
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        custom: {},
      };

      await manager.write("bob", memory);

      const memoryPath = path.join(
        TEST_WORKSPACE,
        "employees",
        "bob",
        "memory.yaml"
      );
      const exists = await fs
        .access(memoryPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });
  });

  describe("task management", () => {
    test("should add task", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      });

      const memory = await manager.read("alice");
      expect(memory.tasks).toHaveLength(1);
      expect(memory.tasks[0].name).toBe("task1");
      expect(memory.tasks[0].created).toBeDefined();
    });

    test("should throw error when adding duplicate task", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      });

      await expect(
        manager.addTask("alice", {
          name: "task1",
          status: "pending",
          description: "Duplicate task",
          dependencies: [],
        })
      ).rejects.toThrow('Task "task1" already exists');
    });

    test("should update task", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      });

      await manager.updateTask("alice", "task1", {
        status: "in_progress",
      });

      const task = await manager.getTask("alice", "task1");
      expect(task?.status).toBe("in_progress");
    });

    test("should add completed timestamp when status changes to completed", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      });

      await manager.updateTask("alice", "task1", {
        status: "completed",
        result: "Done",
      });

      const task = await manager.getTask("alice", "task1");
      expect(task?.status).toBe("completed");
      expect(task?.result).toBe("Done");
      expect(task?.completed).toBeDefined();
    });

    test("should throw error when updating non-existent task", async () => {
      await expect(
        manager.updateTask("alice", "nonexistent", { status: "completed" })
      ).rejects.toThrow('Task "nonexistent" not found');
    });

    test("should delete task", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      });

      await manager.deleteTask("alice", "task1");

      const memory = await manager.read("alice");
      expect(memory.tasks).toHaveLength(0);
    });

    test("should throw error when deleting non-existent task", async () => {
      await expect(manager.deleteTask("alice", "nonexistent")).rejects.toThrow(
        'Task "nonexistent" not found'
      );
    });

    test("should get task", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Test task",
        dependencies: [],
      });

      const task = await manager.getTask("alice", "task1");
      expect(task).not.toBeNull();
      expect(task?.name).toBe("task1");
    });

    test("should return null for non-existent task", async () => {
      const task = await manager.getTask("alice", "nonexistent");
      expect(task).toBeNull();
    });
  });

  describe("getExecutableTasks", () => {
    test("should return pending tasks with no dependencies", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: [],
      });

      const executable = await manager.getExecutableTasks("alice");
      expect(executable).toHaveLength(2);
    });

    test("should not return tasks with unmet dependencies", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      });

      const executable = await manager.getExecutableTasks("alice");
      expect(executable).toHaveLength(1);
      expect(executable[0].name).toBe("task1");
    });

    test("should return tasks when dependencies are completed", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "completed",
        description: "Task 1",
        dependencies: [],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      });

      const executable = await manager.getExecutableTasks("alice");
      expect(executable).toHaveLength(1);
      expect(executable[0].name).toBe("task2");
    });

    test("should not return in_progress or completed tasks", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "in_progress",
        description: "Task 1",
        dependencies: [],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "completed",
        description: "Task 2",
        dependencies: [],
      });

      const executable = await manager.getExecutableTasks("alice");
      expect(executable).toHaveLength(0);
    });
  });

  describe("generateMermaid", () => {
    test("should generate empty graph for no tasks", async () => {
      const memory = await manager.read("alice");
      const mermaid = generateMermaid(memory.tasks);
      expect(mermaid).toContain("graph TD");
      expect(mermaid).toContain("Empty[无任务]");
    });

    test("should generate nodes for tasks", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "completed",
        description: "Task 2",
        dependencies: [],
      });

      const memory = await manager.read("alice");
      const mermaid = generateMermaid(memory.tasks);
      expect(mermaid).toContain("graph TD");
      expect(mermaid).toContain("pending: task1");
      expect(mermaid).toContain("completed: task2");
    });

    test("should generate edges for dependencies", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "completed",
        description: "Task 1",
        dependencies: [],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      });

      const memory = await manager.read("alice");
      const mermaid = generateMermaid(memory.tasks);
      expect(mermaid).toContain("task1 --> task2");
    });
  });

  describe("summarize", () => {
    test("should update knowledge and custom, preserve tasks", async () => {
      // 添加初始记忆
      await manager.write("alice", {
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
        custom: { old: "value" },
      });

      // 总结
      await manager.summarize("alice", {
        knowledge: ["new knowledge"],
        custom: { new: "value" },
      });

      const memory = await manager.read("alice");
      expect(memory.knowledge).toEqual(["new knowledge"]);
      expect(memory.custom).toEqual({ new: "value" });
      expect(memory.tasks).toHaveLength(1); // tasks 保持不变
    });
  });

  describe("detectCycle", () => {
    test("should return false for no cycle", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: [],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      });

      const hasCycle = await manager.detectCycle("alice");
      expect(hasCycle).toBe(false);
    });

    test("should return true for direct cycle", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: ["task2"],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task1"],
      });

      const hasCycle = await manager.detectCycle("alice");
      expect(hasCycle).toBe(true);
    });

    test("should return true for indirect cycle", async () => {
      await manager.addTask("alice", {
        name: "task1",
        status: "pending",
        description: "Task 1",
        dependencies: ["task2"],
      });

      await manager.addTask("alice", {
        name: "task2",
        status: "pending",
        description: "Task 2",
        dependencies: ["task3"],
      });

      await manager.addTask("alice", {
        name: "task3",
        status: "pending",
        description: "Task 3",
        dependencies: ["task1"],
      });

      const hasCycle = await manager.detectCycle("alice");
      expect(hasCycle).toBe(true);
    });
  });
});
