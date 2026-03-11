import { useState, useCallback, useEffect } from 'react';
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
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
  url: string;
  initialPage: number;
  onProgressChange: (page: number, percentage: number) => void;
  onToggleBar: () => void;
}

export default function PdfReader({ url, initialPage, onProgressChange, onToggleBar }: PdfReaderProps) {
  const settings = useSelector((state: RootState) => state.settings);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(initialPage || 1);

  const theme = readerThemes[settings.themeMode];

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

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPage(pageNumber - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPage(pageNumber + 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToPage, pageNumber]);

  // Tap navigation: left = prev, right = next, center = toggle bar
  const handleTap = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zone = x / rect.width;

    if (zone < 0.3) {
      goToPage(pageNumber - 1);
    } else if (zone > 0.7) {
      goToPage(pageNumber + 1);
    } else {
      onToggleBar();
    }
  }, [goToPage, pageNumber, onToggleBar]);

  return (
    <Box
      onClick={handleTap}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'auto',
        bgcolor: theme.bg,
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
