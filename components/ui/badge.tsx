import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border-2 px-2.5 py-1 text-xs font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all overflow-hidden shadow-sm",
  {
    variants: {
      variant: {
        default:
          "border-blue-200 bg-gradient-to-r from-blue-500 to-indigo-600 text-white [a&]:hover:from-blue-600 [a&]:hover:to-indigo-700 [a&]:hover:shadow-md",
        secondary:
          "border-gray-300 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 [a&]:hover:from-gray-200 [a&]:hover:to-gray-300 [a&]:hover:shadow-md",
        destructive:
          "border-red-200 bg-gradient-to-r from-red-500 to-rose-600 text-white [a&]:hover:from-red-600 [a&]:hover:to-rose-700 [a&]:hover:shadow-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-gray-300 bg-white text-gray-700 [a&]:hover:bg-gray-50 [a&]:hover:border-gray-400 [a&]:hover:shadow-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
