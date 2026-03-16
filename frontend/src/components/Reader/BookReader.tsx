import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { ReactReader, ReactReaderStyle } from 'react-reader';
import type { NavItem } from 'epubjs';
import type { RootState } from '../../store';
import apiService from '../../services/api.service';
import { useProgressSync } from '../../hooks/useProgressSync';
import type { Book } from '../../types';
import { readerThemes } from '../../utils/readerThemes';
import { getTapAction, getTapZones } from '../../utils/navigation';
import PdfReader from './PdfReader';
import TxtReader from './TxtReader';
import ReaderSettings from './ReaderSettings';

interface EpubRendition {
  themes: {
    default: (styles: Record<string, Record<string, string>>) => void;
  };
  prev: () => void;
  next: () => void;
  display: (target: string) => void;
  flow: (value: string) => void;
  currentLocation: () => unknown;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  hooks: {
    content: {
      register: (fn: (contents: { document: Document; window: Window }) => void) => void;
    };
  };
  book: {
    locations: {
      generate: (chars: number) => Promise<string[]>;
      locationFromCfi: (cfi: string) => number;
      total: number;
    };
  };
}

/* ── Tap zone hint (small arrows at edges) ──────────────── */
function TapZoneOverlay({ tapMode, handPreference, invert }: {
  tapMode: 'same-side' | 'two-side';
  handPreference: 'left' | 'right';
  invert: boolean;
}) {
  const zones = getTapZones(tapMode, handPreference, invert);

  return (
    <>
      {zones.map((zone, i) => {
        const isSameSide = tapMode === 'same-side';
        let arrow: string;
        if (isSameSide) {
          arrow = zone.vertical === 'top' ? '\u25B2' : '\u25BC';
        } else {
          arrow = zone.side === 'left' ? '\u25C0' : '\u25B6';
        }

        const sx: Record<string, unknown> = {
          position: 'absolute',
          pointerEvents: 'none',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.25)',
          fontSize: 10,
          userSelect: 'none',
        };

        if (isSameSide) {
          if (zone.side === 'left') { sx.left = 4; } else { sx.right = 4; }
          if (zone.vertical === 'top') { sx.top = '20%'; } else { sx.bottom = '20%'; }
        } else {
          sx.top = '50%';
          sx.transform = 'translateY(-50%)';
          if (zone.side === 'left') { sx.left = 4; } else { sx.right = 4; }
        }

        return (
          <Box key={i} sx={sx}>
            {arrow}
          </Box>
        );
      })}
    </>
  );
}

/* ── TOC Drawer ─────────────────────────────────────────── */
function TocDrawer({ open, onClose, toc, onSelect }: {
  open: boolean;
  onClose: () => void;
  toc: NavItem[];
  onSelect: (href: string) => void;
}) {
  const renderItems = (items: NavItem[], depth = 0) =>
    items.map((item) => (
      <Box key={item.id || item.href}>
        <ListItemButton
          onClick={() => { onSelect(item.href); onClose(); }}
          sx={{ pl: 2 + depth * 2 }}
        >
          <ListItemText
            primary={item.label?.trim()}
            primaryTypographyProps={{ fontSize: 14, noWrap: true }}
          />
        </ListItemButton>
        {item.subitems && item.subitems.length > 0 && renderItems(item.subitems, depth + 1)}
      </Box>
    ));

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 280,
          bgcolor: 'rgba(25,25,25,0.95)',
          backdropFilter: 'blur(12px)',
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>目錄</Typography>
      </Box>
      <List dense sx={{ overflow: 'auto', flex: 1 }}>
        {toc.length === 0 ? (
          <Typography sx={{ p: 2, opacity: 0.5 }}>無目錄資料</Typography>
        ) : (
          renderItems(toc)
        )}
      </List>
    </Drawer>
  );
}

/* ── Helper: build epub theme styles ──────────────────────── */
function buildEpubStyles(
  theme: { bg: string; fg: string },
  writingMode: 'horizontal' | 'vertical',
): Record<string, Record<string, string>> {
  const wm = writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb';
  return {
    'html': {
      'writing-mode': `${wm} !important`,
      '-webkit-writing-mode': `${wm} !important`,
    },
    'body': {
      'background-color': `${theme.bg} !important`,
      'color': `${theme.fg} !important`,
      'writing-mode': `${wm} !important`,
      '-webkit-writing-mode': `${wm} !important`,
      '-webkit-user-select': 'none !important',
      'user-select': 'none !important',
    },
  };
}

/* ── Helper: build font/layout CSS to inject via content hook ── */
// Uses :root * (specificity 0,0,1,0) which beats element selectors like
// `li` (0,0,0,1) from the EPUB's own CSS, preventing font-size overrides.
function buildFontCSS(
  theme: { bg: string; fg: string },
  fontSize: number,
  lineHeight: number,
  writingMode: 'horizontal' | 'vertical',
): string {
  const textAlign = writingMode === 'vertical' ? 'start' : 'left';
  const directionRule = writingMode === 'horizontal' ? 'direction: ltr !important;' : '';
  return `
    html, body {
      -webkit-text-size-adjust: 100% !important;
      text-size-adjust: 100% !important;
      ${directionRule}
    }
    :root * {
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
      text-align: ${textAlign} !important;
      color: ${theme.fg} !important;
    }
    :root rt, :root rp {
      font-size: 0.5em !important;
    }
  `;
}

/* ── Main BookReader ────────────────────────────────────── */
export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useSelector((state: RootState) => state.user);
  const settings = useSelector((state: RootState) => state.settings);
  const [book, setBook] = useState<Book | null>(null);
  const [epubData, setEpubData] = useState<ArrayBuffer | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBar, setShowBar] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const locationRef = useRef<string | null>(null);
  const percentageRef = useRef(0);
  const renditionRef = useRef<EpubRendition | null>(null);
  // Tracks the page number at the start of the current chapter (set by 'relocated' event)
  const chapterStartPageRef = useRef(1);

  const goPrevRef = useRef<() => void>(() => {});
  const goNextRef = useRef<() => void>(() => {});
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Debounce guard: prevent double-fire from overlay + outer Box
  const navLock = useRef(false);

  // Pointer tracking for tap/swipe detection
  const pointerDownPos = useRef<{ x: number; y: number; t: number } | null>(null);

  const { save } = useProgressSync(currentUser?.id || '', bookId || '');

  const theme = readerThemes[settings.themeMode];

  // Load book and progress
  useEffect(() => {
    if (!bookId || !currentUser) return;

    const loadData = async () => {
      try {
        const [bookData, progressData] = await Promise.all([
          apiService.getBooks().then(books => books.find(b => b.id === bookId)),
          apiService.getProgress(currentUser.id, bookId),
        ]);

        if (!bookData) {
          navigate('/library');
          return;
        }

        setBook(bookData);
        if (progressData.cfi) {
          setLocation(progressData.cfi);
          locationRef.current = progressData.cfi;
        }
        if (progressData.percentage) {
          setPercentage(progressData.percentage);
          percentageRef.current = progressData.percentage;
        }

        if (bookData.format === 'epub') {
          const res = await fetch(apiService.getBookFileUrl(bookId));
          const buffer = await res.arrayBuffer();
          setEpubData(buffer);
        }
      } catch (err) {
        console.error('Failed to load book:', err);
        navigate('/library');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [bookId, currentUser, navigate]);

  // Auto-hide top bar after 4s
  useEffect(() => {
    if (!showBar) return;
    const timer = setTimeout(() => setShowBar(false), 4000);
    return () => clearTimeout(timer);
  }, [showBar]);

  // Keep font settings ref so content hooks can access current values
  const fontSettingsRef = useRef({ fontSize: settings.fontSize, lineHeight: settings.lineHeight });
  fontSettingsRef.current = { fontSize: settings.fontSize, lineHeight: settings.lineHeight };

  // Apply EPUB theme styles when settings change
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const styles = buildEpubStyles(theme, settings.writingMode);
    rendition.themes.default(styles);

    // Re-inject font CSS into all loaded views
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents = (rendition as any).getContents?.() ?? [];
    const fontCSS = buildFontCSS(theme, settings.fontSize, settings.lineHeight, settings.writingMode);
    for (const c of contents) {
      try {
        let el = c.document?.getElementById('__reader-font-style');
        if (!el) {
          el = c.document.createElement('style');
          el.id = '__reader-font-style';
          c.document.head.appendChild(el);
        }
        el.textContent = fontCSS;
      } catch { /* ignore */ }
    }

    // Force epub.js to re-render with new styles by redisplaying current location
    try {
      const loc = rendition.currentLocation() as { start?: { cfi?: string } } | null;
      const cfi = loc?.start?.cfi;
      if (cfi) {
        rendition.display(cfi);
      }
    } catch { /* ignore on first render */ }
  }, [settings.fontSize, settings.lineHeight, settings.themeMode, settings.writingMode, theme]);

  const handleToggleBar = useCallback(() => {
    setShowBar(prev => !prev);
  }, []);

  // After silent scrolling within a chapter, update the page number display only.
  // Percentage is NOT updated here — it is managed exclusively by the 'relocated'
  // event which uses epub.js CFI-based locations (accurate character-level positions).
  // Estimating percentage from spine-item count gives wrong results because chapters
  // have different lengths (e.g. chapter 5 at 20% CFI but 40% by spine-item count).
  const updatePageAfterScroll = useCallback(() => {
    const r = renditionRef.current;
    if (!r) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mgr = (r as any).manager;
    if (!mgr) return;
    const container = mgr.container as HTMLElement;

    const isVert = settingsRef.current.writingMode === 'vertical';
    // For horizontal: delta = column width (from epub.js layout, or container width as fallback)
    // For vertical: delta = viewport height (one page = one screen height)
    const delta = isVert
      ? container.offsetHeight
      : (mgr.layout?.delta || container.offsetWidth);
    if (delta <= 0) return;
    const pagesScrolled = isVert
      ? Math.round(container.scrollTop / delta)
      : Math.round(container.scrollLeft / delta);

    if (totalPages > 0) {
      const estPage = chapterStartPageRef.current + pagesScrolled;
      setCurrentPage(Math.min(estPage, totalPages));
    }
  }, [totalPages]);

  // Custom prev/next that scrolls the epub.js container directly.
  // epub.js's built-in next()/prev() breaks when the container has
  // direction:rtl (from book metadata) but content is horizontal-tb (LTR).
  // We use mgr.scrollTo(x,y,true) for silent scrolling (suppresses scroll
  // events that would trigger a full re-render chain).
  // mgr.scrollBy() is NOT usable because it multiplies x by -1 for RTL.
  const goPrev = useCallback(() => {
    if (book?.format === 'epub') {
      const r = renditionRef.current;
      if (!r) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgr = (r as any).manager;
      if (!mgr) { r.prev(); return; }
      const container = mgr.container as HTMLElement;
      // For horizontal: delta = column width (epub.js layout, or container width as fallback)
      // For vertical: delta = viewport height (one page = one screen height)
      const isVertPrev = settings.writingMode === 'vertical';
      const delta = isVertPrev
        ? container.offsetHeight
        : (mgr.layout?.delta || container.offsetWidth);

      if (isVertPrev) {
        const top = container.scrollTop;
        if (top > 0) {
          mgr.scrollTo(container.scrollLeft, Math.max(0, top - delta), true);
          updatePageAfterScroll();
        } else {
          r.prev();
        }
      } else {
        const scrollLeft = container.scrollLeft;
        if (scrollLeft > 0) {
          mgr.scrollTo(Math.max(0, scrollLeft - delta), 0, true);
          updatePageAfterScroll();
        } else {
          r.prev();
        }
      }
    } else if (book?.format === 'txt') {
      const el = document.querySelector('[data-txt-container]') as HTMLElement;
      if (!el) return;
      const isVert = settings.writingMode === 'vertical';
      if (isVert) {
        el.scrollBy({ left: el.clientWidth * 0.85, behavior: 'smooth' });
      } else {
        el.scrollBy({ top: -el.clientHeight * 0.85, behavior: 'smooth' });
      }
    }
  }, [book?.format, settings.writingMode, updatePageAfterScroll]);

  const goNext = useCallback(() => {
    if (book?.format === 'epub') {
      const r = renditionRef.current;
      if (!r) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgr = (r as any).manager;
      if (!mgr) { r.next(); return; }
      const container = mgr.container as HTMLElement;
      const isVertNext = settings.writingMode === 'vertical';
      const delta = isVertNext
        ? container.offsetHeight
        : (mgr.layout?.delta || container.offsetWidth);

      if (isVertNext) {
        const top = container.scrollTop;
        const maxTop = container.scrollHeight - container.offsetHeight;
        if (top < maxTop - 2) {
          mgr.scrollTo(container.scrollLeft, Math.min(maxTop, top + delta), true);
          updatePageAfterScroll();
        } else {
          r.next();
        }
      } else {
        const scrollLeft = container.scrollLeft;
        const maxScroll = container.scrollWidth - container.offsetWidth;
        const debugInfo = {
          scrollLeft,
          maxScroll,
          scrollW: container.scrollWidth,
          offsetW: container.offsetWidth,
          delta,
          dir: mgr.settings?.direction,
          isPag: mgr.isPaginated,
          axis: mgr.settings?.axis,
          childW: (container.firstElementChild as HTMLElement)?.offsetWidth,
          flexShrink: (container.firstElementChild as HTMLElement)?.style.flexShrink || 'default',
          willJump: !(scrollLeft < maxScroll - 2),
        };
        // Show debug overlay on screen for mobile testing
        let overlay = document.getElementById('__debug_overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = '__debug_overlay';
          overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:rgba(0,0,0,0.85);color:#0f0;font:12px monospace;padding:8px;white-space:pre-wrap;pointer-events:none;';
          document.body.appendChild(overlay);
        }
        overlay.textContent = JSON.stringify(debugInfo, null, 1);
        if (scrollLeft < maxScroll - 2) {
          mgr.scrollTo(Math.min(maxScroll, scrollLeft + delta), 0, true);
          updatePageAfterScroll();
        } else {
          r.next();
        }
      }
    } else if (book?.format === 'txt') {
      const el = document.querySelector('[data-txt-container]') as HTMLElement;
      if (!el) return;
      const isVert = settings.writingMode === 'vertical';
      if (isVert) {
        el.scrollBy({ left: -el.clientWidth * 0.85, behavior: 'smooth' });
      } else {
        el.scrollBy({ top: el.clientHeight * 0.85, behavior: 'smooth' });
      }
    }
  }, [book?.format, settings.writingMode, updatePageAfterScroll]);

  // Keep refs in sync for keyboard/iframe callbacks
  useEffect(() => { goPrevRef.current = goPrev; }, [goPrev]);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  // Keyboard: Arrow keys, PageUp/Down, Space, Volume keys
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (settingsOpen || tocOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          goPrev();
          return;
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          goNext();
          return;
      }

      // Volume keys (Android/Boox) — code 24=VolumeUp, 25=VolumeDown
      if (settings.volumeKeyNav) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kc = (e as any).keyCode ?? 0;
        if (kc === 24) {
          e.preventDefault();
          goPrev();
        } else if (kc === 25) {
          e.preventDefault();
          goNext();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext, settingsOpen, tocOpen, settings.volumeKeyNav]);

  // --- EPUB handlers ---
  const handleEpubLocationChanged = useCallback((newCfi: string) => {
    setLocation(newCfi);
    locationRef.current = newCfi;
    save(newCfi, percentageRef.current);
  }, [save]);

  const handleTocSelect = useCallback((href: string) => {
    renditionRef.current?.display(href);
  }, []);

  // --- PDF handlers ---
  const handlePdfProgressChange = useCallback((page: number, pct: number) => {
    setPercentage(pct);
    percentageRef.current = pct;
    save(String(page), pct);
  }, [save]);

  // --- TXT handlers ---
  const handleTxtProgressChange = useCallback((pct: number) => {
    setPercentage(pct);
    percentageRef.current = pct;
    save(null, pct);
  }, [save]);

  // --- Tap/swipe handler (shared by overlay and outer box) ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDownPos.current || settingsOpen || tocOpen) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    const dt = Date.now() - pointerDownPos.current.t;
    const dist = Math.sqrt(dx * dx + dy * dy);
    pointerDownPos.current = null;

    // Swipe detection
    if (dist > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
      if (dx > 0) goPrev(); else goNext();
      return;
    }

    // Tap detection
    if (dist > 15) return;
    if (navLock.current) return;
    navLock.current = true;
    setTimeout(() => { navLock.current = false; }, 300);

    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    const s = settingsRef.current;
    const action = getTapAction(x, y, s.tapMode, s.handPreference, s.invertPageTurn);
    switch (action) {
      case 'prev': goPrev(); break;
      case 'next': goNext(); break;
      case 'toggle': handleToggleBar(); break;
    }
  }, [goPrev, goNext, settingsOpen, tocOpen, handleToggleBar]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!book || !bookId) {
    return null;
  }

  const fileUrl = apiService.getBookFileUrl(bookId);

  const renderReader = () => {
    switch (book.format) {
      case 'pdf':
        return (
          <PdfReader
            url={fileUrl}
            initialPage={location ? parseInt(location, 10) || 1 : 1}
            onProgressChange={handlePdfProgressChange}
            onToggleBar={handleToggleBar}
          />
        );
      case 'txt':
        return (
          <TxtReader
            url={fileUrl}
            initialPercentage={percentage}
            onProgressChange={handleTxtProgressChange}
            onToggleBar={handleToggleBar}
          />
        );
      case 'epub':
      default:
        if (!epubData) return null;
        return (
          <Box sx={{
            flex: 1, height: '100%', position: 'relative',
            overflow: 'hidden',
          }}>
            <ReactReader
              url={epubData}
              location={location}
              locationChanged={handleEpubLocationChanged}
              showToc={false}
              tocChanged={(newToc) => setToc(newToc)}
              handleKeyPress={() => {}}
              epubOptions={{
                flow: 'paginated',
                spread: 'none',
                gap: 40,
              } as Record<string, unknown>}
              readerStyles={{
                ...ReactReaderStyle,
                readerArea: {
                  ...ReactReaderStyle.readerArea,
                  backgroundColor: theme.bg,
                },
                reader: {
                  ...ReactReaderStyle.reader,
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                },
                titleArea: { ...ReactReaderStyle.titleArea, display: 'none' },
                prev: { ...ReactReaderStyle.prev, display: 'none', visibility: 'hidden' as const, width: 0, height: 0, overflow: 'hidden' },
                next: { ...ReactReaderStyle.next, display: 'none', visibility: 'hidden' as const, width: 0, height: 0, overflow: 'hidden' },
                arrow: { ...ReactReaderStyle.arrow, display: 'none' },
              }}
              getRendition={(rendition) => {
                renditionRef.current = rendition as unknown as EpubRendition;
                const r = rendition as unknown as EpubRendition;

                // Apply initial theme (writing-mode, bg/fg colours)
                rendition.themes.default(buildEpubStyles(theme, settings.writingMode));

                // Inject styles into each chapter's iframe
                // NOTE: Do NOT set overflow:hidden on body here — epub.js reads
                // body.scrollWidth to calculate column count. overflow:hidden
                // clamps scrollWidth to viewport width, making every chapter
                // appear as a single page and causing goNext() to jump chapters.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                rendition.hooks.content.register((contents: any) => {
                  const doc = contents.document;

                  // 1) Scrollbar hiding (no overflow:hidden on body!)
                  const scrollStyle = doc.createElement('style');
                  scrollStyle.textContent = `
                    html, body {
                      scrollbar-width: none !important;
                      -ms-overflow-style: none !important;
                    }
                    html::-webkit-scrollbar, body::-webkit-scrollbar {
                      display: none !important;
                      width: 0 !important;
                      height: 0 !important;
                    }
                    * {
                      -webkit-touch-callout: none !important;
                      -webkit-user-select: none !important;
                      user-select: none !important;
                    }
                  `;
                  doc.head.appendChild(scrollStyle);

                  // 2) Font / layout styles with high-specificity :root * selector
                  //    so they beat the EPUB's own element selectors (li, p, etc.)
                  const { fontSize, lineHeight } = fontSettingsRef.current;
                  const fontStyle = doc.createElement('style');
                  fontStyle.id = '__reader-font-style';
                  fontStyle.textContent = buildFontCSS(
                    theme, fontSize, lineHeight, settingsRef.current.writingMode,
                  );
                  doc.head.appendChild(fontStyle);
                });

                // epub.js sizes the iframe BEFORE theme styles (font-size etc.)
                // are injected via content hooks. After rendering completes, we measure
                // content scrollWidth and resize the iframe so our custom next/prev can
                // scroll page-by-page.
                // Also fix container direction: epub.js may set direction:rtl from book
                // metadata, but when we force horizontal-tb the content is LTR.
                //
                // iOS fix: epub.js sets iframe.scrolling="no" which prevents iOS Safari
                // from respecting CSS width on the iframe element. We override it to
                // "auto" so iOS honours our iframe.style.width changes. (epub.js source
                // comment: "Might need to be removed: breaks ios width calculations")
                //
                // We use window.setTimeout(fn, 0) instead of the iframe's own RAF
                // because the iframe is still visibility:hidden when "rendered" fires
                // (views.show() runs later in the promise chain). On iOS, RAF callbacks
                // inside hidden iframes may be deferred indefinitely.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                rendition.on('rendered', (_section: any, view: any) => {
                  const iframe = view?.iframe;
                  if (!iframe) return;

                  // Remove scrolling="no" early so iOS respects subsequent CSS width changes
                  iframe.scrolling = 'auto';

                  // setTimeout(0) fires after all pending microtasks (including
                  // views.show() which makes the iframe visible), ensuring that iOS
                  // has processed the iframe visibility and layout before we measure.
                  window.setTimeout(() => {
                    const body = view?.contents?.document?.body;
                    const iframeEl = view?.iframe;
                    const element = view?.element;
                    if (!body || !iframeEl) return;

                    const container = iframeEl.parentElement?.parentElement;

                    // Fix container direction for horizontal mode
                    if (container && settingsRef.current.writingMode !== 'vertical') {
                      container.style.direction = 'ltr';
                    }

                    // Keep scrollbars hidden (scrolling="auto" may show them)
                    iframeEl.style.overflow = 'hidden';

                    const scrollW = body.scrollWidth;
                    const delta = view?.layout?.delta || iframeEl.offsetWidth;
                    if (delta <= 0 || scrollW <= delta) return;

                    // Align iframe width to delta so scrolling lands on column boundaries
                    const newW = Math.ceil(scrollW / delta) * delta;
                    iframeEl.style.width = newW + 'px';
                    if (element) {
                      element.style.width = newW + 'px';
                      // Prevent flex container from shrinking element back to container width.
                      // epub.js sets display:flex on the epub-container; without minWidth the
                      // element collapses → scrollWidth===offsetWidth → maxScroll=0 → chapter jump.
                      element.style.minWidth = newW + 'px';
                    }
                    // Sync epub.js manager direction to ltr so scrollBy() doesn't negate x
                    // for books whose epub metadata specifies direction:rtl.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const mgrRef = (renditionRef.current as any)?.manager;
                    if (mgrRef?.settings) mgrRef.settings.direction = 'ltr';
                    // Update epub.js internal tracking
                    if (view._width !== undefined) view._width = newW;

                    // DEBUG: show rendered info on screen
                    const rInfo = {
                      bodyScrollW: scrollW,
                      delta,
                      newW,
                      elemOffsetW: element?.offsetWidth,
                      ctnrScrollW: container?.scrollWidth,
                      ctnrOffsetW: container?.offsetWidth,
                      flexShrink: element ? getComputedStyle(element).flexShrink : null,
                    };
                    let ro = document.getElementById('__debug_rendered');
                    if (!ro) {
                      ro = document.createElement('div');
                      ro.id = '__debug_rendered';
                      ro.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:rgba(0,0,80,0.85);color:#ff0;font:11px monospace;padding:6px;white-space:pre-wrap;pointer-events:none;';
                      document.body.appendChild(ro);
                    }
                    ro.textContent = '[rendered] ' + JSON.stringify(rInfo, null, 1);

                    // Reset scroll position to start
                    if (container) container.scrollLeft = 0;
                  }, 0);
                });

                // Generate location map for page numbers
                r.book.locations.generate(1024).then(() => {
                  setTotalPages(r.book.locations.total);
                }).catch(() => {});

                rendition.on('relocated', (loc: { start: { percentage: number; cfi: string } }) => {
                  const pct = Math.round(loc.start.percentage * 10000) / 100;
                  setPercentage(pct);
                  percentageRef.current = pct;
                  save(locationRef.current, pct);

                  try {
                    const page = r.book.locations.locationFromCfi(loc.start.cfi);
                    if (page >= 0) {
                      setCurrentPage(page + 1);
                      chapterStartPageRef.current = page + 1;
                    }
                  } catch { /* locations not ready */ }
                });

                // Simplified → Traditional Chinese conversion
                if (settings.convertToTraditional) {
                  import('opencc-js').then((OpenCC) => {
                    const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
                    rendition.hooks.content.register((contents: { document: Document }) => {
                      const doc = contents.document;
                      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
                      let node: Text | null;
                      while ((node = walker.nextNode() as Text | null)) {
                        const converted = converter(node.textContent || '');
                        if (converted !== node.textContent) {
                          node.textContent = converted;
                        }
                      }
                    });
                  });
                }
              }}
            />
            {/* Transparent touch overlay — captures all taps/swipes above iframe */}
            <Box
              sx={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 3,
                // 'none' required on iOS: 'pan-x' suppresses tap events on Safari
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
              }}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
            />
          </Box>
        );
    }
  };

  return (
    <Box sx={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: theme.bg,
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'none',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Top Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          transition: 'transform 0.3s',
          transform: showBar ? 'translateY(0)' : 'translateY(-100%)',
          bgcolor: theme.barBg,
          backdropFilter: 'blur(8px)',
          color: theme.fg,
        }}
      >
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/library')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="body1" sx={{ ml: 1, flex: 1, fontWeight: 500 }} noWrap>
            {book.title}
          </Typography>
          <Typography variant="body2" sx={{ mr: 1, opacity: 0.7 }}>
            {totalPages > 0 ? `${currentPage}/${totalPages}` : ''}{' '}
            {percentage.toFixed(2)}%
          </Typography>
          {book.format === 'epub' && (
            <IconButton color="inherit" onClick={() => { setTocOpen(true); setShowBar(false); }}>
              <MenuBookIcon />
            </IconButton>
          )}
          <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Reader */}
      <Box
        sx={{ flex: 1, position: 'relative' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {renderReader()}

        {settings.showTapZones && (
          <TapZoneOverlay
            tapMode={settings.tapMode}
            handPreference={settings.handPreference}
            invert={settings.invertPageTurn}
          />
        )}
      </Box>

      {/* TOC Drawer */}
      <TocDrawer
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        toc={toc}
        onSelect={handleTocSelect}
      />

      {/* Settings Drawer */}
      <ReaderSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
}
