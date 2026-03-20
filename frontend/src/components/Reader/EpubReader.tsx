import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

import './EpubReader.css'
import { convertDoc } from '../../utils/opencc'
// @ts-ignore
import { SectionProgress } from '../../lib/foliate-js/progress.js'

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
  goToFraction: (fraction: number) => Promise<void>
}

interface EpubReaderProps {
  bookId: string
  userId: string
  initialProgress?: string
  writingMode: 'vertical-rl' | 'horizontal-tb'
  fontSize: number
  gap?: number
  theme?: 'light' | 'sepia' | 'dark'
  tapZoneLayout?: 'default' | 'bottom-next' | 'bottom-prev'
  onCenterTap?: () => void
  openccMode?: 'none' | 'tw2s' | 's2tw'
  onProgressChange: (progress: string) => void
  onTocLoad?: (toc: any[]) => void
}

const THEME_COLORS: Record<string, { bg: string; fg: string }> = {
  light: { bg: '#ffffff', fg: '#000000' },
  sepia: { bg: '#f5ecd7', fg: '#3d2b1f' },
  dark: { bg: '#1a1a1a', fg: '#e0e0e0' },
}

function injectStyles(doc: Document, writingMode: string, fontSize: number, theme: string) {
  if (!doc?.head) return
  let style = doc.getElementById('__wm') as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = '__wm'
    doc.head.appendChild(style)
  }
  const { bg, fg } = THEME_COLORS[theme] ?? THEME_COLORS.light
  // Use * selector with !important to override inline styles and book CSS on all elements
  const allElements = 'html, body, p, span, div, h1, h2, h3, h4, h5, h6, a, li, td, th, blockquote, em, strong, b, i, small, figcaption, cite, q, dt, dd, label, summary'
  const bodyElements = 'p, span, div, a, li, td, th, blockquote, em, strong, b, i, small, figcaption, cite, q, dt, dd, label, summary'
  style.textContent = `
    html, body { writing-mode: ${writingMode} !important; -webkit-writing-mode: ${writingMode} !important; font-size: ${fontSize}px !important; background-color: ${bg} !important; }
    ${bodyElements} { font-size: ${fontSize}px !important; }
    ${allElements} { color: ${fg} !important; }
  `
}

function parseProgress(progress?: string): { chapterIndex: number; scrollFraction: number } | null {
  if (!progress) return null
  const parts = progress.split('@@').filter(Boolean)
  if (parts.length < 2) return null
  return { chapterIndex: parseInt(parts[0], 10), scrollFraction: parseFloat(parts[1]) }
}

const EpubReader = forwardRef<EpubReaderHandle, EpubReaderProps>(
  ({ bookId, initialProgress, writingMode, fontSize, gap = 0.06, theme = 'light', tapZoneLayout = 'default', openccMode = 'none', onCenterTap, onProgressChange, onTocLoad }, ref) => {
    const paginatorRef = useRef<HTMLElement>(null)
    const bookRef = useRef<any>(null)
    const currentProgressRef = useRef<{ index: number; anchor: number } | null>(null)
    const currentAnchorTextRef = useRef<string>('')  // layout-independent text marker for mode switch
    const totalSectionsRef = useRef(0)
    const sectionProgressRef = useRef<any>(null)
    const modeSwitchingRef = useRef(false)
    // Keep latest values accessible in event listeners without re-running effect
    const writingModeRef = useRef(writingMode)
    const fontSizeRef = useRef(fontSize)
    const gapRef = useRef(gap)
    const themeRef = useRef(theme)
    const openccModeRef = useRef(openccMode)
    const onProgressChangeRef = useRef(onProgressChange)

    useEffect(() => { writingModeRef.current = writingMode }, [writingMode])
    useEffect(() => { fontSizeRef.current = fontSize }, [fontSize])
    useEffect(() => { gapRef.current = gap }, [gap])
    useEffect(() => { themeRef.current = theme }, [theme])
    useEffect(() => { openccModeRef.current = openccMode }, [openccMode])
    useEffect(() => { onProgressChangeRef.current = onProgressChange }, [onProgressChange])

    // Update gap when it changes
    useEffect(() => {
      const paginator = paginatorRef.current as any
      if (!paginator) return
      paginator.setAttribute('gap', `${Math.round(gap * 100)}%`)
    }, [gap])

    // Re-inject CSS when fontSize/theme/openccMode changes (no position reset needed)
    useEffect(() => {
      const paginator = paginatorRef.current as any
      if (!paginator) return
      try {
        const contents = paginator.getContents?.() ?? []
        for (const { doc } of contents) {
          if (doc) {
            injectStyles(doc, writingModeRef.current, fontSize, theme)
            if (openccModeRef.current !== 'none') {
              convertDoc(doc, openccModeRef.current)
            }
          }
        }
        // Update paginator shadow DOM #background to match theme
        const bg = paginator.shadowRoot?.getElementById('background')
        if (bg) bg.style.background = (THEME_COLORS[theme] ?? THEME_COLORS.light).bg
        // Force paginator to re-layout after font size change
        paginator.render?.()
      } catch { /* paginator may not be initialized yet */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fontSize, theme, openccMode])

    // Re-open book when writingMode changes so paginator reflows with correct layout
    useEffect(() => {
      const paginator = paginatorRef.current as any
      const book = bookRef.current
      if (!paginator || !book) return
      const pos = currentProgressRef.current
      if (!pos) return  // not yet initialized, skip

      // Capture text marker BEFORE open() destroys the current iframe
      const anchorText = currentAnchorTextRef.current
      modeSwitchingRef.current = true
      ;(async () => {
        try {
          paginator.open(book)
          // Navigate to an adjacent section first. This changes paginator's internal #index so
          // the subsequent goTo(pos.index) uses the "different section" code path, which reloads
          // the iframe and calls #beforeRender({vertical, rtl}). #beforeRender reads the computed
          // writing-mode CSS (including our injected CSS) via getDirection(), updating Paginator.#vertical.
          // Without this, the "same section" path is taken (no iframe reload, stale #vertical from
          // the previous writing mode), causing Range client rects to use the wrong axis mapper and
          // scroll to page 1 (chapter start) instead of the correct position.
          const totalSections = totalSectionsRef.current
          const adjacentIdx = pos.index > 0 ? pos.index - 1 : Math.min(pos.index + 1, totalSections - 1)
          await paginator.goTo({ index: adjacentIdx, anchor: 0 })

          // Build a text-search anchor: finds the first 25 chars of saved text in the new doc.
          // Because the section is freshly loaded, Paginator.#vertical now reflects the new writing
          // mode, so the Range's client rects are processed by the correct rect mapper.
          // Fallback to pos.anchor (stored fraction) if text is not found.
          const anchor = anchorText
            ? (doc: Document) => {
                // Build a map of text nodes with their offsets in the concatenated text
                const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
                const nodes: { node: Node; start: number; len: number }[] = []
                let fullText = ''
                let nd: Node | null
                while ((nd = walker.nextNode())) {
                  const t = nd.textContent ?? ''
                  nodes.push({ node: nd, start: fullText.length, len: t.length })
                  fullText += t
                }
                // Strip whitespace from both for robust matching
                const strip = (s: string) => s.replace(/[\s\r\n]+/g, '')
                const cleanFull = strip(fullText)
                const cleanSearch = strip(anchorText).slice(0, 20)
                const matchIdx = cleanFull.indexOf(cleanSearch)
                if (matchIdx < 0) return pos.anchor  // fallback
                // Map clean index back to original fullText index
                let cleanCount = 0
                let origIdx = 0
                for (let i = 0; i < fullText.length; i++) {
                  if (!/[\s\r\n]/.test(fullText[i])) {
                    if (cleanCount === matchIdx) { origIdx = i; break }
                    cleanCount++
                  }
                }
                // Find which node contains origIdx and create a Range
                for (const n of nodes) {
                  if (origIdx >= n.start && origIdx < n.start + n.len) {
                    const offset = origIdx - n.start
                    const range = doc.createRange()
                    range.setStart(n.node, Math.min(offset, n.len))
                    range.setEnd(n.node, Math.min(offset + 1, n.len))
                    return range
                  }
                }
                return pos.anchor  // fallback
              }
            : pos.anchor
          await paginator.goTo({ index: pos.index, anchor })
        } catch (e) { console.error('[ModeSwitch] error:', e) }
        // Keep mode switch lock a bit longer so first user tap doesn't race
        setTimeout(() => { modeSwitchingRef.current = false }, 500)
      })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [writingMode])

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

          bookRef.current = book
          totalSectionsRef.current = book.sections?.length ?? 0
          try {
            sectionProgressRef.current = new SectionProgress(book.sections, 1500, 1600)
          } catch { /* fallback: no weighted progress */ }
          onTocLoad?.(book.toc ?? [])

          function handleLoad(e: CustomEvent) {
            const doc: Document = e.detail?.doc
            if (doc) {
              injectStyles(doc, writingModeRef.current, fontSizeRef.current, themeRef.current)
              if (openccModeRef.current !== 'none') {
                convertDoc(doc, openccModeRef.current)
              }
              // Sync paginator shadow DOM #background with current theme
              const bg = paginator.shadowRoot?.getElementById('background')
              if (bg) bg.style.background = (THEME_COLORS[themeRef.current] ?? THEME_COLORS.light).bg
            }
          }

          function handleRelocate(e: CustomEvent) {
            const { fraction, index, range } = e.detail ?? {}
            // Save the first visible text as a layout-independent position marker
            if (range?.toString) {
              const text = range.toString().trim().slice(0, 50)
              if (text) currentAnchorTextRef.current = text
            }
            // Inject CSS to all currently loaded iframes
            try {
              const contents = paginator.getContents?.() ?? []
              for (const { doc } of contents) {
                if (doc) {
                  injectStyles(doc, writingModeRef.current, fontSizeRef.current, themeRef.current)
                  if (openccModeRef.current !== 'none') {
                    convertDoc(doc, openccModeRef.current)
                  }
                }
              }
            } catch { /* ignore */ }

            if (typeof index === 'number' && typeof fraction === 'number') {
              currentProgressRef.current = { index, anchor: fraction }
              // Suppress progress saves during mode switching to avoid overwriting with reset position
              if (!modeSwitchingRef.current) {
                // Use SectionProgress for weighted book-wide fraction
                const sp = sectionProgressRef.current
                const size = e.detail?.size ?? 0
                const weightedFraction = sp
                  ? sp.getProgress(index, fraction, size).fraction
                  : (index + fraction) / (totalSectionsRef.current || 1)
                onProgressChangeRef.current(`@@${index}@@${fraction}@@${totalSectionsRef.current}@@${weightedFraction}`)
              }
            }
          }

          paginator.addEventListener('load', handleLoad)
          paginator.addEventListener('relocate', handleRelocate)

          paginator.setAttribute('flow', 'paginated')
          paginator.setAttribute('gap', `${Math.round(gapRef.current * 100)}%`)
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
        bookRef.current = null
        try {
          paginator.removeEventListener('load', () => {})
          paginator.removeEventListener('relocate', () => {})
        } catch { /* ignore */ }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId])

    useImperativeHandle(ref, () => ({
      next: async () => {
        if (modeSwitchingRef.current) return  // block during mode switch
        try { await (paginatorRef.current as any)?.next?.() } catch { /* ignore */ }
      },
      prev: async () => {
        if (modeSwitchingRef.current) return  // block during mode switch
        try { await (paginatorRef.current as any)?.prev?.() } catch { /* ignore */ }
      },
      goTo: async (href: string) => {
        try {
          const paginator = paginatorRef.current as any
          if (!paginator) return
          const book = bookRef.current
          if (book?.resolveHref) {
            const location = await book.resolveHref(href)
            await paginator.goTo(location)
          } else {
            await paginator.goTo(href)
          }
        } catch { /* ignore */ }
      },
      goToFraction: async (fraction: number) => {
        try {
          const paginator = paginatorRef.current as any
          const sp = sectionProgressRef.current
          if (!paginator || !sp) return
          const [index, anchor] = sp.getSection(fraction)
          await paginator.goTo({ index, anchor })
        } catch { /* ignore */ }
      },
    }))

    const onNext = () => { if (!modeSwitchingRef.current) (paginatorRef.current as any)?.next?.() }
    const onPrev = () => { if (!modeSwitchingRef.current) (paginatorRef.current as any)?.prev?.() }

    return (
      <div className="epub-reader-root">
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
