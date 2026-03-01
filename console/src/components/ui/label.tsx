import * as React from "react"
import FormLabel, { FormLabelProps } from "@mui/material/FormLabel"

export interface LabelProps extends FormLabelProps {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  (props, ref) => <FormLabel ref={ref} {...props} />
)

Label.displayName = "Label"
