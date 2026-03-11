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
import { ReactReader } from 'react-reader';
import type { RootState } from '../../store';
import apiService from '../../services/api.service';
import { useProgressSync } from '../../hooks/useProgressSync';
import type { Book } from '../../types';
import PdfReader from './PdfReader';
import TxtReader from './TxtReader';

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useSelector((state: RootState) => state.user);
  const [book, setBook] = useState<Book | null>(null);
  const [epubData, setEpubData] = useState<ArrayBuffer | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBar, setShowBar] = useState(true);

  // Use refs to avoid stale closures in epub.js callbacks
  const locationRef = useRef<string | null>(null);
  const percentageRef = useRef(0);

  const { save } = useProgressSync(currentUser?.id || '', bookId || '');

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

        // For EPUB: fetch as ArrayBuffer so epub.js doesn't resolve relative paths
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

  const handleToggleBar = useCallback(() => {
    setShowBar(prev => !prev);
  }, []);

  // --- EPUB handlers ---
  const handleEpubLocationChanged = useCallback((newCfi: string) => {
    setLocation(newCfi);
    locationRef.current = newCfi;
    // Save with latest percentage from ref (avoids stale closure)
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
          />
        );
      case 'txt':
        return (
          <TxtReader
            url={fileUrl}
            initialPercentage={percentage}
            onProgressChange={handleTxtProgressChange}
          />
        );
      case 'epub':
      default:
        if (!epubData) return null;
        return (
          <ReactReader
            url={epubData}
            location={location}
            locationChanged={handleEpubLocationChanged}
            epubOptions={{
              allowScriptedContent: true,
            }}
            getRendition={(rendition) => {
              // Use refs inside this closure to always get latest values
              rendition.on('relocated', (loc: { start: { percentage: number } }) => {
                const pct = Math.round(loc.start.percentage * 100);
                setPercentage(pct);
                percentageRef.current = pct;
                // Save with latest location from ref
                save(locationRef.current, pct);
              });
            }}
          />
        );
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <AppBar
        position="fixed"
        sx={{
          transition: 'transform 0.3s',
          transform: showBar ? 'translateY(0)' : 'translateY(-100%)',
          bgcolor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/library')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="body1" sx={{ ml: 1, flex: 1, fontWeight: 500 }} noWrap>
            {book.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(percentage)}%
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Reader */}
      <Box sx={{ flex: 1 }} onClick={handleToggleBar}>
        {renderReader()}
      </Box>
    </Box>
  );
}
