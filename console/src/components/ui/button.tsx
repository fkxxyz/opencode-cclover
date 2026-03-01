import * as React from "react"
import MuiButton, { ButtonProps as MuiButtonProps } from "@mui/material/Button"

export interface ButtonProps extends Omit<MuiButtonProps, "variant" | "size"> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", ...props }, ref) => {
    const getMuiVariant = (): MuiButtonProps["variant"] => {
      switch (variant) {
        case "default":
          return "contained"
        case "destructive":
          return "contained"
        case "outline":
          return "outlined"
        case "secondary":
          return "contained"
        case "ghost":
          return "text"
        case "link":
          return "text"
        default:
          return "contained"
      }
    }

    const getColor = (): MuiButtonProps["color"] => {
      switch (variant) {
        case "destructive":
          return "error"
        case "secondary":
          return "secondary"
        default:
          return "primary"
      }
    }

    const getMuiSize = (): MuiButtonProps["size"] => {
      switch (size) {
        case "sm":
          return "small"
        case "lg":
          return "large"
        case "icon":
          return "small"
        default:
          return "medium"
      }
    }

    const sx = {
      ...(variant === "link" && {
        textDecoration: "underline",
        textUnderlineOffset: "4px",
      }),
      ...(size === "icon" && {
        minWidth: "40px",
        width: "40px",
        height: "40px",
        padding: 0,
      }),
    }

    return (
      <MuiButton
        ref={ref}
        variant={getMuiVariant()}
        color={getColor()}
        size={getMuiSize()}
        sx={sx}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
