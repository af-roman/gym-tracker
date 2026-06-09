import { useEffect } from 'react'

/** Prevent the page behind a modal from scrolling. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const scrollY = window.scrollY
    const { overflow, position, top, width, touchAction } = document.body.style
    const htmlTouchAction = document.documentElement.style.touchAction

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.touchAction = 'none'
    document.documentElement.style.touchAction = 'none'

    return () => {
      document.body.style.overflow = overflow
      document.body.style.position = position
      document.body.style.top = top
      document.body.style.width = width
      document.body.style.touchAction = touchAction
      document.documentElement.style.touchAction = htmlTouchAction
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}
