import Chip, { ChipProps } from "@mui/material/Chip"
export interface BadgeProps extends Omit<ChipProps, "variant" | "children"> {
  variant?: "default" | "secondary" | "destructive" | "outline"
  children?: React.ReactNode
}
export function Badge({ variant = "default", children, ...props }: BadgeProps) {
  const getColor = () => {
    switch (variant) {
      case "default":
        return "primary"
      case "secondary":
        return "secondary"
      case "destructive":
        return "error"
      case "outline":
        return "default"
      default:
        return "default"
    }
  }
  const getMuiVariant = () => {
    return variant === "outline" ? "outlined" : "filled"
  }
  return (
    <Chip
      label={children}
      color={getColor()}
      variant={getMuiVariant()}
      size="small"
      {...props}
    />
  )
}
