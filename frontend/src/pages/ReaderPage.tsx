import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar, Box, IconButton, Toolbar, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
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
  const updateBookProgress = useBookStore((s) => s.updateBookProgress)
  const currentUser = useUserStore((s) => s.currentUser)
  const { settings, setSettings } = useSettingsStore()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readerRef = useRef<EpubReaderHandle | PdfReaderHandle | TxtReaderHandle>(null)
  const readerAreaRef = useRef<HTMLDivElement>(null)
  const [progressPercent, setProgressPercent] = useState(0)
  const [pageInfo, setPageInfo] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [toc, setToc] = useState<TocItem[]>([])
  const [fullscreen, setFullscreen] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(true)

  useSwipeNavigation(
    readerAreaRef,
    () => readerRef.current?.next(),
    () => readerRef.current?.prev(),
  )

  // Redirect if no book or user
  useEffect(() => {
    if (!currentBook || !currentUser) {
      navigate('/')
    }
  }, [currentBook, currentUser, navigate])

  // Load settings from API on mount
  useEffect(() => {
    if (!currentUser) return
    api.settings.get(currentUser.id).then((s) => setSettings(s)).catch(() => {
      // Use default settings if API fails
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  // F11-style fullscreen via Fullscreen API (hides browser chrome + URL bar)
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch { /* ignore if not supported */ }
  }, [])

  // Sync fullscreen state with browser
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Exit fullscreen when leaving reader page
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

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
        case 'Escape':
          // Escape exits fullscreen (handled by browser), toggle toolbar
          setToolbarVisible((v) => !v)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleProgressChange = useCallback(
    (progress: string) => {
      if (!currentUser || !currentBook) return

      // Parse progress for display
      // PDF:  @@pageNum@@totalPages   -> pageNum/totalPages
      // EPUB: @@chapterIndex@@scrollFraction@@page@@pages@@totalSections -> page-level
      // TXT:  @@scrollFraction@@1    -> scrollFraction (0-1)
      const parts = progress.split('@@').filter(Boolean)
      if (parts.length >= 2) {
        const first = parseFloat(parts[0])
        const second = parseFloat(parts[1])
        if (currentBook.format === 'pdf' && second > 0) {
          setProgressPercent(Math.round((first / second) * 100))
          setPageInfo(`${Math.round(first)} / ${Math.round(second)}`)
        } else if (currentBook.format === 'txt') {
          setProgressPercent(Math.round(first * 100))
          setPageInfo('')
        } else {
          // EPUB — check if page info is included
          if (parts.length >= 5) {
            const page = parseInt(parts[2], 10)
            const pagesInSection = parseInt(parts[3], 10)
            const totalSections = parseInt(parts[4], 10)
            // Use fraction for overall percentage
            setProgressPercent(Math.round(second * 100))
            setPageInfo(`${page}/${pagesInSection} · Ch ${first + 1}/${totalSections}`)
          } else {
            setProgressPercent(Math.round(second * 100))
            setPageInfo('')
          }
        }
      }

      // Update store + persist (strip page info, only save position data)
      const positionParts = progress.split('@@').filter(Boolean).slice(0, 2)
      const positionProgress = `@@${positionParts.join('@@')}`
      updateBookProgress(currentBook.id, positionProgress)
      api.books.updateProgress(currentUser.id, currentBook.id, positionProgress, currentBook.format).catch(() => {
        // Progress save failed silently
      })
    },
    [currentUser, currentBook, updateBookProgress]
  )

  if (!currentBook || !currentUser) return null

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
      {/* Top toolbar — slides up when hidden */}
      <AppBar
        position="static"
        sx={{
          height: toolbarVisible ? TOOLBAR_HEIGHT : 0,
          minHeight: 0,
          bgcolor: '#111',
          boxShadow: 'none',
          overflow: 'hidden',
          transition: 'height 0.2s ease',
        }}
      >
        <Toolbar
          variant="dense"
          sx={{ minHeight: TOOLBAR_HEIGHT, height: TOOLBAR_HEIGHT, px: 1 }}
        >
          <IconButton
            color="inherit"
            size="small"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
              navigate('/library')
            }}
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
            {pageInfo ? `${pageInfo} · ` : ''}{progressPercent}%
          </Typography>
          <IconButton
            color="inherit"
            size="small"
            onClick={toggleFullscreen}
            sx={{ ml: 0.5 }}
          >
            {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
          <IconButton
            color="inherit"
            size="small"
            onClick={() => setSettingsOpen(true)}
            sx={{ ml: 0.5 }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Reader area */}
      <Box ref={readerAreaRef} sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        {format === 'epub' && (
          <EpubReader
            ref={readerRef as React.Ref<EpubReaderHandle>}
            bookId={bookIdStr}
            userId={currentUser.id}
            initialProgress={currentBook.progress}
            writingMode={settings.writingMode}
            fontSize={settings.fontSize}
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
