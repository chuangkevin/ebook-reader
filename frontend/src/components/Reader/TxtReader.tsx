import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import './EpubReader.css'

export interface TxtReaderHandle {
  next: () => Promise<void>
  prev: () => Promise<void>
  goTo: (href: string) => Promise<void>
  goToFraction: (fraction: number) => Promise<void>
}

interface TxtReaderProps {
  bookId: string
  userId: string
  initialProgress?: string
  writingMode: 'vertical-rl' | 'horizontal-tb'
  fontSize: number
  tapZoneLayout?: 'default' | 'bottom-next' | 'bottom-prev'
  onProgressChange: (progress: string) => void
}

function parseScrollFraction(progress?: string): number {
  if (!progress) return 0
  const parts = progress.split('@@').filter(Boolean)
  if (parts.length < 1) return 0
  const fraction = parseFloat(parts[0])
  return isNaN(fraction) ? 0 : Math.max(0, Math.min(1, fraction))
}

const TxtReader = forwardRef<TxtReaderHandle, TxtReaderProps>(
  ({ bookId, initialProgress, writingMode, fontSize, tapZoneLayout = 'default', onProgressChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [text, setText] = useState<string>('')
    const [loading, setLoading] = useState(true)

    const onProgressChangeRef = useRef(onProgressChange)
    useEffect(() => { onProgressChangeRef.current = onProgressChange }, [onProgressChange])

    const initialFraction = useRef(parseScrollFraction(initialProgress))
    const progressRestoredRef = useRef(false)
    const scrollingProgrammaticallyRef = useRef(false)

    // Fetch text content
    useEffect(() => {
      setLoading(true)
      progressRestoredRef.current = false
      fetch(`/api/books/${bookId}/file`)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
          return res.arrayBuffer()
        })
        .then((buf) => {
          const decoded = new TextDecoder('utf-8').decode(buf)
          setText(decoded)
          setLoading(false)
        })
        .catch((err) => {
          console.error('[TxtReader] fetch error:', err)
          setLoading(false)
        })
    }, [bookId])

    // Restore scroll position after text is loaded and rendered
    useEffect(() => {
      if (loading || progressRestoredRef.current) return
      const el = containerRef.current
      if (!el) return

      const fraction = initialFraction.current
      if (fraction <= 0) {
        progressRestoredRef.current = true
        return
      }

      // Use rAF to ensure layout has settled after text render
      const raf = requestAnimationFrame(() => {
        if (!containerRef.current) return
        const c = containerRef.current
        const isVertical = writingMode === 'vertical-rl'
        scrollingProgrammaticallyRef.current = true
        if (isVertical) {
          // vertical-rl scrolls along scrollLeft (right-to-left, so negative)
          const maxScroll = c.scrollWidth - c.clientWidth
          c.scrollLeft = -(fraction * maxScroll)
        } else {
          const maxScroll = c.scrollHeight - c.clientHeight
          c.scrollTop = fraction * maxScroll
        }
        progressRestoredRef.current = true
        setTimeout(() => { scrollingProgrammaticallyRef.current = false }, 100)
      })
      return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading])

    // Track scroll and report progress
    const handleScroll = useCallback(() => {
      if (scrollingProgrammaticallyRef.current) return
      const el = containerRef.current
      if (!el) return

      const isVertical = writingMode === 'vertical-rl'
      let fraction: number
      if (isVertical) {
        const maxScroll = el.scrollWidth - el.clientWidth
        fraction = maxScroll > 0 ? Math.abs(el.scrollLeft) / maxScroll : 0
      } else {
        const maxScroll = el.scrollHeight - el.clientHeight
        fraction = maxScroll > 0 ? el.scrollTop / maxScroll : 0
      }
      fraction = Math.max(0, Math.min(1, fraction))
      onProgressChangeRef.current(`@@${fraction.toFixed(6)}@@1`)
    }, [writingMode])

    // Scroll by one "page" forward
    const scrollForward = useCallback(() => {
      const el = containerRef.current
      if (!el) return
      const isVertical = writingMode === 'vertical-rl'
      if (isVertical) {
        // vertical-rl: positive scrollLeft moves left (which is "back"), negative is "forward"
        el.scrollLeft -= el.clientWidth * 0.8
      } else {
        el.scrollTop += el.clientHeight * 0.8
      }
    }, [writingMode])

    // Scroll by one "page" backward
    const scrollBackward = useCallback(() => {
      const el = containerRef.current
      if (!el) return
      const isVertical = writingMode === 'vertical-rl'
      if (isVertical) {
        el.scrollLeft += el.clientWidth * 0.8
      } else {
        el.scrollTop -= el.clientHeight * 0.8
      }
    }, [writingMode])

    useImperativeHandle(ref, () => ({
      next: async () => scrollForward(),
      prev: async () => scrollBackward(),
      goTo: async () => {
        // TXT has no chapter navigation
      },
      goToFraction: async (fraction: number) => {
        const el = containerRef.current
        if (el) el.scrollTop = fraction * (el.scrollHeight - el.clientHeight)
      },
    }))

    const onNext = () => scrollForward()
    const onPrev = () => scrollBackward()

    return (
      <div className="epub-reader-root">
        {/* Tap zones */}
        {tapZoneLayout === 'default' ? (
          <>
            <div className="epub-tap-zone epub-tap-left" onClick={onPrev} />
            <div className="epub-tap-zone epub-tap-right" onClick={onNext} />
          </>
        ) : (
          <>
            <div
              className="epub-tap-zone epub-tap-top"
              onClick={tapZoneLayout === 'bottom-next' ? onPrev : onNext}
            />
            <div
              className="epub-tap-zone epub-tap-bottom"
              onClick={tapZoneLayout === 'bottom-next' ? onNext : onPrev}
            />
          </>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'auto',
            writingMode,
            fontSize: `${fontSize}px`,
            lineHeight: 1.8,
            padding: '1rem',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {loading ? null : text}
        </div>
      </div>
    )
  }
)

TxtReader.displayName = 'TxtReader'

export default TxtReader
