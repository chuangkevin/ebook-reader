import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
  url: string;
  initialPage: number;
  onProgressChange: (page: number, percentage: number) => void;
}

export default function PdfReader({ url, initialPage, onProgressChange }: PdfReaderProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(initialPage || 1);

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

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', bgcolor: '#525659' }}>
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
          bgcolor: 'rgba(0,0,0,0.7)', borderRadius: 4, px: 2, py: 0.5,
          backdropFilter: 'blur(8px)',
        }}>
          <IconButton size="small" onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} color="inherit">
            <NavigateBeforeIcon />
          </IconButton>
          <Typography variant="body2" sx={{ color: 'white', minWidth: 80, textAlign: 'center' }}>
            {pageNumber} / {numPages}
          </Typography>
          <IconButton size="small" onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= numPages} color="inherit">
            <NavigateNextIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
