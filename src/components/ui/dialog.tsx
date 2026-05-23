"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

/* ─── Slot Detection Helpers ─── */
const HEADER_MARKER = Symbol.for("dialog-header")
const FOOTER_MARKER = Symbol.for("dialog-footer")

function getComponentName(type: unknown): string | undefined {
  if (typeof type === "function") {
    return (type as any).displayName || (type as any).name
  }
  return undefined
}

function isHeader(el: React.ReactNode): boolean {
  if (!React.isValidElement(el)) return false
  const type = el.type as any
  // Method 1: Symbol marker (primary)
  if (type[HEADER_MARKER]) return true
  // Method 2: displayName
  if (type.displayName === "DialogHeader") return true
  // Method 3: function name
  if (typeof type === "function" && type.name === "DialogHeader") return true
  return false
}

function isFooter(el: React.ReactNode): boolean {
  if (!React.isValidElement(el)) return false
  const type = el.type as any
  // Method 1: Symbol marker (primary)
  if (type[FOOTER_MARKER]) return true
  // Method 2: displayName
  if (type.displayName === "DialogFooter") return true
  // Method 3: function name
  if (typeof type === "function" && type.name === "DialogFooter") return true
  return false
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const childArray = React.Children.toArray(children)
  const headerChild = childArray.find(isHeader)
  const footerChild = childArray.find(isFooter)
  const bodyChildren = childArray.filter((c) => !isHeader(c) && !isFooter(c))

  const hasSlots = headerChild != null || footerChild != null

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background text-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex flex-col w-full max-w-[calc(100%-2rem)] max-h-[85vh] translate-x-[-50%] translate-y-[-50%] gap-0 overflow-hidden rounded-lg border shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {/* Close button — absolute top-right */}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 z-50 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}

        {hasSlots ? (
          <>
            {/* Slot-detected layout: header fixed, body scrollable, footer fixed */}
            {headerChild && (
              <div className="flex-shrink-0 px-6 pt-6 pb-2">{headerChild}</div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-2">
              {bodyChildren}
            </div>
            {footerChild && (
              <div className="flex-shrink-0 px-6 pt-4 pb-6 border-t bg-background">
                {footerChild}
              </div>
            )}
          </>
        ) : (
          /* Fallback: no slots detected — single scrollable area with sticky header/footer */
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
            {children}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center sm:text-left",
        className
      )}
      {...props}
    />
  )
}
DialogHeader.displayName = "DialogHeader"
;(DialogHeader as any)[HEADER_MARKER] = true

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}
DialogFooter.displayName = "DialogFooter"
;(DialogFooter as any)[FOOTER_MARKER] = true

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
