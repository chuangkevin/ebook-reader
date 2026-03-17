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
  // True while the 60ms expansion timer is in-flight (horizontal mode).
  // goNext/goPrev must defer r.next()/r.prev() until expansion completes,
  // otherwise maxScroll=0 causes the first tap to jump a whole chapter.
  const isExpandingRef = useRef(false);

  const goPrevRef = useRef<() => void>(() => {});
  const goNextRef = useRef<() => void>(() => {});
  const updatePageAfterScrollRef = useRef<() => void>(() => {});
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Debounce guard: prevent double-fire from overlay + outer Box
  const navLock = useRef(false);
  // Tracks whether the last chapter jump was backward (r.prev()), so rendered
  // handler can scroll to the last page instead of the first.
  const prevJumpRef = useRef(false);

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

    // After mode switch, fix container/iframe layout for the target mode.
    // Use 100ms delay to ensure display() and rendered handler have completed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mgr = (rendition as any).manager;
    if (mgr) {
      window.setTimeout(() => {
        const container = mgr.container as HTMLElement;
        if (!container) return;
        const epubView = container.querySelector('.epub-view') as HTMLElement | null;
        const iframe = epubView?.querySelector('iframe') as HTMLIFrameElement | null;
        if (!iframe?.contentWindow?.document) return;

        if (settings.writingMode === 'vertical') {
          // Vertical: expand iframe height to fit content, reset horizontal expansion
          const textH = iframe.contentWindow.document.documentElement.scrollHeight;
          const pageH = container.offsetHeight;
          const pageW = container.offsetWidth;

          if (textH > pageH * 1.5) {
            const expandedH = Math.ceil(textH / pageH) * pageH;
            if (epubView) {
              epubView.style.width = pageW + 'px';
              epubView.style.height = expandedH + 'px';
            }
            iframe.style.width = pageW + 'px';
            iframe.style.height = expandedH + 'px';
          }
          container.style.display = 'block';
          container.style.overflowY = 'hidden';
          container.scrollLeft = 0;
        } else {
          // Horizontal: reset vertical expansion and re-expand horizontally
          container.style.display = 'flex';
          container.style.flexDirection = 'row';
          container.style.overflowY = '';
          container.scrollTop = 0;

          const pageW = container.offsetWidth;
          const pageH = container.offsetHeight;
          const doc = iframe.contentWindow.document;

          // Reset iframe to viewport dimensions first
          iframe.style.height = pageH + 'px';
          if (epubView) epubView.style.height = pageH + 'px';

          // Force column layout
          const body = doc.body;
          body.style.setProperty('padding', '0px', 'important');
          body.style.setProperty('margin', '0px', 'important');
          body.style.setProperty('column-width', pageW + 'px', 'important');
          body.style.setProperty('-webkit-column-width', pageW + 'px', 'important');
          body.style.setProperty('column-gap', '0px', 'important');
          body.style.setProperty('-webkit-column-gap', '0px', 'important');

          // Measure and expand horizontally
          const range = doc.createRange();
          range.selectNodeContents(body);
          const textW = range.getBoundingClientRect().width;
          if (textW > pageW * 1.5) {
            const expandedW = Math.ceil(textW / pageW) * pageW;
            if (epubView) {
              epubView.style.width = expandedW + 'px';
              epubView.style.flexShrink = '0';
            }
            iframe.style.width = expandedW + 'px';
          }
        }
      }, 100);
    }
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
      const clampedPage = Math.min(estPage, totalPages);
      setCurrentPage(clampedPage);
      // Estimate percentage from page position
      const estPct = Math.round((clampedPage / totalPages) * 10000) / 100;
      setPercentage(estPct);
      percentageRef.current = estPct;
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
          prevJumpRef.current = true;
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
        } else if (isExpandingRef.current || renderGenRef.current === 0) {
          // Not ready: expansion in-flight or book hasn't rendered yet.
          // Defer to avoid r.prev() jumping to previous chapter prematurely.
          window.setTimeout(() => goPrevRef.current(), 150);
        } else {
          prevJumpRef.current = true;
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
          prevJumpRef.current = false;
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
        } else if (isExpandingRef.current || renderGenRef.current === 0) {
          // Two cases where maxScroll is unreliable:
          // 1. isExpandingRef: 60ms expansion timer is in-flight after rendered.
          // 2. renderGenRef===0: epub hasn't fired 'rendered' yet (still loading).
          // In either case, defer so we don't misfire r.next() and jump chapters.
          window.setTimeout(() => goNextRef.current(), 150);
        } else {
          prevJumpRef.current = false;
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
  useEffect(() => { updatePageAfterScrollRef.current = updatePageAfterScroll; }, [updatePageAfterScroll]);

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
                  // For vertical mode, add padding via stylesheet rule (author !important beats
                  // epub.js non-important inline style, so this reliably adds breathing room).
                  const paddingRule = settingsRef.current.writingMode === 'vertical'
                    ? ' body { padding: 0 32px !important; margin: 0 !important; }'
                    : '';
                  wmStyle.textContent = `html, body { writing-mode: ${wm} !important; -webkit-writing-mode: ${wm} !important; }${paddingRule}`;
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

                  // 3) Forward keydown events from iframe to main window so keyboard
                  //    navigation works even when the iframe has focus (e.g. after
                  //    mode switch re-renders the iframe, or after tap inside content).
                  doc.addEventListener('keydown', (e: KeyboardEvent) => {
                    window.dispatchEvent(new KeyboardEvent('keydown', {
                      key: e.key, code: e.code,
                      keyCode: e.keyCode, which: e.which,
                      ctrlKey: e.ctrlKey, shiftKey: e.shiftKey,
                      altKey: e.altKey, metaKey: e.metaKey,
                      bubbles: true,
                    }));
                    // Prevent default inside iframe to avoid double-scroll
                    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown',' '].includes(e.key)) {
                      e.preventDefault();
                    }
                  });
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
                  // Reset expansion flag so any pending deferred nav from a previous chapter
                  // doesn't mistakenly fire during this new chapter's expansion window.
                  isExpandingRef.current = false;

                  const isHorizontal = settingsRef.current.writingMode !== 'vertical';

                  if (isHorizontal) {
                    // Signal that the 60ms expansion timer is in-flight.
                    // goNext/goPrev will defer r.next()/r.prev() until this is cleared.
                    isExpandingRef.current = true;
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
                      // PADDING_LR: horizontal padding added to each side of body.
                      // column-width is reduced accordingly so each column fills
                      // exactly (pageW - 2*PADDING_LR) of the visual reading area.
                      const PADDING_LR = 16;
                      wmStyle.textContent = `html, body { writing-mode: horizontal-tb !important; -webkit-writing-mode: horizontal-tb !important; } body { column-width: ${pageW - 2 * PADDING_LR}px !important; -webkit-column-width: ${pageW - 2 * PADDING_LR}px !important; column-gap: 0px !important; padding: 0 ${PADDING_LR}px !important; margin: 0px !important; }`;
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
                      if (mgr.settings) {
                        mgr.settings.axis = 'horizontal';
                        // Force LTR so epub.js scrollBy() doesn't reverse x for RTL books.
                        // Without this, r.next() at chapter end scrolls backward instead
                        // of jumping to next chapter (scrollBy multiplies delta by -1 for RTL).
                        mgr.settings.direction = 'ltr';
                      }
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
                      const PADDING_LR2 = 16;
                      const columnW = capturedPageW - 2 * PADDING_LR2;
                      const body = currentDoc.body;
                      body.style.setProperty('padding', `0 ${PADDING_LR2}px`, 'important');
                      body.style.setProperty('margin', '0px', 'important');
                      body.style.setProperty('column-width', columnW + 'px', 'important');
                      body.style.setProperty('-webkit-column-width', columnW + 'px', 'important');
                      body.style.setProperty('column-gap', '0px', 'important');
                      body.style.setProperty('-webkit-column-gap', '0px', 'important');

                      // getBoundingClientRect forces synchronous reflow so it
                      // returns the post-injection layout dimensions.
                      const range = currentDoc.createRange();
                      range.selectNodeContents(body);
                      const textW = range.getBoundingClientRect().width;
                      // Use columnW (not capturedPageW) so the number of columns
                      // is calculated correctly with the horizontal padding applied.
                      if (textW > columnW * 1.5) {
                        const numCols = Math.ceil(textW / columnW);
                        const expandedW = numCols * capturedPageW;
                        const epubViewEl = capturedIframe.parentElement as HTMLElement | null;
                        if (epubViewEl) {
                          epubViewEl.style.width = expandedW + 'px';
                          epubViewEl.style.flexShrink = '0';
                        }
                        capturedIframe.style.width = expandedW + 'px';
                      }

                      // Expansion complete — clear the flag so goNext/goPrev can proceed.
                      isExpandingRef.current = false;

                      // After expansion, handle scroll positioning:
                      const mgr4 = (renditionRef.current as any)?.manager;
                      const ec = mgr4?.container as HTMLElement | null;
                      if (ec) {
                        if (prevJumpRef.current) {
                          // Jumped backward (r.prev()) — scroll to last page
                          prevJumpRef.current = false;
                          const maxS = ec.scrollWidth - ec.offsetWidth;
                          ec.scrollLeft = maxS;
                          // Save restored position (relocated fired at scrollLeft=0, fraction=0)
                          window.setTimeout(() => updatePageAfterScrollRef.current(), 10);
                        } else if (scrollRestoreRef.current !== null) {
                          // Restore saved progress position
                          const frac = scrollRestoreRef.current;
                          scrollRestoreRef.current = null;
                          const maxS = ec.scrollWidth - ec.offsetWidth;
                          ec.scrollLeft = Math.round(frac * maxS);
                          // Save restored position so next open doesn't revert to @@0.0000
                          window.setTimeout(() => updatePageAfterScrollRef.current(), 10);
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
                    } else {
                      // Vertical mode: expand iframe vertically to fit content.
                      // In vertical-rl writing mode, content flows vertically and the
                      // iframe must be tall enough to hold all content. epub.js may
                      // have left it at viewport height from horizontal mode.
                      const vDoc = iframeEl.contentWindow?.document;
                      if (vDoc) {
                        // Remove horizontal-mode column properties so vertical-rl
                        // layout is not constrained by leftover column-width rules.
                        vDoc.body.style.removeProperty('column-width');
                        vDoc.body.style.removeProperty('-webkit-column-width');
                        vDoc.body.style.removeProperty('column-gap');
                        vDoc.body.style.removeProperty('-webkit-column-gap');
                        vDoc.body.style.setProperty('margin', '0px', 'important');
                        const textH = vDoc.documentElement.scrollHeight;
                        const mgr4 = (renditionRef.current as any)?.manager;
                        const ec = mgr4?.container as HTMLElement | null;
                        const pageH = ec?.offsetHeight || iframeEl.offsetHeight || 768;

                        if (textH > pageH * 1.5) {
                          const expandedH = Math.ceil(textH / pageH) * pageH;
                          const epubViewEl = iframeEl.parentElement as HTMLElement | null;
                          if (epubViewEl) {
                            epubViewEl.style.width = '';
                            epubViewEl.style.height = expandedH + 'px';
                            epubViewEl.style.flexShrink = '0';
                          }
                          iframeEl.style.width = (ec?.offsetWidth || iframeEl.offsetWidth) + 'px';
                          iframeEl.style.height = expandedH + 'px';
                        }

                        // Container should use block layout for vertical scrolling
                        if (ec) {
                          ec.style.display = 'block';
                          ec.style.overflowY = 'hidden';
                        }
                      }

                      // Handle vertical scroll positioning after expansion
                      const mgr5 = (renditionRef.current as any)?.manager;
                      const ec2 = mgr5?.container as HTMLElement | null;
                      if (ec2) {
                        if (prevJumpRef.current) {
                          // Jumped backward — scroll to last page
                          prevJumpRef.current = false;
                          requestAnimationFrame(() => {
                            const maxS = ec2.scrollHeight - ec2.offsetHeight;
                            ec2.scrollTop = maxS;
                            updatePageAfterScrollRef.current();
                          });
                        } else if (scrollRestoreRef.current !== null) {
                          // Restore saved progress
                          const frac = scrollRestoreRef.current;
                          scrollRestoreRef.current = null;
                          requestAnimationFrame(() => {
                            const maxS = ec2.scrollHeight - ec2.offsetHeight;
                            ec2.scrollTop = Math.round(frac * maxS);
                            updatePageAfterScrollRef.current();
                          });
                        }
                      }
                    }
                  }, 0);
                });

                // Generate location map for page numbers
                r.book.locations.generate(1024).then(() => {
                  setTotalPages(r.book.locations.total);
                }).catch(() => {});

                rendition.on('relocated', (loc: { start: { percentage: number; cfi: string } }) => {
                  // Only update percentage from relocated if locations are generated.
                  // Before locations.generate() completes, epub.js reports incorrect
                  // percentage for RTL/CJK books (e.g., 100% at the beginning of book
                  // because spine indices are reversed for RTL spines). After locations
                  // are generated (total > 0), the value is accurate.
                  const pct = Math.round(loc.start.percentage * 10000) / 100;
                  if (pct > 0 && r.book.locations.total > 0) {
                    setPercentage(pct);
                    percentageRef.current = pct;
                  }
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

        {/* Bottom progress bar — always visible */}
        {book?.format === 'epub' && (
          <Box
            sx={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              pointerEvents: 'none', zIndex: 10,
            }}
          >
            {/* Progress bar */}
            <Box sx={{
              height: 3,
              background: `${theme.fg}22`,
            }}>
              <Box sx={{
                height: '100%',
                width: `${percentage}%`,
                background: theme.fg,
                opacity: 0.5,
                transition: 'width 0.3s ease',
              }} />
            </Box>
            {/* Page indicator */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 0.3,
              background: `${theme.bg}cc`,
            }}>
              <Typography variant="caption" sx={{
                color: theme.fg,
                opacity: 0.6,
                fontSize: '11px',
                fontFamily: 'monospace',
              }}>
                {totalPages > 0 && `${currentPage} / ${totalPages}  ·  `}
                {percentage.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
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
