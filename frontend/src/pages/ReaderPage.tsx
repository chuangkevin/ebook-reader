import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar, Box, IconButton, Toolbar, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SettingsIcon from '@mui/icons-material/Settings'
import { useBookStore } from '../stores/bookStore'
import { useUserStore } from '../stores/userStore'
import { useSettingsStore } from '../stores/settingsStore'
import { api } from '../services/api.service'
import EpubReader, { type EpubReaderHandle } from '../components/reader/EpubReader'
import ReaderSettings from '../components/reader/ReaderSettings'

const TOOLBAR_HEIGHT = 44

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const currentBook = useBookStore((s) => s.currentBook)
  const updateBookProgress = useBookStore((s) => s.updateBookProgress)
  const currentUser = useUserStore((s) => s.currentUser)
  const { settings, setSettings } = useSettingsStore()

  const readerRef = useRef<EpubReaderHandle>(null)
  const [progressPercent, setProgressPercent] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
      const parts = progress.split('@@').filter(Boolean)
      if (parts.length >= 2) {
        const fraction = parseFloat(parts[1])
        setProgressPercent(Math.round(fraction * 100))
      }

      // Update store + persist
      updateBookProgress(currentBook.id, progress)
      api.books.updateProgress(currentUser.id, currentBook.id, progress).catch(() => {
        // Progress save failed silently
      })
    },
    [currentUser, currentBook, updateBookProgress]
  )

  if (!currentBook || !currentUser) return null

  const bookIdNum = parseInt(bookId ?? '0', 10)

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
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon fontSize="small" />
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
      <Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        <EpubReader
          ref={readerRef}
          bookId={bookIdNum}
          userId={currentUser.id}
          initialProgress={currentBook.progress}
          writingMode={settings.writingMode}
          fontSize={settings.fontSize}
          onProgressChange={handleProgressChange}
        />
      </Box>

      <ReaderSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userId={currentUser.id}
      />
    </Box>
  )
}
