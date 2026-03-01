import * as React from "react"
import MuiCard from "@mui/material/Card"
import MuiCardContent from "@mui/material/CardContent"
import MuiCardHeader from "@mui/material/CardHeader"
import MuiCardActions from "@mui/material/CardActions"
import Typography from "@mui/material/Typography"
import { CardProps as MuiCardProps } from "@mui/material/Card"

export const Card = React.forwardRef<HTMLDivElement, MuiCardProps>(
  (props, ref) => <MuiCard ref={ref} {...props} />
)
Card.displayName = "Card"

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subheader?: string
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subheader, children, ...props }, ref) => {
    if (children) {
      return (
        <div ref={ref} style={{ padding: "16px" }} {...props}>
          {children}
        </div>
      )
    }
    return (
      <MuiCardHeader ref={ref} title={title} subheader={subheader} {...props} />
    )
  }
)
CardHeader.displayName = "CardHeader"

export interface CardTitleProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ children, ...props }, ref) => (
    <Typography ref={ref} variant="h6" component="div" {...props}>
      {children}
    </Typography>
  )
)
CardTitle.displayName = "CardTitle"

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardDescription = React.forwardRef<
  HTMLDivElement,
  CardDescriptionProps
>(({ children, ...props }, ref) => (
  <Typography ref={ref} variant="body2" color="text.secondary" {...props}>
    {children}
  </Typography>
))
CardDescription.displayName = "CardDescription"

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  (props, ref) => <MuiCardContent ref={ref} {...props} />
)
CardContent.displayName = "CardContent"

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  (props, ref) => <MuiCardActions ref={ref} {...props} />
)
CardFooter.displayName = "CardFooter"
