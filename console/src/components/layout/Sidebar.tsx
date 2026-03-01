import { useProjectContext } from "../../contexts/ProjectContext"
import { cn } from "../../lib/utils"

export function Sidebar() {
  const { projects, currentProject, setCurrentProject } = useProjectContext()

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Projects</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {projects.map((project) => (
          <button
            key={project.projectId}
            onClick={() => setCurrentProject(project.projectId)}
            className={cn(
              "w-full px-4 py-3 text-left hover:bg-background transition-colors",
              "border-b border-gray-100",
              currentProject === project.projectId &&
                "bg-blue-50 border-l-4 border-l-blue-500"
            )}
          >
            <div className="font-medium text-foreground">
              {project.projectName}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {project.directory}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
