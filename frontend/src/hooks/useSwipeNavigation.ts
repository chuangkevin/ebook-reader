import { useEffect } from 'react'

function useSwipeNavigation(
  elementRef: React.RefObject<HTMLElement>,
  onNext: () => void,
  onPrev: () => void,
  threshold: number = 50
): void {
  useEffect(() => {
    const el = elementRef.current
    if (!el) return

    let startX = 0
    let startY = 0

    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      startX = touch.clientX
      startY = touch.clientY
    }

    function handleTouchEnd(e: TouchEvent) {
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      if (Math.abs(deltaX) < threshold) return
      // Must be more horizontal than vertical
      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return

      if (deltaX < -threshold) {
        onNext()
      } else if (deltaX > threshold) {
        onPrev()
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [elementRef, onNext, onPrev, threshold])
}

export default useSwipeNavigation
