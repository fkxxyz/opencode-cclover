import * as React from "react"
import MuiSelect, { SelectProps as MuiSelectProps } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
export interface SelectProps extends Omit<MuiSelectProps, "children"> {
  label?: string
  children?: React.ReactNode
  value?: string
  onValueChange?: (value: string) => void
}
  export const Select = React.forwardRef<any, SelectProps>(
  ({ label, children, value, onValueChange, ...props }, ref) => {
    const handleChange = (event: any) => {
      onValueChange?.(event.target.value)
    }
    return (
      <FormControl fullWidth size="small">
        {label && <InputLabel>{label}</InputLabel>}
        <MuiSelect ref={ref} label={label} value={value} onChange={handleChange} {...props}>
          {children}
        </MuiSelect>
      </FormControl>
    )
  }
  )
Select.displayName = "Select"
export const SelectTrigger = Select
  export const SelectValue = ({ children, placeholder }: { children?: React.ReactNode; placeholder?: string }) => <>{children || placeholder}</>
export const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>
export const SelectItem = MenuItem
export const SelectGroup = React.Fragment
export const SelectLabel = ({ children }: { children?: React.ReactNode }) => (
  <MenuItem disabled>{children}</MenuItem>
)
export const SelectSeparator = () => (
  <MenuItem disabled sx={{ height: "1px", minHeight: "1px" }} />
)
