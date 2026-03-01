import * as React from "react"
import TextField, { TextFieldProps } from "@mui/material/TextField"

export interface InputProps extends Omit<TextFieldProps, "variant"> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => (
    <TextField
      inputRef={ref}
      variant="outlined"
      size="small"
      fullWidth
      {...props}
    />
  )
)

Input.displayName = "Input"
