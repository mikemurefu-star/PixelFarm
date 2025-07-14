import * as React from "react"
import { DialogTitle } from "@radix-ui/react-dialog"

export const SheetTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<typeof DialogTitle>>(
  (props, ref) => <DialogTitle ref={ref} {...props} />
)

SheetTitle.displayName = "SheetTitle"
