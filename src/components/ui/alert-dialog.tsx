"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

/* ─── Slot Detection Helpers ─── */
const HEADER_MARKER = Symbol.for("alert-dialog-header")
const FOOTER_MARKER = Symbol.for("alert-dialog-footer")

function isHeader(el: React.ReactNode): boolean {
  if (!React.isValidElement(el)) return false
  const type = el.type as any
  if (type[HEADER_MARKER]) return true
  if (type.displayName === "AlertDialogHeader") return true
  if (typeof type === "function" && type.name === "AlertDialogHeader") return true
  return false
}

function isFooter(el: React.ReactNode): boolean {
  if (!React.isValidElement(el)) return false
  const type = el.type as any
  if (type[FOOTER_MARKER]) return true
  if (type.displayName === "AlertDialogFooter") return true
  if (typeof type === "function" && type.name === "AlertDialogFooter") return true
  return false
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  const children = props.children as React.ReactNode
  const childArray = React.Children.toArray(children)
  const headerChild = childArray.find(isHeader)
  const footerChild = childArray.find(isFooter)
  const bodyChildren = childArray.filter((c) => !isHeader(c) && !isFooter(c))
  const hasSlots = headerChild != null || footerChild != null

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex flex-col w-full max-w-[calc(100%-2rem)] max-h-[85vh] translate-x-[-50%] translate-y-[-50%] gap-0 overflow-hidden rounded-lg border shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {hasSlots ? (
          <>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
            {children}
          </div>
        )}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}
AlertDialogHeader.displayName = "AlertDialogHeader"
;(AlertDialogHeader as any)[HEADER_MARKER] = true

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}
AlertDialogFooter.displayName = "AlertDialogFooter"
;(AlertDialogFooter as any)[FOOTER_MARKER] = true

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
