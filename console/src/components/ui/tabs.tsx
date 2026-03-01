import * as React from "react"
import MuiTabs, { TabsProps as MuiTabsProps } from "@mui/material/Tabs"
import MuiTab, { TabProps as MuiTabProps } from "@mui/material/Tab"
import Box from "@mui/material/Box"
export interface TabsProps extends Omit<MuiTabsProps, "value" | "onChange"> {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  children?: React.ReactNode
}
const TabsContext = React.createContext<{ value: string } | null>(null)
export const Tabs = ({ value, onValueChange, defaultValue, children, ...props }: TabsProps) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  const currentValue = value !== undefined ? value : internalValue
  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }
  const triggers: React.ReactElement[] = []
  const contents: React.ReactElement[] = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      if (child.type === TabsList) {
        React.Children.forEach(child.props.children, (tabChild) => {
          if (React.isValidElement(tabChild) && tabChild.type === TabsTrigger) {
            triggers.push(tabChild)
          }
        })
      } else if (child.type === TabsTrigger) {
        triggers.push(child)
      } else if (child.type === TabsContent) {
        contents.push(child)
      }
    }
  })
  return (
    <TabsContext.Provider value={{ value: currentValue }}>
      <Box>
        <MuiTabs value={currentValue} onChange={handleChange} {...props}>
          {triggers}
        </MuiTabs>
        {contents}
      </Box>
    </TabsContext.Provider>
  )
}
Tabs.displayName = "Tabs"
export const TabsList = ({ children, className }: { children?: React.ReactNode; className?: string }) => <Box className={className}>{children}</Box>
TabsList.displayName = "TabsList"
export interface TabsTriggerProps extends Omit<MuiTabProps, "value" | "children"> {
  value: string
  children?: React.ReactNode
}
export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ children, ...props }, ref) => <MuiTab ref={ref as any} label={children} {...props} />
)
TabsTrigger.displayName = "TabsTrigger"
export interface TabsContentProps {
  value: string
  children?: React.ReactNode
  className?: string
}
export const TabsContent = ({ value, children, className }: TabsContentProps) => {
  const parent = React.useContext(TabsContext)
  if (parent?.value !== value) return null
  return <Box sx={{ mt: 2 }} className={className}>{children}</Box>
}
TabsContent.displayName = "TabsContent"
