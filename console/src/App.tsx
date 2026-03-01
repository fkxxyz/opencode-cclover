import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>OpenCode CClover Console</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            前端项目初始化完成!
          </p>
          <Button>测试按钮</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default App