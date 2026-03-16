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
// Note: writing-mode is NOT set here because rendition.themes.default() uses an object
// API whose CSS serialization has a known TODO in epubjs/src/themes.js (style elements
// end up empty). Writing-mode is instead injected directly in the content hook so
// epub.js reads the correct axis via writingMode() after hooks run.
function buildEpubStyles(
  theme: { bg: string; fg: string },
): Record<string, Record<string, string>> {
  return {
    'body': {
      'background-color': `${theme.bg} !important`,
      'color': `${theme.fg} !important`,
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
  // Increments on every 'rendered' event so stale async timers can self-cancel
  const renderGenRef = useRef(0);
  // Scroll fraction to restore after initial render (from saved progress)
  const scrollRestoreRef = useRef<number | null>(null);

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
          // Parse out scroll fraction if present (format: "epubcfi(...)@@0.3500")
          const rawCfi = progressData.cfi;
          const scrollMatch = rawCfi.match(/@@([\d.]+)$/);
          const pureCfi = rawCfi.replace(/@@[\d.]+$/, '');

          setLocation(pureCfi);
          locationRef.current = rawCfi; // Keep full string with scroll info
          if (scrollMatch) {
            // Store scroll fraction to apply after rendition renders
            scrollRestoreRef.current = parseFloat(scrollMatch[1]);
          }
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

    const styles = buildEpubStyles(theme);
    rendition.themes.default(styles);

    // Re-inject font CSS and writing-mode into all loaded views
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents = (rendition as any).getContents?.() ?? [];
    const fontCSS = buildFontCSS(theme, settings.fontSize, settings.lineHeight, settings.writingMode);
    const wm = settings.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb';
    for (const c of contents) {
      try {
        let el = c.document?.getElementById('__reader-font-style');
        if (!el) {
          el = c.document.createElement('style');
          el.id = '__reader-font-style';
          c.document.head.appendChild(el);
        }
        el.textContent = fontCSS;
        // Also update writing-mode element
        let wmEl = c.document?.getElementById('__reader-writing-mode');
        if (!wmEl) {
          wmEl = c.document.createElement('style');
          wmEl.id = '__reader-writing-mode';
          c.document.head.appendChild(wmEl);
        }
        wmEl.textContent = `html, body { writing-mode: ${wm} !important; -webkit-writing-mode: ${wm} !important; }`;
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

  // After silent scrolling within a chapter, update the page number display
  // and persist the current CFI so progress is saved at the exact scroll position.
  const updatePageAfterScroll = useCallback(() => {
    const r = renditionRef.current;
    if (!r) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mgr = (r as any).manager;
    if (!mgr) return;

    const isVert = settingsRef.current.writingMode === 'vertical';
    let pagesScrolled = 0;
    let delta = 1;

    if (isVert) {
      const container = mgr.container as HTMLElement;
      delta = container.offsetHeight;
      if (delta <= 0) return;
      pagesScrolled = Math.round(container.scrollTop / delta);
    } else {
      // Horizontal: epub.js expands the iframe to full content width and slides it
      // inside the epub-container (overflow:hidden). Navigation scrolls container.scrollLeft.
      const container = mgr.container as HTMLElement;
      delta = container.offsetWidth;
      if (delta <= 0) return;
      pagesScrolled = Math.round(container.scrollLeft / delta);
    }

    if (totalPages > 0) {
      const estPage = chapterStartPageRef.current + pagesScrolled;
      setCurrentPage(Math.min(estPage, totalPages));
    }

    // Save the current scroll fraction alongside the CFI.
    // epub.js's currentLocation() is unreliable after our custom iframe expansion
    // (always returns the same CFI regardless of scroll position), so we encode
    // the scroll fraction in the cfi field as "epubcfi(...)@@0.3500".
    // On restore, we parse out the fraction and apply it after display().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mgr2 = (r as any).manager;
    if (mgr2) {
      const c = mgr2.container as HTMLElement;
      const isVert2 = settingsRef.current.writingMode === 'vertical';
      const scrollPos = isVert2 ? c.scrollTop : c.scrollLeft;
      const scrollMax = isVert2
        ? c.scrollHeight - c.offsetHeight
        : c.scrollWidth - c.offsetWidth;
      const scrollFraction = scrollMax > 0 ? scrollPos / scrollMax : 0;
      const baseCfi = (locationRef.current || '').replace(/@@[\d.]+$/, '');
      const cfiWithScroll = `${baseCfi}@@${scrollFraction.toFixed(4)}`;
      locationRef.current = cfiWithScroll;
      save(cfiWithScroll, percentageRef.current);
    }
  }, [totalPages, save]);

  // Horizontal mode: navigate by scrolling the iframe's contentWindow (not the outer
  // container). epub.js lays content into horizontal columns inside the iframe; we scroll
  // the iframe viewport one column-width at a time.
  // Vertical mode: navigate by scrolling the epub-container's scrollTop.
  const goPrev = useCallback(() => {
    if (book?.format === 'epub') {
      const r = renditionRef.current;
      if (!r) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgr = (r as any).manager;
      if (!mgr) { r.prev(); return; }

      if (settings.writingMode === 'vertical') {
        const container = mgr.container as HTMLElement;
        const delta = container.offsetHeight;
        const top = container.scrollTop;
        if (top > 0) {
          mgr.scrollTo(container.scrollLeft, Math.max(0, top - delta), true);
          updatePageAfterScroll();
        } else {
          r.prev();
        }
      } else {
        // Horizontal: epub.js expands the iframe wider than the container and scrolls
        // container.scrollLeft (not iframe.contentWindow.scrollX) to navigate pages.
        const container = mgr.container as HTMLElement;
        const delta = container.offsetWidth;
        const scrollLeft = container.scrollLeft;
        if (scrollLeft > 0) {
          container.scrollLeft = Math.max(0, scrollLeft - delta);
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

      if (settings.writingMode === 'vertical') {
        const container = mgr.container as HTMLElement;
        const delta = container.offsetHeight;
        const top = container.scrollTop;
        const maxTop = container.scrollHeight - container.offsetHeight;
        if (top < maxTop - 2) {
          mgr.scrollTo(container.scrollLeft, Math.min(maxTop, top + delta), true);
          updatePageAfterScroll();
        } else {
          r.next();
        }
      } else {
        // Horizontal: epub.js expands the iframe wider than the container and scrolls
        // container.scrollLeft (not iframe.contentWindow.scrollX) to navigate pages.
        const container = mgr.container as HTMLElement;
        const delta = container.offsetWidth;
        const scrollLeft = container.scrollLeft;
        const maxScroll = container.scrollWidth - container.offsetWidth;

        if (scrollLeft < maxScroll - 2) {
          container.scrollLeft += delta;
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
    // On chapter change, scroll is at 0 → fraction is 0
    locationRef.current = `${newCfi}@@0.0000`;
    save(`${newCfi}@@0.0000`, percentageRef.current);
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
                gap: 0,
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
                rendition.themes.default(buildEpubStyles(theme));

                // Inject styles into each chapter's iframe
                // NOTE: Do NOT set overflow:hidden on body here — epub.js reads
                // body.scrollWidth to calculate column count. overflow:hidden
                // clamps scrollWidth to viewport width, making every chapter
                // appear as a single page and causing goNext() to jump chapters.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                rendition.hooks.content.register((contents: any) => {
                  const doc = contents.document;

                  // 0) Inject writing-mode BEFORE epub.js reads writingMode() so it
                  //    detects the correct axis. epub.js flow: content hooks → writingMode()
                  //    → setAxis() → rendered. Without this, a book with writing-mode:vertical-rl
                  //    in its own CSS causes epub.js to set axis="vertical" regardless of our theme.
                  const wm = settingsRef.current.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb';
                  const wmStyle = doc.createElement('style');
                  wmStyle.id = '__reader-writing-mode';
                  wmStyle.textContent = `html, body { writing-mode: ${wm} !important; -webkit-writing-mode: ${wm} !important; }`;
                  doc.head.appendChild(wmStyle);
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

                // On each rendered chapter, apply iOS and direction fixes.
                //
                // iOS fix: epub.js sets iframe.scrolling="no" which prevents iOS Safari
                // from applying CSS changes to the iframe element. We override it to "auto".
                // (epub.js source comment: "Might need to be removed: breaks ios width
                // calculations")
                //
                // We use window.setTimeout(fn, 0) because the iframe is still
                // visibility:hidden when "rendered" fires (views.show() runs after).
                // On iOS, requestAnimationFrame inside hidden iframes may be deferred.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                rendition.on('rendered', (_section: any, view: any) => {
                  const iframe = view?.iframe;
                  if (!iframe) return;

                  // iOS fix: epub.js sets scrolling="no" which prevents scrollTo() on iOS.
                  iframe.scrolling = 'auto';

                  // Increment generation so any stale 60ms timer from the previous chapter
                  // can detect it is no longer valid and self-cancel. Without this, a timer
                  // queued for chapter N fires after chapter N+1 starts loading, expanding
                  // the new chapter's iframe to the wrong width and causing a black screen.
                  renderGenRef.current += 1;
                  const capturedGen = renderGenRef.current;

                  const isHorizontal = settingsRef.current.writingMode !== 'vertical';

                  if (isHorizontal) {
                    // Root-cause fix for iOS/WebKit horizontal paging:
                    //
                    // Books that declare `writing-mode: vertical-rl !important` in their
                    // own CSS (e.g. CJK novels) override our content-hook injection because
                    // the book's stylesheets finish loading AFTER the hook fires. epub.js
                    // then calls writingMode() during layout.format(), sees "vertical-rl",
                    // and sets axis="vertical". In vertical mode:
                    //   • epub-container display = "block" (not "flex")
                    //   • CSS columns stack vertically  →  body.scrollWidth = 393px (1 page)
                    //   • iframe.width stays 393px (not expanded to all pages)
                    //   • goNext: scrollWidth - delta = 0  →  always calls r.next()  →  chapter jump
                    //
                    // Fix: re-inject our style here (last in the cascade, so it wins), then
                    // directly set the container to flex (bypassing epub.js's updateAxis which
                    // can trigger internal resize/re-render cycles causing blank screens).
                    const win = iframe.contentWindow;
                    const doc = win?.document;
                    const mgr = (renditionRef.current as any)?.manager;
                    // Viewport dimensions: use epub-container's clipped size
                    const epubContainer = mgr?.container as HTMLElement | null;
                    const pageW = epubContainer?.offsetWidth || iframe.offsetWidth || 390;
                    const pageH = epubContainer?.offsetHeight || 659;

                    if (doc) {
                      // Re-inject LAST in cascade so it beats the book's !important rule.
                      // Also force column-width = viewport WIDTH (epub.js may have set
                      // column-width = page HEIGHT for vertical-rl books).
                      // Remove any existing injected style and re-append at END of head.
                      // This is required because the book's own CSS may have loaded AFTER
                      // the content-hook injection, placing its !important writing-mode rule
                      // later in the cascade. By moving our element last, we win cascade order.
                      let wmStyle = doc.getElementById('__reader-writing-mode') as HTMLStyleElement | null;
                      if (wmStyle) wmStyle.remove();
                      wmStyle = doc.createElement('style') as HTMLStyleElement;
                      wmStyle.id = '__reader-writing-mode';
                      wmStyle.textContent = `html, body { writing-mode: horizontal-tb !important; -webkit-writing-mode: horizontal-tb !important; } body { column-width: ${pageW}px !important; -webkit-column-width: ${pageW}px !important; column-gap: 0px !important; padding: 0px !important; margin: 0px !important; }`;
                      doc.head.appendChild(wmStyle);

                      // Critical: epub.js may have expanded the iframe VERTICALLY (height=17134px)
                      // in vertical mode. With such a tall iframe, all content fits in ONE
                      // horizontal column → textWidth() = 393px (no overflow). We must reset
                      // iframe height to viewport height BEFORE measuring, so content spills
                      // into multiple horizontal columns and textWidth = N×pageWidth.
                      if (parseInt(iframe.style.height || '0') > pageH * 1.5) {
                        iframe.style.height = pageH + 'px';
                      }
                    }

                    // Force horizontal layout by directly setting container display.
                    // We avoid epub.js's updateAxis() because it calls resize() internally,
                    // which can trigger a re-render cycle that produces a blank screen.
                    // We also update mgr.settings.axis so epub.js internal state stays consistent.
                    if (mgr) {
                      if (mgr.settings) mgr.settings.axis = 'horizontal';
                      if (epubContainer) {
                        epubContainer.style.display = 'flex';
                        epubContainer.style.flexDirection = 'row';
                      }
                    }

                    // WebKit defers multi-column CSS layout computation: getBoundingClientRect()
                    // immediately after CSS injection returns 353px (one page), but ~50ms later
                    // the multi-column layout settles and returns the correct N×pageWidth value.
                    // We defer expansion to after this settling delay.
                    //
                    // We check capturedGen === renderGenRef.current to cancel if a newer
                    // chapter has already rendered (prevents stale timer corrupting new chapter).
                    const capturedIframe = iframe;
                    const capturedPageW = pageW;
                    window.setTimeout(() => {
                      // Cancel if a new chapter has been rendered since we were queued
                      if (capturedGen !== renderGenRef.current) return;
                      const currentDoc = capturedIframe.contentWindow?.document;
                      if (!currentDoc || !capturedIframe.isConnected) return;

                      // Force layout properties via inline !important to beat any
                      // epub.js inline-style overrides (epub.js may call
                      // body.style.setProperty('padding', ..., 'important') in format()).
                      // Inline !important wins over all author stylesheets.
                      // We must set these BEFORE measuring textWidth so getBoundingClientRect
                      // reflects the correct column layout (no padding shrinking content area).
                      const body = currentDoc.body;
                      body.style.setProperty('padding', '0px', 'important');
                      body.style.setProperty('margin', '0px', 'important');
                      body.style.setProperty('column-width', capturedPageW + 'px', 'important');
                      body.style.setProperty('-webkit-column-width', capturedPageW + 'px', 'important');
                      body.style.setProperty('column-gap', '0px', 'important');
                      body.style.setProperty('-webkit-column-gap', '0px', 'important');

                      // getBoundingClientRect forces synchronous reflow so it
                      // returns the post-injection layout dimensions.
                      const range = currentDoc.createRange();
                      range.selectNodeContents(body);
                      const textW = range.getBoundingClientRect().width;
                      if (textW > capturedPageW * 1.5) {
                        const expandedW = Math.ceil(textW / capturedPageW) * capturedPageW;
                        const epubViewEl = capturedIframe.parentElement as HTMLElement | null;
                        if (epubViewEl) {
                          epubViewEl.style.width = expandedW + 'px';
                          epubViewEl.style.flexShrink = '0';
                        }
                        capturedIframe.style.width = expandedW + 'px';
                      }

                      // Restore scroll position from saved progress (if any).
                      // Must happen AFTER expansion so scrollWidth is correct.
                      if (scrollRestoreRef.current !== null) {
                        const frac = scrollRestoreRef.current;
                        scrollRestoreRef.current = null; // Only restore once
                        const mgr4 = (renditionRef.current as any)?.manager;
                        const ec = mgr4?.container as HTMLElement | null;
                        if (ec) {
                          const maxS = ec.scrollWidth - ec.offsetWidth;
                          ec.scrollLeft = Math.round(frac * maxS);
  
                        }
                      }
                    }, 60);
                  }

                  window.setTimeout(() => {
                    const iframeEl = view?.iframe;
                    if (!iframeEl) return;

                    if (settingsRef.current.writingMode !== 'vertical') {
                      // Fix container direction so epub.js RTL metadata doesn't interfere.
                      const domContainer = iframeEl.parentElement?.parentElement;
                      if (domContainer) domContainer.style.direction = 'ltr';

                      // Do NOT reset scrollLeft here — epub.js's display(cfi) may have
                      // already positioned the container to restore a saved reading position.
                      // Resetting to 0 would destroy that positioning.
                    }
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
                  // Save CFI with scroll fraction so progress restore works.
                  // relocated fires both on chapter jumps (scrollLeft=0) and on
                  // scroll events within a chapter. We always include the current
                  // scroll fraction to preserve the exact reading position.
                  const mgr5 = (renditionRef.current as any)?.manager;
                  const rc = mgr5?.container as HTMLElement | null;
                  let cfiToSave = loc.start.cfi;
                  if (rc) {
                    const isV = settingsRef.current.writingMode === 'vertical';
                    const sp = isV ? rc.scrollTop : rc.scrollLeft;
                    const sm = isV
                      ? rc.scrollHeight - rc.offsetHeight
                      : rc.scrollWidth - rc.offsetWidth;
                    const sf = sm > 0 ? sp / sm : 0;
                    cfiToSave = `${loc.start.cfi}@@${sf.toFixed(4)}`;
                  }
                  locationRef.current = cfiToSave;
                  save(cfiToSave, pct);

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
