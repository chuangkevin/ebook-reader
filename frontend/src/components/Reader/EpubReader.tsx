import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

import './EpubReader.css'
import { convertDoc } from '../../utils/opencc'

// Register the foliate-paginator custom element
// @ts-ignore
import '../../lib/foliate-js/paginator.js'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'foliate-paginator': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}

export interface EpubReaderHandle {
  next: () => Promise<void>
  prev: () => Promise<void>
  goTo: (href: string) => Promise<void>
}

interface EpubReaderProps {
  bookId: number
  userId: number
  initialProgress?: string
  writingMode: 'vertical-rl' | 'horizontal-tb'
  fontSize: number
  tapZoneLayout?: 'default' | 'bottom-next' | 'bottom-prev'
  openccMode?: 'none' | 'tw2s' | 's2tw'
  onProgressChange: (progress: string) => void
  onTocLoad?: (toc: any[]) => void
}

function injectWritingMode(doc: Document, writingMode: string, fontSize: number) {
  if (!doc?.head) return
  let style = doc.getElementById('__wm') as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = '__wm'
    doc.head.appendChild(style)
  }
  style.textContent = `html, body { writing-mode: ${writingMode} !important; -webkit-writing-mode: ${writingMode} !important; font-size: ${fontSize}px; }`
}

function parseProgress(progress?: string): { chapterIndex: number; scrollFraction: number } | null {
  if (!progress) return null
  const parts = progress.split('@@').filter(Boolean)
  if (parts.length < 2) return null
  return { chapterIndex: parseInt(parts[0], 10), scrollFraction: parseFloat(parts[1]) }
}

const EpubReader = forwardRef<EpubReaderHandle, EpubReaderProps>(
  ({ bookId, initialProgress, writingMode, fontSize, tapZoneLayout = 'default', openccMode = 'none', onProgressChange, onTocLoad }, ref) => {
    const paginatorRef = useRef<HTMLElement>(null)
    // Keep latest values accessible in event listeners without re-running effect
    const writingModeRef = useRef(writingMode)
    const fontSizeRef = useRef(fontSize)
    const openccModeRef = useRef(openccMode)
    const onProgressChangeRef = useRef(onProgressChange)

    useEffect(() => { writingModeRef.current = writingMode }, [writingMode])
    useEffect(() => { fontSizeRef.current = fontSize }, [fontSize])
    useEffect(() => { openccModeRef.current = openccMode }, [openccMode])
    useEffect(() => { onProgressChangeRef.current = onProgressChange }, [onProgressChange])

    // Re-inject CSS when writingMode, fontSize, or openccMode changes without reinitializing
    useEffect(() => {
      const paginator = paginatorRef.current as any
      if (!paginator) return
      try {
        const contents = paginator.getContents?.() ?? []
        for (const { doc } of contents) {
          if (doc) injectWritingMode(doc, writingMode, fontSize)
        }
      } catch {
        // paginator may not be initialized yet
      }
    }, [writingMode, fontSize, openccMode])

    useEffect(() => {
      const paginator = paginatorRef.current as any
      if (!paginator) return

      let destroyed = false

      async function init() {
        try {
          // @ts-ignore
          const { makeBook } = await import('../../lib/foliate-js/view.js')

          const resp = await fetch(`/api/books/${bookId}/file`)
          if (!resp.ok) throw new Error(`Failed to fetch book: ${resp.status}`)
          const blob = await resp.blob()
          const file = new File([blob], `book-${bookId}.epub`, { type: blob.type || 'application/epub+zip' })

          if (destroyed) return

          const book = await makeBook(file)
          if (destroyed) return

          onTocLoad?.(book.toc ?? [])

          function handleLoad(e: CustomEvent) {
            const doc: Document = e.detail?.doc
            if (doc) {
              injectWritingMode(doc, writingModeRef.current, fontSizeRef.current)
              if (openccModeRef.current !== 'none') {
                convertDoc(doc, openccModeRef.current)
              }
            }
          }

          function handleRelocate(e: CustomEvent) {
            const { fraction, index } = e.detail ?? {}
            // Inject CSS to all currently loaded iframes
            try {
              const contents = paginator.getContents?.() ?? []
              for (const { doc } of contents) {
                if (doc) {
                  injectWritingMode(doc, writingModeRef.current, fontSizeRef.current)
                  if (openccModeRef.current !== 'none') {
                    convertDoc(doc, openccModeRef.current)
                  }
                }
              }
            } catch { /* ignore */ }

            if (typeof index === 'number' && typeof fraction === 'number') {
              onProgressChangeRef.current(`@@${index}@@${fraction}`)
            }
          }

          paginator.addEventListener('load', handleLoad)
          paginator.addEventListener('relocate', handleRelocate)

          paginator.setAttribute('flow', 'paginated')
          paginator.setAttribute('gap', '0.06')
          paginator.setAttribute('max-column-count', '1')

          paginator.open(book)
          await paginator.next() // render first page

          // Restore progress
          const parsed = parseProgress(initialProgress)
          if (parsed && (parsed.chapterIndex > 0 || parsed.scrollFraction > 0)) {
            try {
              await paginator.goTo({ index: parsed.chapterIndex, anchor: parsed.scrollFraction })
            } catch { /* ignore if goTo fails */ }
          }
        } catch (err) {
          console.error('[EpubReader] init error:', err)
        }
      }

      init()

      return () => {
        destroyed = true
        // Remove event listeners — paginator element persists in DOM so clean up
        try {
          paginator.removeEventListener('load', () => {})
          paginator.removeEventListener('relocate', () => {})
        } catch { /* ignore */ }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId])

    useImperativeHandle(ref, () => ({
      next: async () => {
        try { await (paginatorRef.current as any)?.next?.() } catch { /* ignore */ }
      },
      prev: async () => {
        try { await (paginatorRef.current as any)?.prev?.() } catch { /* ignore */ }
      },
      goTo: async (href: string) => {
        try { await (paginatorRef.current as any)?.goTo?.(href) } catch { /* ignore */ }
      },
    }))

    const paginatorEl = paginatorRef.current as any
    const onNext = () => paginatorEl?.next?.()
    const onPrev = () => paginatorEl?.prev?.()

    return (
      <div className="epub-reader-root">
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

        {/* @ts-ignore custom element */}
        <foliate-paginator
          ref={paginatorRef}
          className="epub-paginator"
        />
      </div>
    )
  }
)

EpubReader.displayName = 'EpubReader'

export default EpubReader
