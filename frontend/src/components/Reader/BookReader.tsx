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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ReactReader, ReactReaderStyle } from 'react-reader';
import type { RootState } from '../../store';
import apiService from '../../services/api.service';
import { useProgressSync } from '../../hooks/useProgressSync';
import type { Book } from '../../types';
import { readerThemes } from '../../utils/readerThemes';
import { getTapAction } from '../../utils/navigation';
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
      register: (fn: (contents: { document: Document }) => void) => void;
    };
  };
}

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
  const [showBar, setShowBar] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const locationRef = useRef<string | null>(null);
  const percentageRef = useRef(0);
  const renditionRef = useRef<EpubRendition | null>(null);

  // Refs for stable closure in keyboard callbacks
  const goPrevRef = useRef<() => void>(() => {});
  const goNextRef = useRef<() => void>(() => {});

  // Pointer tracking for tap detection (works on both desktop and mobile)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

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

  // Auto-hide top bar
  useEffect(() => {
    if (!showBar) return;
    const timer = setTimeout(() => setShowBar(false), 3000);
    return () => clearTimeout(timer);
  }, [showBar]);

  // Apply EPUB settings when they change
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const epubStyles = {
      body: {
        'background-color': `${theme.bg} !important`,
        color: `${theme.fg} !important`,
        'font-size': `${settings.fontSize}px !important`,
        'line-height': `${settings.lineHeight} !important`,
        'writing-mode': settings.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
        '-webkit-user-select': 'none !important',
        'user-select': 'none !important',
      },
      'p, div, span, li, td, th, h1, h2, h3, h4, h5, h6': {
        'font-size': `${settings.fontSize}px !important`,
        'line-height': `${settings.lineHeight} !important`,
      },
    };

    rendition.themes.default(epubStyles);

    // Force re-render at current position
    try {
      const loc = rendition.currentLocation() as { start?: { cfi?: string } } | null;
      if (loc?.start?.cfi) {
        rendition.display(loc.start.cfi);
      }
    } catch { /* ignore */ }
  }, [settings.fontSize, settings.lineHeight, settings.writingMode, settings.themeMode, theme]);

  const handleToggleBar = useCallback(() => {
    setShowBar(prev => !prev);
  }, []);

  // Unified prev/next for keyboard & side buttons
  const goPrev = useCallback(() => {
    if (book?.format === 'epub') {
      renditionRef.current?.prev();
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
  }, [book?.format, settings.writingMode]);

  const goNext = useCallback(() => {
    if (book?.format === 'epub') {
      renditionRef.current?.next();
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
  }, [book?.format, settings.writingMode]);

  // Keep refs in sync for keyboard callbacks
  useEffect(() => { goPrevRef.current = goPrev; }, [goPrev]);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  // Keyboard: Arrow keys, PageUp/Down, Space, Volume keys, Boox buttons
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (settingsOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          goPrev();
          return;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          goNext();
          return;
      }

      // Volume keys (Android/Boox) — use keyCode since key name varies
      if (e.keyCode === 24) { // Volume Up → prev page
        e.preventDefault();
        goPrev();
      } else if (e.keyCode === 25) { // Volume Down → next page
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext, settingsOpen]);

  // --- EPUB handlers ---
  const handleEpubLocationChanged = useCallback((newCfi: string) => {
    setLocation(newCfi);
    locationRef.current = newCfi;
    save(newCfi, percentageRef.current);
  }, [save]);

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
          <Box sx={{ flex: 1, height: '100%' }}>
            <ReactReader
              url={epubData}
              location={location}
              locationChanged={handleEpubLocationChanged}
              epubOptions={{
                flow: 'paginated',
              }}
              readerStyles={{
                ...ReactReaderStyle,
                prev: { ...ReactReaderStyle.prev, display: 'none' },
                next: { ...ReactReaderStyle.next, display: 'none' },
              }}
              getRendition={(rendition) => {
                renditionRef.current = rendition as unknown as EpubRendition;

                // Ensure paginated flow after epub.js initializes
                rendition.on('started', () => {
                  (rendition as unknown as EpubRendition).flow('paginated');
                });

                // Apply initial styles (including user-select: none)
                rendition.themes.default({
                  body: {
                    'background-color': `${theme.bg} !important`,
                    color: `${theme.fg} !important`,
                    'font-size': `${settings.fontSize}px !important`,
                    'line-height': `${settings.lineHeight} !important`,
                    'writing-mode': settings.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                    '-webkit-user-select': 'none !important',
                    'user-select': 'none !important',
                  },
                  'p, div, span, li, td, th, h1, h2, h3, h4, h5, h6': {
                    'font-size': `${settings.fontSize}px !important`,
                    'line-height': `${settings.lineHeight} !important`,
                  },
                });

                rendition.on('relocated', (loc: { start: { percentage: number } }) => {
                  const pct = Math.round(loc.start.percentage * 100);
                  setPercentage(pct);
                  percentageRef.current = pct;
                  save(locationRef.current, pct);
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
            {Math.round(percentage)}%
          </Typography>
          <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Reader */}
      <Box
        sx={{ flex: 1, position: 'relative' }}
        onPointerDown={(e) => {
          pointerDownPos.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (!pointerDownPos.current || settingsOpen) return;
          const dx = e.clientX - pointerDownPos.current.x;
          const dy = e.clientY - pointerDownPos.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          pointerDownPos.current = null;

          // Only handle as tap if pointer didn't move much (not a swipe)
          if (dist > 15) return;

          const zone = e.clientX / window.innerWidth;
          const action = getTapAction(zone, settings.tapZoneLayout);
          switch (action) {
            case 'prev': goPrev(); break;
            case 'next': goNext(); break;
            case 'toggle': handleToggleBar(); break;
          }
        }}
      >
        {renderReader()}

        {/* Desktop side nav buttons for TXT (EPUB has tap zones) */}
        {book.format === 'txt' && (
          <>
            <IconButton
              onClick={goPrev}
              sx={{
                position: 'fixed',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(0,0,0,0.3)',
                color: '#fff',
                opacity: 0.15,
                transition: 'opacity 0.3s',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.6)', opacity: 1 },
                width: 48,
                height: 80,
                borderRadius: 2,
                display: { xs: 'none', md: 'flex' },
                zIndex: 10,
              }}
            >
              <ChevronLeftIcon fontSize="large" />
            </IconButton>
            <IconButton
              onClick={goNext}
              sx={{
                position: 'fixed',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(0,0,0,0.3)',
                color: '#fff',
                opacity: 0.15,
                transition: 'opacity 0.3s',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.6)', opacity: 1 },
                width: 48,
                height: 80,
                borderRadius: 2,
                display: { xs: 'none', md: 'flex' },
                zIndex: 10,
              }}
            >
              <ChevronRightIcon fontSize="large" />
            </IconButton>
          </>
        )}
      </Box>

      {/* Settings Drawer */}
      <ReaderSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
}
