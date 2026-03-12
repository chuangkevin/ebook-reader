import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { RootState } from '../../store';
import { readerThemes } from '../../utils/readerThemes';
import { getTapAction } from '../../utils/navigation';

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

  const isVertical = settings.writingMode === 'vertical';

  // Restore scroll position after content loads
  useEffect(() => {
    if (!content || restoredRef.current || !containerRef.current) return;
    // Wait for layout to settle
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      if (isVertical) {
        // vertical-rl: scrollLeft=0 是最左邊（文章結尾）
        // 閱讀起點在最右邊（scrollLeft 最大值）
        const scrollable = el.scrollWidth - el.clientWidth;
        if (initialPercentage > 0) {
          // 從右往左：0% = 最右（scrollLeft=scrollable），100% = 最左（scrollLeft=0）
          el.scrollLeft = scrollable * (1 - initialPercentage / 100);
        } else {
          // 第一次閱讀，捲到最右邊（起點）
          el.scrollLeft = scrollable;
        }
      } else {
        if (initialPercentage > 0) {
          const scrollable = el.scrollHeight - el.clientHeight;
          el.scrollTop = scrollable * (initialPercentage / 100);
        }
      }
      restoredRef.current = true;
    });
  }, [content, initialPercentage, isVertical]);

  // Track scroll progress
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isVertical) {
      // vertical-rl: scrollLeft 從 scrollable（最右=起點）到 0（最左=結尾）
      const scrollable = el.scrollWidth - el.clientWidth;
      if (scrollable <= 0) return;
      const pct = Math.round(((scrollable - el.scrollLeft) / scrollable) * 100);
      onProgressChange(pct);
    } else {
      const scrollable = el.scrollHeight - el.clientHeight;
      if (scrollable <= 0) return;
      const pct = Math.round((el.scrollTop / scrollable) * 100);
      onProgressChange(pct);
    }
  }, [onProgressChange, isVertical]);

  // Tap navigation with tap zone layout support
  const handleTap = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zone = x / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const action = getTapAction(zone, y, settings.tapMode, settings.handPreference, settings.invertPageTurn);

    if (action === 'toggle') {
      onToggleBar();
      return;
    }

    if (isVertical) {
      const pageWidth = el.clientWidth * 0.85;
      if (action === 'next') {
        el.scrollBy({ left: -pageWidth, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: pageWidth, behavior: 'smooth' });
      }
    } else {
      const pageHeight = el.clientHeight * 0.85;
      if (action === 'next') {
        el.scrollBy({ top: pageHeight, behavior: 'smooth' });
      } else {
        el.scrollBy({ top: -pageHeight, behavior: 'smooth' });
      }
    }
  }, [onToggleBar, isVertical, settings.tapMode, settings.handPreference]);

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
      data-txt-container
      onScroll={handleScroll}
      onClick={handleTap}
      sx={{
        height: '100%',
        overflow: 'auto',
        p: 3,
        maxWidth: isVertical ? 'none' : 800,
        mx: 'auto',
        bgcolor: theme.bg,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...(isVertical && {
          overflowX: 'auto',
          overflowY: 'hidden',
        }),
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
          ...(isVertical
            ? { height: '100%' }
            : {}),
        }}
      >
        {content}
      </Typography>
    </Box>
  );
}
