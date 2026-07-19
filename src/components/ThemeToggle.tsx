"use client"

import { Moon, Sun, Contrast } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('high-contrast')
    else setTheme('light')
  }

  return (
    <Button variant="outline" size="icon" onClick={cycleTheme} aria-label="Toggle theme">
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 high-contrast:-rotate-90 high-contrast:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 high-contrast:-rotate-90 high-contrast:scale-0" />
      <Contrast className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all high-contrast:rotate-0 high-contrast:scale-100" />
    </Button>
  )
}
