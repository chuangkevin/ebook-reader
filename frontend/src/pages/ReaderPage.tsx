import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Slider,
  Snackbar,
  Toolbar,
  Typography,
} from '@mui/material'
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
import ThemeSwitch from '../components/ThemeSwitch'
import RouteState from '../components/RouteState'
import { useDeviceTheme } from '../theme/deviceTheme'
import { libraryReturn } from '../utils/navigation'
import { recoverProgress, saveProgress, waitForProgress } from '../utils/readingProgress'
import type { TocItem } from '../types'

const TOOLBAR_HEIGHT = 56

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const panel = params.get('panel')
  const setPanel = (value?: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('panel', value)
    else next.delete('panel')
    setParams(next)
  }
  const settingsOpen = panel === 'settings'
  const tocOpen = panel === 'contents'
  const bookmarksOpen = panel === 'bookmarks'
  const { mode, paper } = useDeviceTheme()
  const readingTheme = paper === 'sepia' && mode === 'light' ? 'sepia' : mode
  const [loadError, setLoadError] = useState('')
  const [loadedKey, setLoadedKey] = useState('')
  const [attempt, setAttempt] = useState(0)
  const currentBook = useBookStore((s) => s.currentBook)
  const setCurrentBook = useBookStore((s) => s.setCurrentBook)
  const updateBookProgress = useBookStore((s) => s.updateBookProgress)
  const currentUser = useUserStore((s) => s.currentUser)
  const { settings, setSettings } = useSettingsStore()

  const readerRef = useRef<EpubReaderHandle | PdfReaderHandle | TxtReaderHandle>(null)
  const readerAreaRef = useRef<HTMLDivElement>(null)
  const [progressPercent, setProgressPercent] = useState(0)
  const [toc, setToc] = useState<TocItem[]>([])
  const [bookLoading, setBookLoading] = useState(false)
  const [pageBookmarks, setPageBookmarks] = useState<PageBookmark[]>([])
  const [snackMsg, setSnackMsg] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const currentProgressStringRef = useRef('')

  useSwipeNavigation(
    readerAreaRef,
    () => readerRef.current?.next(),
    () => readerRef.current?.prev()
  )

  // Resolve both the URL book and this reader's position before mounting an engine.
  useEffect(() => {
    if (!currentUser || !bookId) return
    let active = true
    setBookLoading(true)
    setLoadError('')
    Promise.all([
      api.books.get(bookId),
      waitForProgress(currentUser.id, bookId).then(() => api.books.getUserProgress(currentUser.id)),
      api.settings.get(currentUser.id),
    ])
      .then(([book, progress, remoteSettings]) => {
        if (!active) return
        const saved = progress.find((item) => String(item.bookId) === String(bookId))
        const position = recoverProgress(currentUser.id, bookId, saved)
        const { theme: _remoteTheme, ...layout } = remoteSettings
        void _remoteTheme
        setSettings(layout)
        setCurrentBook({ ...book, progress: position })
        currentProgressStringRef.current = position ?? ''
        setProgressPercent(saved?.percentage ?? 0)
        setLoadedKey(`${currentUser.id}/${bookId}`)
      })
      .catch(() => {
        if (active) setLoadError('無法開啟這本書。書籍可能已移除，或連線暫時中斷。')
      })
      .finally(() => {
        if (active) setBookLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentUser, bookId, setSettings, setCurrentBook, attempt])

  // Load page bookmarks
  useEffect(() => {
    if (!currentUser || !bookId) return
    let active = true
    api.pageBookmarks
      .list(currentUser.id, bookId)
      .then((items) => {
        if (active) setPageBookmarks(items)
      })
      .catch(() => {
        if (active) setPageBookmarks([])
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, bookId])

  async function addBookmark() {
    if (!currentUser || !bookId || !currentProgressStringRef.current) return
    try {
      const bm = await api.pageBookmarks.add(
        currentUser.id,
        bookId,
        currentProgressStringRef.current,
        `${progressPercent}%`
      )
      setPageBookmarks((prev) => [bm, ...prev])
      setSnackMsg(`已加入書籤 (${progressPercent}%)`)
    } catch {
      /* ignore */
    }
  }

  async function removeBookmark(id: string) {
    try {
      await api.pageBookmarks.remove(id)
      setPageBookmarks((prev) => prev.filter((b) => b.id !== id))
    } catch {
      /* ignore */
    }
  }

  function goToBookmark(position: string) {
    // Parse position: @@index@@fraction@@...
    const parts = position.split('@@').filter(Boolean)
    if (parts.length >= 2) {
      const index = parseInt(parts[0])
      const fraction = parseFloat(parts[1])
      const paginator = readerRef.current
      // Use paginator directly for EPUB
      if (currentBook?.format === 'pdf') {
        void paginator?.goTo(String(index))
      } else if (currentBook?.format === 'txt') {
        void paginator?.goToFraction(parseFloat(parts[0]))
      } else if (paginator?.goTo) {
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
    setPanel()
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (panel || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target as HTMLElement | null
      if (
        target?.closest(
          'button, a, input, textarea, select, [contenteditable="true"], [role="slider"]'
        )
      )
        return
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
  }, [panel])

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
      saveProgress(currentUser.id, currentBook.id, progress, currentBook.format).catch(() => {
        setSnackMsg('進度暫存於本機，連線恢復後繼續閱讀即可同步。')
      })
    },
    [currentUser, currentBook, updateBookProgress]
  )

  if (!currentUser) return null
  if (loadError)
    return (
      <RouteState
        title="這本書暫時無法開啟"
        message={loadError}
        retry={() => setAttempt((v) => v + 1)}
      />
    )
  if (bookLoading || !currentBook || loadedKey !== `${currentUser.id}/${bookId}`)
    return <RouteState loading title="正在回到上次的閱讀位置" />

  const bookIdStr = bookId ?? ''
  const format = currentBook.format

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {/* Top toolbar */}
      <AppBar
        position="static"
        sx={{
          height: fullscreen ? 0 : TOOLBAR_HEIGHT,
          minHeight: fullscreen ? 0 : TOOLBAR_HEIGHT,
          overflow: 'hidden',
          transition: 'height 0.15s ease, min-height 0.15s ease',
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: TOOLBAR_HEIGHT, height: TOOLBAR_HEIGHT, px: 1 }}>
          <IconButton
            color="inherit"
            size="small"
            aria-label="返回書庫"
            onClick={() => navigate(libraryReturn(params.get('from')))}
            sx={{ mr: 0.5 }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <IconButton
            color="inherit"
            size="small"
            aria-label="目錄"
            onClick={() => setPanel('contents')}
            sx={{ mr: 1 }}
          >
            <MenuBookIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="body2"
            sx={{
              flexGrow: 1,
              minWidth: 0,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentBook.title}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              ml: 1,
              flexShrink: 0,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            {progressPercent}%
          </Typography>
          <ThemeSwitch />
          <IconButton
            color="inherit"
            size="small"
            onClick={addBookmark}
            title="加書籤"
            aria-label="加書籤"
          >
            <BookmarkAddIcon fontSize="small" />
          </IconButton>
          <IconButton
            color="inherit"
            size="small"
            onClick={() => setPanel('bookmarks')}
            title="書籤列表"
            aria-label="書籤列表"
          >
            <BookmarkIcon fontSize="small" />
          </IconButton>
          <IconButton
            color="inherit"
            size="small"
            aria-label="閱讀設定"
            onClick={() => setPanel('settings')}
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
          bgcolor:
            readingTheme === 'dark' ? '#1a1a1a' : readingTheme === 'sepia' ? '#f5ecd7' : '#ffffff',
        }}
      >
        {/* Floating fullscreen toggle button */}
        <IconButton
          aria-label={fullscreen ? '離開全螢幕' : '全螢幕閱讀'}
          onClick={() => setFullscreen((f) => !f)}
          size="small"
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 20,
            color: 'text.secondary',
            bgcolor: 'background.paper',
            '&:hover': { color: readingTheme === 'dark' ? '#fff' : '#000' },
          }}
        >
          {fullscreen ? (
            <FullscreenExitIcon fontSize="small" />
          ) : (
            <FullscreenIcon fontSize="small" />
          )}
        </IconButton>

        {format === 'epub' && (
          <EpubReader
            key={`${currentUser.id}/${bookId}`}
            ref={readerRef as React.Ref<EpubReaderHandle>}
            bookId={bookIdStr}
            userId={currentUser.id}
            initialProgress={currentBook.progress}
            writingMode={settings.writingMode}
            fontSize={settings.fontSize}
            gap={settings.gap}
            theme={readingTheme}
            tapZoneLayout={settings.tapZoneLayout}
            openccMode={settings.openccMode}
            onCenterTap={() => {
              /* reserved */
            }}
            onProgressChange={handleProgressChange}
            onTocLoad={setToc}
          />
        )}

        {format === 'pdf' && (
          <PdfReader
            key={`${currentUser.id}/${bookId}`}
            ref={readerRef as React.Ref<PdfReaderHandle>}
            theme={readingTheme}
            bookId={bookIdStr}
            userId={currentUser.id}
            initialProgress={currentBook.progress}
            writingMode={settings.writingMode}
            fontSize={settings.fontSize}
            tapZoneLayout={settings.tapZoneLayout}
            onCenterTap={() => {
              /* reserved */
            }}
            onProgressChange={handleProgressChange}
          />
        )}

        {format === 'txt' && (
          <TxtReader
            key={`${currentUser.id}/${bookId}`}
            ref={readerRef as React.Ref<TxtReaderHandle>}
            theme={readingTheme}
            bookId={bookIdStr}
            userId={currentUser.id}
            initialProgress={currentBook.progress}
            writingMode={settings.writingMode}
            fontSize={settings.fontSize}
            tapZoneLayout={settings.tapZoneLayout}
            onCenterTap={() => {
              /* reserved */
            }}
            onProgressChange={handleProgressChange}
          />
        )}
      </Box>

      {/* Page slider */}
      {!fullscreen && (
        <Box
          sx={{
            px: 2,
            py: 0.5,
            bgcolor:
              readingTheme === 'dark' ? '#111' : readingTheme === 'sepia' ? '#e8dcc8' : '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Slider
            aria-label="閱讀進度"
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
              color: readingTheme === 'dark' ? '#888' : '#666',
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
              color: readingTheme === 'dark' ? '#aaa' : '#666',
            }}
          >
            {progressPercent}%
          </Typography>
        </Box>
      )}

      <ReaderSettings open={settingsOpen} onClose={() => setPanel()} userId={currentUser.id} />

      <TocDrawer
        open={tocOpen}
        onClose={() => setPanel()}
        toc={toc}
        onNavigate={(href) => {
          readerRef.current?.goTo(href)
        }}
      />

      {/* 書籤列表 Drawer */}
      <Drawer
        anchor="right"
        open={bookmarksOpen}
        onClose={() => setPanel()}
        PaperProps={{ sx: { width: 280, bgcolor: 'background.paper', color: 'text.primary' } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
          <Typography component="h2" variant="h6">
            書籤 ({pageBookmarks.length})
          </Typography>
          <IconButton aria-label="關閉書籤" onClick={() => setPanel()}>
            <ArrowBackIcon />
          </IconButton>
        </Box>
        {pageBookmarks.length === 0 ? (
          <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
            尚無書籤。點擊工具列的 + 書籤按鈕加入。
          </Typography>
        ) : (
          <List dense>
            {pageBookmarks.map((bm) => (
              <ListItem
                key={bm.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label="刪除書籤"
                    onClick={() => removeBookmark(bm.id)}
                    sx={{ color: 'text.secondary' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
                disablePadding
              >
                <ListItemButton onClick={() => goToBookmark(bm.position)}>
                  <ListItemText
                    primary={bm.label || '書籤'}
                    secondary={new Date(bm.createdAt).toLocaleString('zh-TW')}
                    primaryTypographyProps={{ sx: { color: 'text.primary' } }}
                    secondaryTypographyProps={{ sx: { color: 'text.secondary', fontSize: 11 } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Drawer>

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={1500}
        onClose={() => setSnackMsg('')}
        message={snackMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
