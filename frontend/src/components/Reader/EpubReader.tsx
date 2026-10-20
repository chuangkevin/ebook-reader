import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import './EpubReader.css'
import { convertDoc } from '../../utils/opencc'
import { measureViewportHingeGap, spreadGutterPx } from '../../utils/viewportSegments'
import { READER_FONT_FAMILY } from '../../utils/readerFont'
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
  pageLayout: 'single' | 'spread'
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
  dark: { bg: '#181a19', fg: '#e0e0e0' },
}

interface PaginatorLayoutTarget extends HTMLElement {
  getContents?: () => Array<{ doc: Document | null }>
  render?: () => void
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
  const allElements = 'html, body, p, span, div, h1, h2, h3, h4, h5, h6, a, li, td, th, blockquote, em, strong, b, i, small, figcaption, cite, q, dt, dd, label, summary, article, section, pre, code, figure'
  const bodyElements = 'p, span, div, h1, h2, h3, h4, h5, h6, a, li, td, th, blockquote, em, strong, b, i, small, figcaption, cite, q, dt, dd, label, summary, article, section, pre, code, figure'
  style.textContent = `
    html, body { writing-mode: ${writingMode} !important; -webkit-writing-mode: ${writingMode} !important; font-size: ${fontSize}px !important; font-family: ${READER_FONT_FAMILY} !important; background-color: ${bg} !important; -webkit-text-size-adjust: none !important; text-size-adjust: none !important; }
    ${bodyElements} { font-size: ${fontSize}px !important; font-family: ${READER_FONT_FAMILY} !important; background-color: transparent !important; }
    ${allElements} { color: ${fg} !important; }
    ::selection { background: #98432e; color: #fffdf7; }
    html { color-scheme: ${theme === "dark" ? "dark" : "light"}; scrollbar-color: ${fg} ${bg}; }
  `
}

function parseProgress(progress?: string): { chapterIndex: number; scrollFraction: number } | null {
  if (!progress) return null
  const parts = progress.split('@@').filter(Boolean)
  if (parts.length < 2) return null
  return { chapterIndex: parseInt(parts[0], 10), scrollFraction: parseFloat(parts[1]) }
}

function applyPageLayout(
  paginator: PaginatorLayoutTarget,
  pageLayout: 'single' | 'spread',
  gap: number,
  writingMode: 'vertical-rl' | 'horizontal-tb',
  render = false,
) {
  const horizontal = writingMode !== 'vertical-rl'
  // foliate-js renders a "two-column" spread as stacked blocks in vertical
  // writing, so vertical stays single-page; the two-page toggle applies to
  // horizontal reading only.
  const spread = pageLayout === 'spread' && horizontal
  paginator.setAttribute('max-column-count', spread ? '2' : '1')
  // Keep the top/bottom page margin tight; foliate-js defaults to 48px which
  // looks oversized for vertical writing on tall phone panes.
  const MARGIN = 24
  paginator.setAttribute('margin', `${MARGIN}px`)
  const top = paginator.shadowRoot?.getElementById('top') as HTMLElement | null
  top?.style.setProperty('--_max-column-count-portrait', spread ? '2' : '1')
  // Sync foliate's own layout-mode CSS: foliate toggles `.vertical` and `dir`
  // in its #beforeRender from the document's computed writing-mode, but that
  // can lag our injected CSS after a writing-mode switch. Without this, the
  // grid keeps resolving --_max-width from --_max-block-size (the vertical
  // formula) and the spread's two pages collapse into a narrow column that
  // crosses the hinge.
  top?.classList.toggle('vertical', !horizontal)
  paginator.setAttribute('dir', horizontal ? 'ltr' : 'rtl')

  const perPage = spread ? 2 : 1
  const pageWidth = paginator.clientWidth
  const pageHeight = paginator.clientHeight
  // foliate-js sizes the gap from the text-flow extent (height in vertical).
  const flowSize = horizontal ? pageWidth : pageHeight
  const pageFlowSize = horizontal ? pageWidth / perPage : pageHeight

  const gapSize = spread
    ? spreadGutterPx(measureViewportHingeGap(), pageFlowSize, gap)
    : Math.max(pageFlowSize * gap, MARGIN * 2)
  const gapFraction = flowSize > 0 ? gapSize / flowSize : gap
  paginator.setAttribute('gap', `${gapFraction * 100}%`)
  // Foliate's #beforeRender resolves the --_gap percentage against the
  // #container ({@link width}) — which is NARROWER than pageWidth — so the
  // rendered text gap is smaller than our intended px value and drifts off
  // the hinge. Fix: pin --_gap and --_half-gap in exact pixels so the grid's
  // --_half-gap and content column use the intended geometry. The percentage
  // attribute stays for foliate's JS (which computes the text column gap);
  // the two agree closely enough not to matter visually.
  top?.style.setProperty('--_gap', `${Math.round(gapSize)}px`)
  top?.style.setProperty('--_half-gap', `${Math.round(gapSize / 2)}px`)

  // foliate-js renders the actual gap as g/(1-g) of the flow size, and the
  // grid leaves (pageWidth - maxW) / 2 of blank space on each side. Solve the
  // page extent so every pane edge keeps at least MIN_SIDE_MARGIN; the centre
  // gap and hinge clearance are handled separately.
  const MIN_SIDE_MARGIN = 48
  const gapPx = gapFraction < 1 ? gapSize / (1 - gapFraction) : gapSize
  const widthExtent = Math.max(0, pageWidth - 2 * Math.max(MIN_SIDE_MARGIN, gapPx / 2))
  const heightExtent = Math.max(0, pageHeight - MARGIN * 2)
  // Foliate's grid resolves --_max-width from --_max-inline-size (horizontal)
  // or --_max-block-size (vertical), keyed off the .vertical class that its
  // #beforeRender re-applies from its own cached #vertical. That class can
  // lag a writing-mode switch, so pin both extents in pixels: the grid then
  // uses our computed layout regardless of foliate's internal mode.
  top?.style.setProperty('--_max-width', `${Math.round(widthExtent)}px`)
  top?.style.setProperty('--_max-height', `${Math.round(heightExtent)}px`)
  const inlineSize = horizontal ? widthExtent / perPage : heightExtent / perPage
  const blockSize = horizontal ? heightExtent : widthExtent
  if (inlineSize > 0) paginator.setAttribute('max-inline-size', `${Math.round(inlineSize)}px`)
  if (blockSize > 0) paginator.setAttribute('max-block-size', `${Math.round(blockSize)}px`)
  if (render && paginator.getContents?.().some(({ doc }) => Boolean(doc))) {
    paginator.render?.()
  }
}

const EpubReader = forwardRef<EpubReaderHandle, EpubReaderProps>(
  ({ bookId, initialProgress, writingMode, pageLayout, fontSize, gap = 0.06, theme = 'light', tapZoneLayout = 'default', openccMode = 'none', onCenterTap, onProgressChange, onTocLoad }, ref) => {
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
    const paginatorRef = useRef<HTMLElement>(null)
    const bookRef = useRef<any>(null)
    const currentProgressRef = useRef<{ index: number; anchor: number } | null>(null)
    const currentAnchorTextRef = useRef<string>('')  // layout-independent text marker for mode switch
    const totalSectionsRef = useRef(0)
    const sectionProgressRef = useRef<any>(null)
    const modeSwitchingRef = useRef(false)
    const initializedLayoutRef = useRef(false)
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

    useEffect(() => {
      const paginator = paginatorRef.current as any
      if (!paginator || loadState !== 'ready') return
      if (!initializedLayoutRef.current) {
        initializedLayoutRef.current = true
        return
      }
      applyPageLayout(paginator, pageLayout, gap, writingModeRef.current, true)
    }, [pageLayout, gap, loadState])

    useEffect(() => {
      if (loadState !== 'ready') return
      // Reflow on window resize for ALL modes — foliate caches its page size
      // at render time and will not notice container growth (e.g. the reader
      // chrome collapsing into fullscreen) until it is told explicitly.
      const reflowOnResize = () => {
        const paginator = paginatorRef.current as any
        if (paginator && !modeSwitchingRef.current) {
          applyPageLayout(paginator, pageLayout, gap, writingModeRef.current, true)
        }
      }
      window.addEventListener('resize', reflowOnResize)
      return () => window.removeEventListener('resize', reflowOnResize)
    }, [pageLayout, gap, loadState])

    // Re-inject CSS when fontSize/theme/openccMode changes (no position reset needed)
    useEffect(() => {
      const paginator = paginatorRef.current as any
      if (!paginator) return
      try {
        const { bg, fg } = THEME_COLORS[theme] ?? THEME_COLORS.light
        const wm = writingModeRef.current
        const allElements = 'html, body, p, span, div, h1, h2, h3, h4, h5, h6, a, li, td, th, blockquote, em, strong, b, i, small, figcaption, cite, q, dt, dd, label, summary, article, section, pre, code, figure'
        const bodyElements = 'p, span, div, h1, h2, h3, h4, h5, h6, a, li, td, th, blockquote, em, strong, b, i, small, figcaption, cite, q, dt, dd, label, summary, article, section, pre, code, figure'
        const css = `
          html, body { writing-mode: ${wm} !important; -webkit-writing-mode: ${wm} !important; font-size: ${fontSize}px !important; font-family: ${READER_FONT_FAMILY} !important; background-color: ${bg} !important; -webkit-text-size-adjust: none !important; text-size-adjust: none !important; }
          ${bodyElements} { background-color: transparent !important; }
          ${allElements} { font-size: ${fontSize}px !important; font-family: ${READER_FONT_FAMILY} !important; color: ${fg} !important; }
        `
        // Use paginator.setStyles() which properly re-layouts via view.expand()
        paginator.setStyles?.(css)

        // Also inject via injectStyles for the handleLoad path
        const contents = paginator.getContents?.() ?? []
        for (const { doc } of contents) {
          if (doc) {
            injectStyles(doc, wm, fontSize, theme)
            if (openccModeRef.current !== 'none') {
              convertDoc(doc, openccModeRef.current)
            }
          }
        }
        // Update paginator shadow DOM #background to match theme
        const bgEl = paginator.shadowRoot?.getElementById('background')
        if (bgEl) bgEl.style.background = bg
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
          applyPageLayout(paginator, pageLayout, gap, writingMode, false)
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
    }, [writingMode, pageLayout, gap])

    useEffect(() => {
      const paginator = paginatorRef.current as any
      if (!paginator) return

      let destroyed = false
      let restoring = true
      let settledProgress = ''
      let removeListeners = () => {}
      setLoadState('loading')

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
            if (destroyed) return
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
              const sp = sectionProgressRef.current
              const size = e.detail?.size ?? 0
              const weightedFraction = sp
                ? sp.getProgress(index, fraction, size).fraction
                : (index + fraction) / (totalSectionsRef.current || 1)
              settledProgress = `@@${index}@@${fraction}@@${totalSectionsRef.current}@@${weightedFraction}`
              // Suppress progress saves during mode switching to avoid overwriting with reset position
              if (!modeSwitchingRef.current && !restoring) {
                onProgressChangeRef.current(settledProgress)
              }
            }
          }

          paginator.addEventListener('load', handleLoad)
          paginator.addEventListener('relocate', handleRelocate)
          removeListeners = () => {
            paginator.removeEventListener('load', handleLoad)
            paginator.removeEventListener('relocate', handleRelocate)
          }

          paginator.setAttribute('flow', 'paginated')
          applyPageLayout(paginator, pageLayout, gapRef.current, writingModeRef.current)

          paginator.open(book)
          await paginator.next() // render first page

          // Restore progress
          const parsed = parseProgress(initialProgress)
          if (parsed && (parsed.chapterIndex > 0 || parsed.scrollFraction > 0)) {
            await paginator.goTo({ index: parsed.chapterIndex, anchor: parsed.scrollFraction })
          }
          if (!destroyed) {
            restoring = false
            // Publish only the restored page, including the first page of a new book.
            if (settledProgress) onProgressChangeRef.current(settledProgress)
            setLoadState('ready')
          }
        } catch (err) {
          if (!destroyed) setLoadState('error')
          console.error('[EpubReader] init error:', err)
        }
      }

      init()

      return () => {
        destroyed = true
        bookRef.current = null
        try {
          removeListeners()
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
        {loadState !== 'ready' && <div role={loadState === 'error' ? 'alert' : 'status'} style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', zIndex: 15, background: THEME_COLORS[theme].bg, color: THEME_COLORS[theme].fg }}>{loadState === 'error' ? '無法載入 EPUB，請重新整理後重試。' : '正在翻開書頁…'}</div>}
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
