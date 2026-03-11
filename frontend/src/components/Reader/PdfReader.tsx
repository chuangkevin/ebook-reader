import { useState, useCallback, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import type { RootState } from '../../store';
import { readerThemes } from '../../utils/readerThemes';
import { getTapAction } from '../../utils/navigation';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
  url: string;
  initialPage: number;
  onProgressChange: (page: number, percentage: number) => void;
  onToggleBar: () => void;
}

const SWIPE_THRESHOLD = 50;
const SWIPE_TIME_LIMIT = 500;

export default function PdfReader({ url, initialPage, onProgressChange, onToggleBar }: PdfReaderProps) {
  const settings = useSelector((state: RootState) => state.settings);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(initialPage || 1);

  const theme = readerThemes[settings.themeMode];

  // Touch/swipe tracking
  const touchRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchHandledRef = useRef(false);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    if (initialPage && initialPage <= total) {
      setPageNumber(initialPage);
    }
  }, [initialPage]);

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > numPages) return;
    setPageNumber(page);
    const pct = Math.round((page / numPages) * 100);
    onProgressChange(page, pct);
  }, [numPages, onProgressChange]);

  // Keyboard navigation (PageUp/Down, arrows, volume keys)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          goToPage(pageNumber - 1);
          return;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          goToPage(pageNumber + 1);
          return;
      }
      if (e.keyCode === 24) { // Volume Up
        e.preventDefault();
        goToPage(pageNumber - 1);
      } else if (e.keyCode === 25) { // Volume Down
        e.preventDefault();
        goToPage(pageNumber + 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToPage, pageNumber]);

  // Tap navigation with tap zone layout support
  const handleTap = useCallback((e: React.MouseEvent) => {
    // Skip if touch already handled this interaction
    if (touchHandledRef.current) {
      touchHandledRef.current = false;
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zone = x / rect.width;
    const action = getTapAction(zone, settings.tapZoneLayout);

    switch (action) {
      case 'prev': goToPage(pageNumber - 1); break;
      case 'next': goToPage(pageNumber + 1); break;
      case 'toggle': onToggleBar(); break;
    }
  }, [goToPage, pageNumber, onToggleBar, settings.tapZoneLayout]);

  // Swipe handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    touchHandledRef.current = false;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.x;
    const deltaY = touch.clientY - touchRef.current.y;
    const elapsed = Date.now() - touchRef.current.time;
    touchRef.current = null;

    // Swipe detection
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) && elapsed < SWIPE_TIME_LIMIT) {
      touchHandledRef.current = true;
      if (deltaX < 0) {
        goToPage(pageNumber + 1); // swipe left → next
      } else {
        goToPage(pageNumber - 1); // swipe right → prev
      }
      return;
    }

    // Tap detection (small movement = tap)
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      touchHandledRef.current = true;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const zone = x / rect.width;
      const action = getTapAction(zone, settings.tapZoneLayout);

      switch (action) {
        case 'prev': goToPage(pageNumber - 1); break;
        case 'next': goToPage(pageNumber + 1); break;
        case 'toggle': onToggleBar(); break;
      }
    }
  }, [goToPage, pageNumber, onToggleBar, settings.tapZoneLayout]);

  return (
    <Box
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'auto',
        bgcolor: theme.bg,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <Document
        file={url}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        }
      >
        <Page
          pageNumber={pageNumber}
          width={Math.min(window.innerWidth - 32, 800)}
          renderTextLayer={true}
          renderAnnotationLayer={true}
        />
      </Document>

      {/* Page Navigation */}
      {numPages > 0 && (
        <Box sx={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: theme.barBg, borderRadius: 4, px: 2, py: 0.5,
          backdropFilter: 'blur(8px)',
        }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); goToPage(pageNumber - 1); }}
            disabled={pageNumber <= 1}
            sx={{ color: theme.fg }}
          >
            <NavigateBeforeIcon />
          </IconButton>
          <Typography variant="body2" sx={{ color: theme.fg, minWidth: 80, textAlign: 'center' }}>
            {pageNumber} / {numPages}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); goToPage(pageNumber + 1); }}
            disabled={pageNumber >= numPages}
            sx={{ color: theme.fg }}
          >
            <NavigateNextIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
