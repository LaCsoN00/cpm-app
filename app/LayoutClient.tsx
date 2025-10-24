"use client"

import { ReactNode } from "react"
import { RestrictionCheck } from "./components/RestrictionCheck"

export function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <>
      <RestrictionCheck />
      {children}
    </>
  )
}
