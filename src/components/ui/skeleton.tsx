import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse bg-subtle-blue-gray/25 rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
