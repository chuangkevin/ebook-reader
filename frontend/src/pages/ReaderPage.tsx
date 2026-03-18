import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar, Box, CircularProgress, IconButton, Toolbar, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SettingsIcon from '@mui/icons-material/Settings'
import { useBookStore } from '../stores/bookStore'
import { useUserStore } from '../stores/userStore'
import { useSettingsStore } from '../stores/settingsStore'
import { api } from '../services/api.service'
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

      // Parse fraction for display
      // PDF:  @@pageNum@@totalPages             -> pageNum/totalPages
      // EPUB: @@chapterIndex@@sectionFraction@@totalSections -> (chapterIndex+sectionFraction)/totalSections
      // TXT:  @@scrollFraction@@1               -> scrollFraction (0-1)
      const parts = progress.split('@@').filter(Boolean)
      if (parts.length >= 2) {
        const first = parseFloat(parts[0])
        const second = parseFloat(parts[1])
        const third = parts.length >= 3 ? parseFloat(parts[2]) : 0
        if (currentBook.format === 'pdf' && second > 0) {
          setProgressPercent(Math.round((first / second) * 100))
        } else if (currentBook.format === 'txt') {
          setProgressPercent(Math.round(first * 100))
        } else if (third > 0) {
          // EPUB: book-wide progress = (chapterIndex + sectionFraction) / totalSections
          setProgressPercent(Math.round(((first + second) / third) * 100))
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
          height: TOOLBAR_HEIGHT,
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
            onClick={() => setSettingsOpen(true)}
            sx={{ ml: 1 }}
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
        {format === 'epub' && (
          <EpubReader
            ref={readerRef as React.Ref<EpubReaderHandle>}
            bookId={bookIdStr}
            userId={currentUser.id}
            initialProgress={currentBook.progress}
            writingMode={settings.writingMode}
            fontSize={settings.fontSize}
            theme={settings.theme}
            tapZoneLayout={settings.tapZoneLayout}
            openccMode={settings.openccMode}
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
            onProgressChange={handleProgressChange}
          />
        )}
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
    </Box>
  )
}
