import * as React from "react"

const MOBILE_BREAKPOINT = 768 // md breakpoint from Tailwind

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      setIsMobile(false) // Default to not mobile on server or during build
      return
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches) // Set initial value

    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile === undefined ? false : isMobile; // Return false if undefined (e.g. SSR before mount)
}
