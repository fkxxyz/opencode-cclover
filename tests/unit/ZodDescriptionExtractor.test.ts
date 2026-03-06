import { describe, test, expect } from "bun:test"
import {
  extractZodDescriptions,
  formatToolParameterDescriptions,
} from "../../src/utils/ZodDescriptionExtractor"

/**
 * These tests use mock data that matches what OpenCode passes to tool.definition hook
 * NOT raw Zod schemas (which have the bug where .describe() is lost)
 */

describe("ZodDescriptionExtractor", () => {
  describe("extractZodDescriptions", () => {
    test("extracts simple string parameter", () => {
      // Mock what OpenCode passes (not raw Zod schema)
      const schema = {
        def: {
          type: "string",
          description: "User name",
        },
      }

      const result = extractZodDescriptions(schema, 0)

      // String types don't have nested structure
      expect(result).toEqual([])
    })

    test("extracts nested object parameters", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "object",
          shape: {
            timeout: {
              def: {
                type: "number",
                description: "Timeout in ms",
              },
            },
            retries: {
              def: {
                type: "number",
                description: "Retry count",
              },
            },
          },
        },
      }

      const result = extractZodDescriptions(schema, 0)

      expect(result).toContain("- timeout: Timeout in ms")
      expect(result).toContain("- retries: Retry count")
    })

    test("extracts array element descriptions", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "array",
          element: {
            def: {
              type: "string",
              description: "Tag name",
            },
          },
        },
      }

      const result = extractZodDescriptions(schema, 0)

      expect(result).toContain("  [元素]: Tag name")
    })

    test("extracts enum values", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "enum",
          values: ["pending", "active", "done"],
        },
      }

      const result = extractZodDescriptions(schema, 0)

      expect(result).toContain("  可选值: pending, active, done")
    })

    test("handles optional parameters", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "optional",
          innerType: {
            def: {
              type: "string",
              description: "Optional field",
            },
          },
        },
      }

      const result = extractZodDescriptions(schema, 0)

      // Optional wraps the inner type, should extract nothing at this level
      expect(result).toEqual([])
    })

    test("handles deeply nested structures", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "object",
          shape: {
            operations: {
              def: {
                type: "array",
                element: {
                  def: {
                    type: "object",
                    shape: {
                      action: {
                        def: {
                          type: "enum",
                          values: ["add", "update"],
                          description: "操作类型",
                        },
                      },
                      name: {
                        def: {
                          type: "string",
                          description: "任务名称",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const result = extractZodDescriptions(schema, 0)

      expect(result).toContain("- operations:")
      expect(result.some((line) => line.includes("action: 操作类型"))).toBe(
        true
      )
      expect(result.some((line) => line.includes("name: 任务名称"))).toBe(true)
      expect(result.some((line) => line.includes("可选值: add, update"))).toBe(
        true
      )
    })
  })

  describe("formatToolParameterDescriptions", () => {
    test("formats simple parameters", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "object",
          shape: {
            name: {
              def: {
                type: "string",
                description: "User name",
              },
            },
            age: {
              def: {
                type: "number",
                description: "User age",
              },
            },
          },
        },
      }

      const result = formatToolParameterDescriptions(schema)

      expect(result).toContain("参数说明：")
      expect(result).toContain("  - name: User name")
      expect(result).toContain("  - age: User age")
    })

    test("formats nested object parameters", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "object",
          shape: {
            config: {
              def: {
                type: "object",
                description: "Configuration object",
                shape: {
                  timeout: {
                    def: {
                      type: "number",
                      description: "Timeout in ms",
                    },
                  },
                  retries: {
                    def: {
                      type: "number",
                      description: "Retry count",
                    },
                  },
                },
              },
            },
          },
        },
      }

      const result = formatToolParameterDescriptions(schema)

      expect(result).toContain("  - config: Configuration object")
      expect(result).toContain("timeout: Timeout in ms")
      expect(result).toContain("retries: Retry count")
    })

    test("formats array parameters", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "object",
          shape: {
            tags: {
              def: {
                type: "array",
                description: "List of tags",
                element: {
                  def: {
                    type: "string",
                    description: "Tag name",
                  },
                },
              },
            },
          },
        },
      }

      const result = formatToolParameterDescriptions(schema)

      expect(result).toContain("  - tags: List of tags")
      expect(result).toContain("[元素]: Tag name")
    })

    test("formats enum parameters", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "object",
          shape: {
            status: {
              def: {
                type: "enum",
                values: ["pending", "active", "done"],
                description: "Task status",
              },
            },
          },
        },
      }

      const result = formatToolParameterDescriptions(schema)

      expect(result).toContain("  - status: Task status")
      expect(result).toContain("可选值: pending, active, done")
    })

    test("handles optional parameters", () => {
      // Mock what OpenCode passes
      const schema = {
        def: {
          type: "object",
          shape: {
            optional: {
              def: {
                type: "optional",
                innerType: {
                  def: {
                    type: "string",
                    description: "Optional field",
                  },
                },
              },
            },
          },
        },
      }

      const result = formatToolParameterDescriptions(schema)

      expect(result).toContain("  - optional:")
    })

    test("returns empty string for schema without shape", () => {
      const result = formatToolParameterDescriptions(null)

      expect(result).toBe("")
    })

    test("formats complex nested structure like edit_tasks", () => {
      // Mock what OpenCode passes for edit_tasks tool
      const schema = {
        def: {
          type: "object",
          shape: {
            operations: {
              def: {
                type: "array",
                description: "操作列表",
                element: {
                  def: {
                    type: "object",
                    shape: {
                      action: {
                        def: {
                          type: "enum",
                          values: ["add", "update", "delete", "decompose"],
                          description: "操作类型",
                        },
                      },
                      name: {
                        def: {
                          type: "optional",
                          innerType: {
                            def: {
                              type: "string",
                              description:
                                "任务名称（add/update/delete/decompose 操作必需）",
                            },
                          },
                        },
                      },
                      description: {
                        def: {
                          type: "optional",
                          innerType: {
                            def: {
                              type: "string",
                              description:
                                "任务描述（add 操作必需，update 操作可选）",
                            },
                          },
                        },
                      },
                      dependencies: {
                        def: {
                          type: "optional",
                          innerType: {
                            def: {
                              type: "array",
                              description:
                                "依赖任务列表（add/update 操作可选）",
                              element: {
                                def: {
                                  type: "string",
                                },
                              },
                            },
                          },
                        },
                      },
                      status: {
                        def: {
                          type: "optional",
                          innerType: {
                            def: {
                              type: "enum",
                              values: [
                                "pending",
                                "in_progress",
                                "completed",
                                "cancelled",
                                "waiting_for_message",
                              ],
                              description: "任务状态（update 操作可选）",
                            },
                          },
                        },
                      },
                      result: {
                        def: {
                          type: "optional",
                          innerType: {
                            def: {
                              type: "string",
                              description: "任务结果（update 操作可选）",
                            },
                          },
                        },
                      },
                      subtasks: {
                        def: {
                          type: "optional",
                          innerType: {
                            def: {
                              type: "array",
                              description: "子任务列表（decompose 操作必需）",
                              element: {
                                def: {
                                  type: "object",
                                  shape: {
                                    name: {
                                      def: {
                                        type: "string",
                                        description: "子任务名称",
                                      },
                                    },
                                    description: {
                                      def: {
                                        type: "string",
                                        description: "子任务描述",
                                      },
                                    },
                                    dependencies: {
                                      def: {
                                        type: "optional",
                                        innerType: {
                                          def: {
                                            type: "array",
                                            description:
                                              "子任务额外依赖（可选）",
                                            element: {
                                              def: {
                                                type: "string",
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const result = formatToolParameterDescriptions(schema)

      // Check top-level
      expect(result).toContain("  - operations: 操作列表")

      // Check nested fields
      expect(result).toContain("action: 操作类型")
      expect(result).toContain("name: 任务名称")
      expect(result).toContain("description: 任务描述")
      expect(result).toContain("dependencies: 依赖任务列表")
      expect(result).toContain("status: 任务状态")
      expect(result).toContain("result: 任务结果")
      expect(result).toContain("subtasks: 子任务列表")

      // Check enum values
      expect(result).toContain("可选值: add, update, delete, decompose")
      expect(result).toContain(
        "可选值: pending, in_progress, completed, cancelled, waiting_for_message"
      )

      // Check subtask fields
      expect(result).toContain("name: 子任务名称")
      expect(result).toContain("description: 子任务描述")
      expect(result).toContain("dependencies: 子任务额外依赖")
    })
  })
})
