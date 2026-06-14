"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  checked,
  onCheckedChange,
  indeterminate,
  ...props
}: Omit<CheckboxPrimitive.Root.Props, "checked" | "onCheckedChange"> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  indeterminate?: boolean
}) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      onCheckedChange={(checked) => onCheckedChange?.(checked)}
      indeterminate={indeterminate}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded border border-subtle-blue-gray outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-electric-blue data-[state=checked]:border-electric-blue text-white flex items-center justify-center transition-colors cursor-pointer",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {indeterminate ? (
          <MinusIcon className="h-3 w-3 stroke-[3]" />
        ) : (
          <CheckIcon className="h-3 w-3 stroke-[3]" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
