import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { RootState } from '../../store';
import { readerThemes } from '../../utils/readerThemes';

interface TxtReaderProps {
  url: string;
  initialPercentage: number;
  onProgressChange: (percentage: number) => void;
  onToggleBar: () => void;
}

export default function TxtReader({ url, initialPercentage, onProgressChange, onToggleBar }: TxtReaderProps) {
  const settings = useSelector((state: RootState) => state.settings);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  const theme = readerThemes[settings.themeMode];

  // Load text content (with optional S→T conversion)
  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then(res => res.text())
      .then(async (text) => {
        if (settings.convertToTraditional) {
          const OpenCC = await import('opencc-js');
          const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
          setContent(converter(text));
        } else {
          setContent(text);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load text:', err);
        setContent('Failed to load file.');
        setLoading(false);
      });
  }, [url, settings.convertToTraditional]);

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

  // Tap navigation: left = scroll up, right = scroll down, center = toggle bar
  const handleTap = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zone = x / rect.width;
    const pageHeight = el.clientHeight * 0.85;

    if (zone < 0.3) {
      el.scrollBy({ top: -pageHeight, behavior: 'smooth' });
    } else if (zone > 0.7) {
      el.scrollBy({ top: pageHeight, behavior: 'smooth' });
    } else {
      onToggleBar();
    }
  }, [onToggleBar]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isVertical = settings.writingMode === 'vertical';

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      onClick={handleTap}
      sx={{
        height: '100%',
        overflow: 'auto',
        p: 3,
        maxWidth: isVertical ? 'none' : 800,
        mx: 'auto',
        bgcolor: theme.bg,
      }}
    >
      <Typography
        component="pre"
        sx={{
          fontFamily: '"Noto Serif TC", "Noto Serif SC", Georgia, serif',
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: theme.fg,
          writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
          minHeight: isVertical ? '100%' : 'auto',
        }}
      >
        {content}
      </Typography>
    </Box>
  );
}
