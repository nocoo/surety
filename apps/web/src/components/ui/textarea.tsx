import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-basalt-border hover:border-basalt-foreground/20 placeholder:text-basalt-muted-foreground focus-visible:border-ring focus-visible:ring-basalt-ring/50 aria-invalid:ring-basalt-destructive/20 dark:aria-invalid:ring-basalt-destructive/40 aria-invalid:border-basalt-destructive flex field-sizing-content min-h-16 w-full rounded-md border bg-basalt-secondary px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:border-transparent disabled:hover:border-transparent disabled:text-basalt-muted-foreground/38 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
