import * as React from "react"
import MuiTable from "@mui/material/Table"
import MuiTableBody from "@mui/material/TableBody"
import MuiTableCell from "@mui/material/TableCell"
import MuiTableContainer from "@mui/material/TableContainer"
import MuiTableHead from "@mui/material/TableHead"
import MuiTableRow from "@mui/material/TableRow"
import Paper from "@mui/material/Paper"
import { TableProps as MuiTableProps } from "@mui/material/Table"
export interface TableProps extends MuiTableProps {}
export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (props, ref) => (
    <MuiTableContainer component={Paper}>
      <MuiTable ref={ref} {...props} />
    </MuiTableContainer>
  )
)
Table.displayName = "Table"
export const TableHeader = MuiTableHead
export const TableBody = MuiTableBody
export const TableFooter = MuiTableHead
export const TableRow = MuiTableRow
export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "align">
>((props, ref) => <MuiTableCell ref={ref} component="th" {...props} />)
TableHead.displayName = "TableHead"
export const TableCell = MuiTableCell
export const TableCaption = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) => (
  <caption
    style={{ marginTop: "16px", fontSize: "0.875rem", color: "text.secondary" }}
    {...props}
  >
    {children}
  </caption>
)
TableCaption.displayName = "TableCaption"
