import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './EpubReader.css'

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
  userId: string
  initialProgress?: string
  writingMode: 'vertical-rl' | 'horizontal-tb'
  fontSize: number
  tapZoneLayout?: 'default' | 'bottom-next' | 'bottom-prev'
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
  ({ bookId, initialProgress, tapZoneLayout = 'default', onProgressChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [numPages, setNumPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(() => parsePageFromProgress(initialProgress))
    const [containerWidth, setContainerWidth] = useState<number>(0)
    const [containerHeight, setContainerHeight] = useState<number>(0)

    const onProgressChangeRef = useRef(onProgressChange)
    useEffect(() => { onProgressChangeRef.current = onProgressChange }, [onProgressChange])

    // Measure container size
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const measure = () => {
        setContainerWidth(el.clientWidth)
        setContainerHeight(el.clientHeight)
      }
      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    // Report progress whenever page or total changes
    useEffect(() => {
      if (numPages > 0 && currentPage > 0) {
        onProgressChangeRef.current(`@@${currentPage}@@${numPages}`)
      }
    }, [currentPage, numPages])

    const goToPage = useCallback((page: number) => {
      setCurrentPage((prev) => {
        const next = Math.max(1, Math.min(numPages || 1, page))
        return next !== prev ? next : prev
      })
    }, [numPages])

    const next = useCallback(async () => {
      setCurrentPage((prev) => {
        const next = Math.min(numPages || prev, prev + 1)
        return next
      })
    }, [numPages])

    const prev = useCallback(async () => {
      setCurrentPage((prev) => Math.max(1, prev - 1))
    }, [])

    useImperativeHandle(ref, () => ({
      next,
      prev,
      goTo: async (href: string) => {
        const page = parseInt(href, 10)
        if (!isNaN(page)) goToPage(page)
      },
      goToFraction: async (fraction: number) => {
        if (numPages > 0) goToPage(Math.max(1, Math.round(fraction * numPages)))
      },
    }))

    function handleDocumentLoadSuccess({ numPages: total }: { numPages: number }) {
      setNumPages(total)
      // Clamp current page to valid range after load
      setCurrentPage((prev) => Math.max(1, Math.min(total, prev)))
    }

    const fileUrl = `/api/books/${bookId}/file`

    // Determine render dimensions: fill container, keep aspect ratio via width
    const pageWidth = containerWidth > 0 ? containerWidth : undefined
    const pageHeight = containerHeight > 0 ? containerHeight : undefined

    const onPrev = () => prev()
    const onNext = () => next()

    return (
      <div ref={containerRef} className="epub-reader-root" style={{ background: '#525659' }}>
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

        {/* PDF render area */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Document
            file={fileUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            loading={null}
            error={null}
          >
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              height={pageHeight}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </Document>
        </div>
      </div>
    )
  }
)

PdfReader.displayName = 'PdfReader'

export default PdfReader
