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
  getContents: () => Array<{ window: Window; document: Document }>;
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

  // Each zone renders a tiny arrow icon hugging the edge
  return (
    <>
      {zones.map((zone, i) => {
        // Arrow character and position
        const isSameSide = tapMode === 'same-side';
        let arrow: string;
        if (isSameSide) {
          arrow = zone.vertical === 'top' ? '\u25B2' : '\u25BC'; // ▲ ▼
        } else {
          arrow = zone.side === 'left' ? '\u25C0' : '\u25B6'; // ◀ ▶
        }

        // Position the small indicator at the edge
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
          // Same-side: arrows on the edge of the nav side
          if (zone.side === 'left') { sx.left = 4; } else { sx.right = 4; }
          if (zone.vertical === 'top') { sx.top = '20%'; } else { sx.bottom = '20%'; }
        } else {
          // Two-side: arrows centered vertically on each edge
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

  // Refs for stable closure in keyboard/iframe callbacks
  const goPrevRef = useRef<() => void>(() => {});
  const goNextRef = useRef<() => void>(() => {});
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Debounce guard: prevent double-fire from iframe + outer Box handling same tap
  const navLock = useRef(false);

  // Track last chapter navigation direction for horizontal mode:
  // when going "prev" to previous chapter, we need to scroll to the last page
  const lastChapterNavDir = useRef<'next' | 'prev' | null>(null);

  // Pointer tracking for tap/swipe detection (works on both desktop and mobile)
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

  // Auto-hide top bar after 3s when shown
  useEffect(() => {
    if (!showBar) return;
    const timer = setTimeout(() => setShowBar(false), 4000);
    return () => clearTimeout(timer);
  }, [showBar]);

  // Apply EPUB settings when they change
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const writingModeValue = settings.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb';

    const isHoriz = settings.writingMode === 'horizontal';
    const epubStyles: Record<string, Record<string, string>> = {
      body: {
        'background-color': `${theme.bg} !important`,
        color: `${theme.fg} !important`,
        'font-size': `${settings.fontSize}px !important`,
        'line-height': `${settings.lineHeight} !important`,
        'writing-mode': `${writingModeValue} !important`,
        '-webkit-writing-mode': `${writingModeValue} !important`,
        '-webkit-user-select': 'none !important',
        'user-select': 'none !important',
        ...(isHoriz ? {
          'text-align': 'left !important',
          'direction': 'ltr !important',
        } : {}),
      },
      'p, div, span, li, td, th, h1, h2, h3, h4, h5, h6': {
        'font-size': `${settings.fontSize}px !important`,
        'line-height': `${settings.lineHeight} !important`,
        'writing-mode': `${writingModeValue} !important`,
        '-webkit-writing-mode': `${writingModeValue} !important`,
        ...(isHoriz ? {
          'text-align': 'left !important',
        } : {}),
      },
      'html': {
        'writing-mode': `${writingModeValue} !important`,
        '-webkit-writing-mode': `${writingModeValue} !important`,
      },
    };

    rendition.themes.default(epubStyles);

    // Directly apply writing-mode and column layout to the current iframe
    const iframeEl = document.querySelector('iframe');
    if (iframeEl?.contentDocument) {
      const doc = iframeEl.contentDocument;
      const html = doc.documentElement;
      const body = doc.body;
      html.style.setProperty('writing-mode', writingModeValue, 'important');
      html.style.setProperty('-webkit-writing-mode', writingModeValue, 'important');
      html.style.setProperty('overflow', 'hidden', 'important');
      body.style.setProperty('writing-mode', writingModeValue, 'important');
      body.style.setProperty('-webkit-writing-mode', writingModeValue, 'important');
      body.style.setProperty('overflow', 'hidden', 'important');

      if (writingModeValue === 'horizontal-tb') {
        // Set up CSS columns for horizontal pagination (manual scrolling)
        const pageW = iframeEl.clientWidth;
        const pageH = iframeEl.clientHeight || window.innerHeight;
        body.style.setProperty('column-width', `${pageW}px`, 'important');
        body.style.setProperty('-webkit-column-width', `${pageW}px`, 'important');
        body.style.setProperty('column-gap', '0px', 'important');
        body.style.setProperty('column-fill', 'auto', 'important');
        body.style.setProperty('overflow', 'hidden', 'important');
        body.style.setProperty('height', `${pageH}px`, 'important');
        body.style.setProperty('padding', '20px', 'important');
        body.style.setProperty('box-sizing', 'border-box', 'important');
        body.style.setProperty('text-align', 'left', 'important');
        body.style.setProperty('direction', 'ltr', 'important');
        // Reset scroll to beginning of chapter
        const scrollEl = doc.scrollingElement || doc.documentElement;
        scrollEl.scrollLeft = 0;
      }
    }

    // For vertical mode, let epub.js handle everything via re-render
    if (writingModeValue === 'vertical-rl') {
      try {
        const loc = rendition.currentLocation() as { start?: { cfi?: string } } | null;
        const cfi = loc?.start?.cfi;
        const manager = (rendition as unknown as { manager?: { clear?: () => void } }).manager;
        if (manager?.clear) manager.clear();
        rendition.flow('paginated');
        if (cfi) rendition.display(cfi);
      } catch { /* ignore */ }
    }
  }, [settings.fontSize, settings.lineHeight, settings.themeMode, settings.writingMode, theme]);

  const handleToggleBar = useCallback(() => {
    setShowBar(prev => !prev);
  }, []);

  // Manual CSS column scrolling for horizontal mode on vertical-rl EPUBs.
  // epub.js's rendition.next()/prev() breaks when writing-mode is overridden,
  // so we scroll the columns ourselves and only call next()/prev() at chapter boundaries.
  const scrollEpubPage = useCallback((direction: 'next' | 'prev') => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const isHorizontalOverride = settingsRef.current.writingMode === 'horizontal';

    if (!isHorizontalOverride) {
      // Native vertical-rl mode — epub.js handles pagination correctly
      if (direction === 'next') rendition.next();
      else rendition.prev();
      return;
    }

    // Horizontal override mode — manually scroll CSS columns in iframe
    const iframeEl = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframeEl?.contentDocument) {
      if (direction === 'next') rendition.next();
      else rendition.prev();
      return;
    }

    const doc = iframeEl.contentDocument;
    const scrollEl = doc.scrollingElement || doc.documentElement;

    // In horizontal-tb column pagination, content overflows horizontally
    const pageWidth = iframeEl.clientWidth;
    const currentScroll = scrollEl.scrollLeft;
    const maxScroll = scrollEl.scrollWidth - pageWidth;

    console.log(`[scrollEpubPage] dir=${direction} scrollLeft=${currentScroll} maxScroll=${maxScroll} scrollWidth=${scrollEl.scrollWidth} pageWidth=${pageWidth}`);

    if (direction === 'next') {
      if (currentScroll >= maxScroll - 5) {
        // At the end of this chapter — go to next spine item
        lastChapterNavDir.current = 'next';
        rendition.next();
      } else {
        // Scroll to next column/page
        scrollEl.scrollLeft = Math.min(currentScroll + pageWidth, maxScroll);
      }
    } else {
      if (currentScroll <= 5) {
        // At the beginning of this chapter — go to previous spine item
        lastChapterNavDir.current = 'prev';
        rendition.prev();
      } else {
        // Scroll to previous column/page
        scrollEl.scrollLeft = Math.max(currentScroll - pageWidth, 0);
      }
    }
  }, []);

  // Unified prev/next for keyboard & side buttons
  const goPrev = useCallback(() => {
    if (book?.format === 'epub') {
      scrollEpubPage('prev');
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
  }, [book?.format, settings.writingMode, scrollEpubPage]);

  const goNext = useCallback(() => {
    if (book?.format === 'epub') {
      scrollEpubPage('next');
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
  }, [book?.format, settings.writingMode, scrollEpubPage]);

  // Keep refs in sync for keyboard callbacks
  useEffect(() => { goPrevRef.current = goPrev; }, [goPrev]);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  // Keyboard: Arrow keys, PageUp/Down, Space, Volume keys, Boox buttons
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (settingsOpen || tocOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          console.log(`[keyboard] ${e.key} → prev (type=${e.type})`);
          goPrev();
          return;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          console.log(`[keyboard] ${e.key} → next (type=${e.type})`);
          goNext();
          return;
      }

      // Volume keys (Android/Boox)
      if (settings.volumeKeyNav) {
        if (e.keyCode === 24) {
          e.preventDefault();
          goPrev();
        } else if (e.keyCode === 25) {
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
            // Kill react-reader's SwipeWrapper mouse/touch handlers
            '& div[style*="height: 100%"]': { pointerEvents: 'none' },
            '& iframe': { pointerEvents: 'none' }, // iframe doesn't need events — overlay handles them
            // Hide scrollbars everywhere (iOS Safari)
            '& *': { scrollbarWidth: 'none', msOverflowStyle: 'none' },
            '& *::-webkit-scrollbar': { display: 'none' },
          }}>
            <ReactReader
              url={epubData}
              location={location}
              locationChanged={handleEpubLocationChanged}
              showToc={false}
              tocChanged={(newToc) => setToc(newToc)}
              // Disable react-reader's built-in keyboard nav (we handle it ourselves)
              handleKeyPress={() => {}}
              epubOptions={{
                flow: 'paginated',
                spread: 'none',
              }}
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
                titleArea: {
                  ...ReactReaderStyle.titleArea,
                  display: 'none',
                },
                prev: { ...ReactReaderStyle.prev, display: 'none', visibility: 'hidden' as const, width: 0, height: 0, overflow: 'hidden' },
                next: { ...ReactReaderStyle.next, display: 'none', visibility: 'hidden' as const, width: 0, height: 0, overflow: 'hidden' },
                arrow: { ...ReactReaderStyle.arrow, display: 'none' },
              }}
              getRendition={(rendition) => {
                renditionRef.current = rendition as unknown as EpubRendition;

                rendition.on('started', () => {
                  (rendition as unknown as EpubRendition).flow('paginated');
                });

                const initWm = settings.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb';
                const initialStyles: Record<string, Record<string, string>> = {
                  body: {
                    'background-color': `${theme.bg} !important`,
                    color: `${theme.fg} !important`,
                    'font-size': `${settings.fontSize}px !important`,
                    'line-height': `${settings.lineHeight} !important`,
                    'writing-mode': `${initWm} !important`,
                    '-webkit-writing-mode': `${initWm} !important`,
                    '-webkit-user-select': 'none !important',
                    'user-select': 'none !important',
                  },
                  'p, div, span, li, td, th, h1, h2, h3, h4, h5, h6': {
                    'font-size': `${settings.fontSize}px !important`,
                    'line-height': `${settings.lineHeight} !important`,
                    'writing-mode': `${initWm} !important`,
                    '-webkit-writing-mode': `${initWm} !important`,
                  },
                  'html': {
                    'writing-mode': `${initWm} !important`,
                    '-webkit-writing-mode': `${initWm} !important`,
                  },
                };

                rendition.themes.default(initialStyles);

                // Ensure writing-mode and column layout is correct for each chapter
                rendition.hooks.content.register((contents: { document: Document; window: Window }) => {
                  const isHoriz = settingsRef.current.writingMode === 'horizontal';
                  const wm = isHoriz ? 'horizontal-tb' : 'vertical-rl';
                  const html = contents.document.documentElement;
                  const body = contents.document.body;
                  html.style.setProperty('writing-mode', wm, 'important');
                  html.style.setProperty('-webkit-writing-mode', wm, 'important');
                  body.style.setProperty('writing-mode', wm, 'important');
                  body.style.setProperty('-webkit-writing-mode', wm, 'important');

                  // Hide scrollbars (critical for iOS Safari)
                  const hideScrollbarCSS = contents.document.createElement('style');
                  hideScrollbarCSS.textContent = `
                    html, body {
                      overflow: hidden !important;
                      -webkit-overflow-scrolling: auto !important;
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
                    }
                  `;
                  contents.document.head.appendChild(hideScrollbarCSS);

                  // For horizontal override: set up CSS columns manually so content
                  // paginates correctly (epub.js's column setup breaks with overridden writing-mode)
                  if (isHoriz) {
                    const iframeEl = document.querySelector('iframe');
                    const pageW = iframeEl?.clientWidth || contents.window.innerWidth;
                    const pageH = iframeEl?.clientHeight || contents.window.innerHeight;
                    body.style.setProperty('column-width', `${pageW}px`, 'important');
                    body.style.setProperty('-webkit-column-width', `${pageW}px`, 'important');
                    body.style.setProperty('column-gap', '0px', 'important');
                    body.style.setProperty('column-fill', 'auto', 'important');
                    body.style.setProperty('overflow', 'hidden', 'important');
                    body.style.setProperty('height', `${pageH}px`, 'important');
                    body.style.setProperty('padding', '20px', 'important');
                    body.style.setProperty('box-sizing', 'border-box', 'important');
                    body.style.setProperty('text-align', 'left', 'important');
                    body.style.setProperty('direction', 'ltr', 'important');

                    // When navigating backward to a previous chapter, scroll to the last page
                    // so the user continues reading from where they left off
                    if (lastChapterNavDir.current === 'prev') {
                      requestAnimationFrame(() => {
                        const scrollEl = contents.document.scrollingElement || contents.document.documentElement;
                        const maxScroll = scrollEl.scrollWidth - pageW;
                        if (maxScroll > 0) {
                          // Snap to the last column boundary
                          scrollEl.scrollLeft = Math.floor(maxScroll / pageW) * pageW;
                        }
                        lastChapterNavDir.current = null;
                      });
                    } else {
                      lastChapterNavDir.current = null;
                    }
                  }
                });

                // Generate location map for page numbers
                const r = rendition as unknown as EpubRendition;
                r.book.locations.generate(1024).then(() => {
                  setTotalPages(r.book.locations.total);
                  console.log(`[epub] locations generated: ${r.book.locations.total} pages`);
                }).catch(() => { /* ignore */ });

                rendition.on('relocated', (loc: { start: { percentage: number; cfi: string } }) => {
                  const pct = Math.round(loc.start.percentage * 10000) / 100;
                  setPercentage(pct);
                  percentageRef.current = pct;
                  save(locationRef.current, pct);

                  // Update page number
                  try {
                    const page = r.book.locations.locationFromCfi(loc.start.cfi);
                    if (page >= 0) setCurrentPage(page + 1); // 1-based
                  } catch { /* locations not ready yet */ }
                });

                // Handle taps inside EPUB iframe
                rendition.on('click', (e: MouseEvent) => {
                  if (navLock.current) return;
                  navLock.current = true;
                  setTimeout(() => { navLock.current = false; }, 300);

                  // In vertical-rl paginated mode, iframe height is the full content height
                  // (e.g. 14008px for 17 pages). Use viewport height for normalization.
                  const iframeEl = document.querySelector('iframe');
                  const w = iframeEl?.clientWidth || window.innerWidth;
                  const viewH = window.innerHeight;
                  const x = (((e.clientX % w) + w) % w) / w;
                  const y = (((e.clientY % viewH) + viewH) % viewH) / viewH;

                  const s = settingsRef.current;
                  const action = getTapAction(x, y, s.tapMode, s.handPreference, s.invertPageTurn);
                  console.log(`[iframe-click] clientY=${e.clientY} viewH=${viewH} x=${x.toFixed(3)} y=${y.toFixed(3)} → ${action}`);
                  switch (action) {
                    case 'prev': goPrevRef.current(); break;
                    case 'next': goNextRef.current(); break;
                    case 'toggle': handleToggleBar(); break;
                  }
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
            {/* Transparent touch overlay — captures all taps/swipes on iOS
                where iframe click events are unreliable */}
            <Box
              sx={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 3,
                touchAction: 'pan-x', // allow horizontal swipe detection
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
              }}
              onPointerDown={(e) => {
                pointerDownPos.current = { x: e.clientX, y: e.clientY, t: Date.now() };
              }}
              onPointerUp={(e) => {
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
                const action = getTapAction(x, y, settings.tapMode, settings.handPreference, settings.invertPageTurn);
                console.log(`[overlay-tap] x=${x.toFixed(3)} y=${y.toFixed(3)} → ${action}`);
                switch (action) {
                  case 'prev': goPrev(); break;
                  case 'next': goNext(); break;
                  case 'toggle': handleToggleBar(); break;
                }
              }}
            />
          </Box>
        );
    }
  };

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: theme.bg,
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'manipulation', // disable double-tap zoom
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
        onPointerDown={(e) => {
          console.log(`[outer-pointerDown] x=${e.clientX} y=${e.clientY} target=${(e.target as HTMLElement).tagName}`);
          pointerDownPos.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        }}
        onPointerUp={(e) => {
          if (!pointerDownPos.current || settingsOpen || tocOpen) return;
          const dx = e.clientX - pointerDownPos.current.x;
          const dy = e.clientY - pointerDownPos.current.y;
          const dt = Date.now() - pointerDownPos.current.t;
          const dist = Math.sqrt(dx * dx + dy * dy);
          pointerDownPos.current = null;

          // Swipe detection
          if (dist > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
            console.log(`[outer-swipe] dx=${dx.toFixed(0)} → ${dx > 0 ? 'prev' : 'next'}`);
            if (dx > 0) { goPrev(); } else { goNext(); }
            return;
          }

          // Only handle as tap if pointer didn't move much
          if (dist > 15) {
            console.log(`[outer-pointerUp] IGNORED dist=${dist.toFixed(1)}`);
            return;
          }

          // Skip if iframe already handled this tap
          if (navLock.current) {
            console.log('[outer-tap] BLOCKED by navLock');
            return;
          }
          navLock.current = true;
          setTimeout(() => { navLock.current = false; }, 300);

          const x = e.clientX / window.innerWidth;
          const y = e.clientY / window.innerHeight;
          const action = getTapAction(x, y, settings.tapMode, settings.handPreference, settings.invertPageTurn);
          console.log(`[outer-tap] x=${x.toFixed(3)} y=${y.toFixed(3)} mode=${settings.tapMode} hand=${settings.handPreference} invert=${settings.invertPageTurn} → ${action}`);
          switch (action) {
            case 'prev': goPrev(); break;
            case 'next': goNext(); break;
            case 'toggle': handleToggleBar(); break;
          }
        }}
      >
        {renderReader()}

        {/* Glass tap zone overlay */}
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
