import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface TxtReaderProps {
  url: string;
  initialPercentage: number;
  onProgressChange: (percentage: number) => void;
}

export default function TxtReader({ url, initialPercentage, onProgressChange }: TxtReaderProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // Load text content
  useEffect(() => {
    fetch(url)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load text:', err);
        setContent('Failed to load file.');
        setLoading(false);
      });
  }, [url]);

  // Restore scroll position after content loads
  useEffect(() => {
    if (!content || restoredRef.current || !containerRef.current) return;
    if (initialPercentage > 0) {
      const el = containerRef.current;
      const scrollTarget = (el.scrollHeight - el.clientHeight) * (initialPercentage / 100);
      el.scrollTop = scrollTarget;
    }
    restoredRef.current = true;
  }, [content, initialPercentage]);

  // Track scroll progress
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    const pct = Math.round((el.scrollTop / scrollable) * 100);
    onProgressChange(pct);
  }, [onProgressChange]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        height: '100%',
        overflow: 'auto',
        p: 3,
        maxWidth: 800,
        mx: 'auto',
      }}
    >
      <Typography
        component="pre"
        sx={{
          fontFamily: '"Noto Serif TC", "Noto Serif SC", Georgia, serif',
          fontSize: '1.1rem',
          lineHeight: 1.9,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'text.primary',
        }}
      >
        {content}
      </Typography>
    </Box>
  );
}
