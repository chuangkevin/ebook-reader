import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './EpubReader.css'
import { measureViewportHingeGap } from '../../utils/viewportSegments'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfReaderHandle {
  next: () => Promise<void>
  prev: () => Promise<void>
  goTo: (href: string) => Promise<void>
  goToFraction: (fraction: number) => Promise<void>
}

interface PdfReaderProps {
  bookId: string
  theme?: 'light' | 'dark' | 'sepia'
  userId: string
  initialProgress?: string
  writingMode: 'vertical-rl' | 'horizontal-tb'
  pageLayout: 'single' | 'spread'
  fontSize: number
  tapZoneLayout?: 'default' | 'bottom-next' | 'bottom-prev'
  onCenterTap?: () => void
  onProgressChange: (progress: string) => void
}

function parsePageFromProgress(progress?: string): number {
  if (!progress) return 1
  const parts = progress.split('@@').filter(Boolean)
  if (parts.length < 1) return 1
  const page = parseInt(parts[0], 10)
  return isNaN(page) || page < 1 ? 1 : page
}

const PdfReader = forwardRef<PdfReaderHandle, PdfReaderProps>(
  ({ bookId, theme = 'light', initialProgress, pageLayout, tapZoneLayout = 'default', onCenterTap, onProgressChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [numPages, setNumPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(() => parsePageFromProgress(initialProgress))
    const [containerWidth, setContainerWidth] = useState<number>(0)
    const [containerHeight, setContainerHeight] = useState<number>(0)
    const [hingeGap, setHingeGap] = useState(36)
    const pagesPerSpread = pageLayout === 'spread' ? 2 : 1
    const firstPage = pagesPerSpread === 2 && currentPage % 2 === 0 ? currentPage - 1 : currentPage

    const onProgressChangeRef = useRef(onProgressChange)
    useEffect(() => { onProgressChangeRef.current = onProgressChange }, [onProgressChange])

    // Measure container size
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const measure = () => {
        setContainerWidth(el.clientWidth)
        setContainerHeight(el.clientHeight)
        setHingeGap(measureViewportHingeGap())
      }
      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    // Report progress whenever page or total changes
    useEffect(() => {
      if (numPages > 0 && currentPage > 0) {
        onProgressChangeRef.current(`@@${firstPage}@@${numPages}`)
      }
    }, [firstPage, currentPage, numPages])

    const goToPage = useCallback((page: number) => {
      setCurrentPage((prev) => {
        const bounded = Math.max(1, Math.min(numPages || 1, page))
        const next = pagesPerSpread === 2 ? Math.floor((bounded - 1) / 2) * 2 + 1 : bounded
        return next !== prev ? next : prev
      })
    }, [numPages, pagesPerSpread])

    const next = useCallback(async () => {
      setCurrentPage((prev) => {
        const first = pagesPerSpread === 2 && prev % 2 === 0 ? prev - 1 : prev
        const next = Math.min(numPages || prev, first + pagesPerSpread)
        return next
      })
    }, [numPages, pagesPerSpread])

    const prev = useCallback(async () => {
      setCurrentPage((prev) => {
        const first = pagesPerSpread === 2 && prev % 2 === 0 ? prev - 1 : prev
        return Math.max(1, first - pagesPerSpread)
      })
    }, [pagesPerSpread])

    useImperativeHandle(ref, () => ({
      next,
      prev,
      goTo: async (href: string) => {
        const page = parseInt(href, 10)
        if (!isNaN(page)) goToPage(page)
      },
      goToFraction: async (fraction: number) => {
        if (numPages > 0) {
          const targetPage = pagesPerSpread === 2
            ? Math.round(fraction * (numPages - 1)) + 1
            : Math.round(fraction * numPages)
          goToPage(Math.max(1, targetPage))
        }
      },
    }))

    function handleDocumentLoadSuccess({ numPages: total }: { numPages: number }) {
      setNumPages(total)
      // Clamp current page to valid range after load
      setCurrentPage((prev) => {
        const bounded = Math.max(1, Math.min(total, prev))
        return pagesPerSpread === 2 ? Math.floor((bounded - 1) / 2) * 2 + 1 : bounded
      })
    }

    const fileUrl = `/api/books/${bookId}/file`

    // Determine render dimensions: fill container, keep aspect ratio via width
    const spreadGap = pageLayout === 'spread' ? hingeGap : 0
    const pageWidth = containerWidth > 0
      ? pageLayout === 'spread' ? Math.max(1, (containerWidth - spreadGap) / 2) : containerWidth
      : undefined
    const pageHeight = containerHeight > 0 ? containerHeight : undefined

    const onPrev = () => prev()
    const onNext = () => next()

    return (
      <div ref={containerRef} className="epub-reader-root" style={{
        background: theme === 'dark' ? '#181a19' : '#e0e1d9',
        '--reader-spread-gap': `${spreadGap}px`,
      } as React.CSSProperties}>
        {/* Tap zones */}
        {tapZoneLayout === 'default' ? (
          <>
            <div className="epub-tap-zone epub-tap-left" onClick={onPrev} />
            <div className="epub-tap-zone epub-tap-center" onClick={onCenterTap} />
            <div className="epub-tap-zone epub-tap-right" onClick={onNext} />
          </>
        ) : (
          <>
            <div
              className="epub-tap-zone epub-tap-top"
              onClick={tapZoneLayout === 'bottom-next' ? onPrev : onNext}
            />
            <div className="epub-tap-zone epub-tap-center-h" onClick={onCenterTap} />
            <div
              className="epub-tap-zone epub-tap-bottom"
              onClick={tapZoneLayout === 'bottom-next' ? onNext : onPrev}
            />
          </>
        )}

        {/* PDF render area */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            gap: `${spreadGap}px`,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Document
            className="pdf-document"
            file={fileUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            loading={<p role="status">正在載入 PDF…</p>}
            error={<p role="alert">無法載入 PDF，請重新整理後重試。</p>}
          >
            <Page
              pageNumber={firstPage}
              width={pageLayout === 'spread' ? undefined : pageWidth}
              height={pageHeight}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
            {pageLayout === 'spread' && firstPage < numPages && (
              <Page
                pageNumber={firstPage + 1}
                width={undefined}
                height={pageHeight}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            )}
            {pageLayout === 'spread' && firstPage === numPages && numPages > 0 && (
              <div aria-hidden="true" style={{ width: pageWidth, height: pageHeight }} />
            )}
          </Document>
        </div>
      </div>
    )
  }
)

PdfReader.displayName = 'PdfReader'

export default PdfReader
