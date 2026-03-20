import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar, Box, CircularProgress, Drawer, IconButton, List, ListItem, ListItemButton, ListItemText, Slider, Toolbar, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import DeleteIcon from '@mui/icons-material/Delete'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SettingsIcon from '@mui/icons-material/Settings'
import { useBookStore } from '../stores/bookStore'
import { useUserStore } from '../stores/userStore'
import { useSettingsStore } from '../stores/settingsStore'
import { api, type PageBookmark } from '../services/api.service'
import EpubReader, { type EpubReaderHandle } from '../components/Reader/EpubReader'
import PdfReader, { type PdfReaderHandle } from '../components/Reader/PdfReader'
import TxtReader, { type TxtReaderHandle } from '../components/Reader/TxtReader'
import ReaderSettings from '../components/Reader/ReaderSettings'
import TocDrawer from '../components/Reader/TocDrawer'
import useSwipeNavigation from '../hooks/useSwipeNavigation'
import type { TocItem } from '../types'

const TOOLBAR_HEIGHT = 44

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const currentBook = useBookStore((s) => s.currentBook)
  const setCurrentBook = useBookStore((s) => s.setCurrentBook)
  const updateBookProgress = useBookStore((s) => s.updateBookProgress)
  const currentUser = useUserStore((s) => s.currentUser)
  const { settings, setSettings } = useSettingsStore()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readerRef = useRef<EpubReaderHandle | PdfReaderHandle | TxtReaderHandle>(null)
  const readerAreaRef = useRef<HTMLDivElement>(null)
  const [progressPercent, setProgressPercent] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [toc, setToc] = useState<TocItem[]>([])
  const [bookLoading, setBookLoading] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [pageBookmarks, setPageBookmarks] = useState<PageBookmark[]>([])
  const [fullscreen, setFullscreen] = useState(false)
  const currentProgressStringRef = useRef('')

  useSwipeNavigation(
    readerAreaRef,
    () => readerRef.current?.next(),
    () => readerRef.current?.prev(),
  )

  // If no user, redirect to user selection
  useEffect(() => {
    if (!currentUser) {
      navigate('/')
    }
  }, [currentUser, navigate])

  // If no book in store but bookId in URL, fetch it from API
  useEffect(() => {
    if (!currentUser || !bookId || currentBook) return
    setBookLoading(true)
    api.books.get(bookId)
      .then((book) => { setCurrentBook(book) })
      .catch(() => { navigate('/library') })
      .finally(() => { setBookLoading(false) })
  }, [currentUser, bookId, currentBook, setCurrentBook, navigate])

  // Load settings from API on mount
  useEffect(() => {
    if (!currentUser) return
    api.settings.get(currentUser.id).then((s) => setSettings(s)).catch(() => {
      // Use default settings if API fails
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  // Load page bookmarks
  useEffect(() => {
    if (!currentUser || !bookId) return
    api.pageBookmarks.list(currentUser.id, bookId).then(setPageBookmarks).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, bookId])

  async function addBookmark() {
    if (!currentUser || !bookId || !currentProgressStringRef.current) return
    try {
      const bm = await api.pageBookmarks.add(currentUser.id, bookId, currentProgressStringRef.current, `${progressPercent}%`)
      setPageBookmarks(prev => [bm, ...prev])
    } catch { /* ignore */ }
  }

  async function removeBookmark(id: string) {
    try {
      await api.pageBookmarks.remove(id)
      setPageBookmarks(prev => prev.filter(b => b.id !== id))
    } catch { /* ignore */ }
  }

  function goToBookmark(position: string) {
    // Parse position: @@index@@fraction@@...
    const parts = position.split('@@').filter(Boolean)
    if (parts.length >= 2) {
      const index = parseInt(parts[0])
      const fraction = parseFloat(parts[1])
      const paginator = (readerRef.current as any)
      // Use paginator directly for EPUB
      if (paginator?.goTo) {
        // This is EpubReaderHandle - no direct goTo with index/fraction
        // Use goToFraction with weighted fraction if available (4th part)
        const weighted = parts.length >= 4 ? parseFloat(parts[3]) : NaN
        if (!isNaN(weighted)) {
          readerRef.current?.goToFraction(weighted)
        } else {
          // Fallback: approximate fraction
          const total = parts.length >= 3 ? parseFloat(parts[2]) : 1
          readerRef.current?.goToFraction((index + fraction) / (total || 1))
        }
      }
    }
    setBookmarksOpen(false)
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          readerRef.current?.next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          readerRef.current?.prev()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleProgressChange = useCallback(
    (progress: string) => {
      if (!currentUser || !currentBook) return
      currentProgressStringRef.current = progress

      // Parse fraction for display
      // PDF:  @@pageNum@@totalPages
      // EPUB: @@chapterIndex@@sectionFraction@@totalSections@@weightedFraction
      // TXT:  @@scrollFraction@@1
      const parts = progress.split('@@').filter(Boolean)
      if (parts.length >= 2) {
        const first = parseFloat(parts[0])
        const second = parseFloat(parts[1])
        const fourth = parts.length >= 4 ? parseFloat(parts[3]) : NaN
        if (currentBook.format === 'pdf' && second > 0) {
          setProgressPercent(Math.round((first / second) * 100))
        } else if (currentBook.format === 'txt') {
          setProgressPercent(Math.round(first * 100))
        } else if (!isNaN(fourth)) {
          // EPUB: use weighted fraction from SectionProgress
          setProgressPercent(Math.min(100, Math.max(0, Math.round(fourth * 100))))
        } else if (parts.length >= 3) {
          const third = parseFloat(parts[2])
          if (third > 0) setProgressPercent(Math.round(((first + second) / third) * 100))
        } else {
          setProgressPercent(Math.round(second * 100))
        }
      }

      // Update store + persist
      updateBookProgress(currentBook.id, progress)
      api.books.updateProgress(currentUser.id, currentBook.id, progress, currentBook.format).catch(() => {
        // Progress save failed silently
      })
    },
    [currentUser, currentBook, updateBookProgress]
  )

  if (!currentUser) return null
  if (bookLoading || !currentBook) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', bgcolor: '#111' }}>
      <CircularProgress sx={{ color: '#fff' }} />
    </Box>
  )

  const bookIdStr = bookId ?? ''
  const format = currentBook.format

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        bgcolor: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Top toolbar */}
      <AppBar
        position="static"
        sx={{
          height: fullscreen ? 0 : TOOLBAR_HEIGHT,
          overflow: 'hidden',
          transition: 'height 0.2s ease',
          minHeight: TOOLBAR_HEIGHT,
          bgcolor: '#111',
          boxShadow: 'none',
        }}
      >
        <Toolbar
          variant="dense"
          sx={{ minHeight: TOOLBAR_HEIGHT, height: TOOLBAR_HEIGHT, px: 1 }}
        >
          <IconButton
            color="inherit"
            size="small"
            onClick={() => navigate('/library')}
            sx={{ mr: 0.5 }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <IconButton
            color="inherit"
            size="small"
            onClick={() => setTocOpen(true)}
            sx={{ mr: 1 }}
          >
            <MenuBookIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="body2"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentBook.title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'grey.400', ml: 1, flexShrink: 0 }}>
            {progressPercent}%
          </Typography>
          <IconButton
            color="inherit"
            size="small"
            onClick={addBookmark}
            title="加書籤"
          >
            <BookmarkAddIcon fontSize="small" />
          </IconButton>
          <IconButton
            color="inherit"
            size="small"
            onClick={() => setBookmarksOpen(true)}
            title="書籤列表"
          >
            <BookmarkIcon fontSize="small" />
          </IconButton>
          <IconButton
            color="inherit"
            size="small"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Reader area */}
      <Box
        ref={readerAreaRef}
        sx={{
          flexGrow: 1,
          overflow: 'hidden',
          position: 'relative',
          bgcolor: settings.theme === 'dark' ? '#1a1a1a' : settings.theme === 'sepia' ? '#f5ecd7' : '#ffffff',
        }}
      >
        {/* Floating fullscreen toggle button */}
        <IconButton
          onClick={() => setFullscreen(f => !f)}
          size="small"
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 20,
            color: settings.theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)',
            '&:hover': { color: settings.theme === 'dark' ? '#fff' : '#000' },
          }}
        >
          {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
        </IconButton>

        {format === 'epub' && (
          <EpubReader
            ref={readerRef as React.Ref<EpubReaderHandle>}
            bookId={bookIdStr}
            userId={currentUser.id}
            initialProgress={currentBook.progress}
            writingMode={settings.writingMode}
            fontSize={settings.fontSize}
            gap={settings.gap}
            theme={settings.theme}
            tapZoneLayout={settings.tapZoneLayout}
            openccMode={settings.openccMode}
            onCenterTap={() => setFullscreen(f => !f)}
            onProgressChange={handleProgressChange}
            onTocLoad={setToc}
          />
        )}

        {format === 'pdf' && (
          <PdfReader
            ref={readerRef as React.Ref<PdfReaderHandle>}
            bookId={bookIdStr}
            userId={currentUser.id}
            initialProgress={currentBook.progress}
            writingMode={settings.writingMode}
            fontSize={settings.fontSize}
            tapZoneLayout={settings.tapZoneLayout}
            onCenterTap={() => setFullscreen(f => !f)}
            onProgressChange={handleProgressChange}
          />
        )}

        {format === 'txt' && (
          <TxtReader
            ref={readerRef as React.Ref<TxtReaderHandle>}
            bookId={bookIdStr}
            userId={currentUser.id}
            initialProgress={currentBook.progress}
            writingMode={settings.writingMode}
            fontSize={settings.fontSize}
            tapZoneLayout={settings.tapZoneLayout}
            onCenterTap={() => setFullscreen(f => !f)}
            onProgressChange={handleProgressChange}
          />
        )}
      </Box>

      {/* Page slider */}
      <Box
        sx={{
          px: 2,
          py: fullscreen ? 0 : 0.5,
          height: fullscreen ? 0 : 'auto',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          bgcolor: settings.theme === 'dark' ? '#111' : settings.theme === 'sepia' ? '#e8dcc8' : '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Slider
          value={progressPercent}
          min={0}
          max={100}
          onChange={(_: Event, value: number | number[]) => {
            const pct = value as number
            setProgressPercent(pct)
          }}
          onChangeCommitted={(_: React.SyntheticEvent | Event, value: number | number[]) => {
            const fraction = (value as number) / 100
            readerRef.current?.goToFraction(fraction)
          }}
          size="small"
          sx={{
            color: settings.theme === 'dark' ? '#888' : '#666',
            '& .MuiSlider-thumb': { width: 14, height: 14 },
            '& .MuiSlider-track': { height: 3 },
            '& .MuiSlider-rail': { height: 3 },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            minWidth: 32,
            textAlign: 'right',
            color: settings.theme === 'dark' ? '#aaa' : '#666',
          }}
        >
          {progressPercent}%
        </Typography>
      </Box>

      <ReaderSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userId={currentUser.id}
      />

      <TocDrawer
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        toc={toc}
        onNavigate={(href) => {
          readerRef.current?.goTo(href)
        }}
      />

      {/* 書籤列表 Drawer */}
      <Drawer
        anchor="right"
        open={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        PaperProps={{ sx: { width: 280, bgcolor: '#222', color: '#fff' } }}
      >
        <Typography variant="h6" sx={{ p: 2, fontWeight: 600 }}>
          書籤 ({pageBookmarks.length})
        </Typography>
        {pageBookmarks.length === 0 ? (
          <Typography variant="body2" sx={{ px: 2, color: 'grey.500' }}>
            尚無書籤。點擊工具列的 + 書籤按鈕加入。
          </Typography>
        ) : (
          <List dense>
            {pageBookmarks.map((bm) => (
              <ListItem
                key={bm.id}
                secondaryAction={
                  <IconButton edge="end" size="small" onClick={() => removeBookmark(bm.id)} sx={{ color: 'grey.500' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
                disablePadding
              >
                <ListItemButton onClick={() => goToBookmark(bm.position)}>
                  <ListItemText
                    primary={bm.label || '書籤'}
                    secondary={new Date(bm.createdAt).toLocaleString('zh-TW')}
                    primaryTypographyProps={{ sx: { color: '#fff' } }}
                    secondaryTypographyProps={{ sx: { color: 'grey.500', fontSize: 11 } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Drawer>
    </Box>
  )
}
