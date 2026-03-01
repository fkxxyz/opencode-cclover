import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import type { Memory } from "../../types/index"

interface MemoryViewProps {
  memory: Memory
}

export function MemoryView({ memory }: MemoryViewProps) {
  const [isCustomExpanded, setIsCustomExpanded] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>记忆</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 经验知识 */}
        <div>
          <h3 className="text-sm font-semibold mb-2">经验知识</h3>
          {memory.knowledge.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无经验知识</p>
          ) : (
            <ul className="space-y-1">
              {memory.knowledge.map((item, index) => (
                <li
                  key={index}
                  className="text-sm text-muted-foreground pl-4 border-l-2 border-gray-200"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 自定义字段 */}
        <div>
          <button
            onClick={() => setIsCustomExpanded(!isCustomExpanded)}
            className="flex items-center gap-1 text-sm font-semibold hover:text-primary transition-colors"
          >
            {isCustomExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            自定义字段
          </button>
          {isCustomExpanded && (
            <div className="mt-2">
              {Object.keys(memory.custom).length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无自定义字段</p>
              ) : (
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(memory.custom, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
