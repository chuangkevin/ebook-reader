import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  LinearProgress,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material'
import { api } from '../services/api.service'

export interface UploadFile {
  file: File
  collection: string | null
  resolvedTitle?: string        // extracted from metadata before upload
  preMarkedDuplicate?: boolean  // if true, skip upload and show as duplicate
}

type ItemStatus = 'pending' | 'uploading' | 'done' | 'duplicate' | 'error'

interface UploadItem extends UploadFile {
  status: ItemStatus
  progress: number
  errorMsg?: string
  // resolvedTitle is inherited from UploadFile
}

interface Props {
  open: boolean
  files: UploadFile[]
  userId: string
  onClose: () => void
  onAllDone: () => void
}

const CONCURRENCY = 3

export default function UploadDialog({ open, files, userId, onClose, onAllDone }: Props) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [snackOpen, setSnackOpen] = useState(false)
  const [snackMsg, setSnackMsg] = useState('')
  const startedRef = useRef(false)

  useEffect(() => {
    if (!open) { startedRef.current = false; return }
    setItems(files.map(f => ({
      ...f,
      status: f.preMarkedDuplicate ? 'duplicate' : 'pending',
      progress: 0,
    })))
    startedRef.current = false
  }, [open, files])

  useEffect(() => {
    if (!open || items.length === 0 || startedRef.current) return
    startedRef.current = true
    runUploads()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length])

  async function runUploads() {
    const queue = items.map((_, i) => i).filter(i => items[i].status !== 'duplicate')
    const active = new Set<number>()

    const uploadOne = async (idx: number) => {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'uploading' } : it))
      try {
        await api.books.upload(items[idx].file, userId, {
          collection: items[idx].collection,
          onProgress: (pct) => {
            setItems(prev => prev.map((it, i) => i === idx ? { ...it, progress: pct } : it))
          },
        })
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'done', progress: 100 } : it))
      } catch (e: any) {
        if (e?.status === 409) {
          setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'duplicate', progress: 0 } : it))
        } else {
          setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'error', errorMsg: e?.message } : it))
        }
      }
      active.delete(idx)
    }

    const pump = async () => {
      while (queue.length > 0 || active.size > 0) {
        while (active.size < CONCURRENCY && queue.length > 0) {
          const idx = queue.shift()!
          active.add(idx)
          uploadOne(idx).then(pump)
        }
        if (active.size >= CONCURRENCY || (queue.length === 0 && active.size > 0)) {
          await new Promise(r => setTimeout(r, 200))
        }
      }
      // Refresh library immediately
      onAllDone()
      // Build summary from latest state
      setItems(prev => {
        const done = prev.filter(i => i.status === 'done').length
        const skipped = prev.filter(i => i.status === 'duplicate').length
        const errors = prev.filter(i => i.status === 'error').length
        const parts: string[] = []
        if (done > 0) parts.push(`完成 ${done} 本`)
        if (skipped > 0) parts.push(`跳過 ${skipped} 本`)
        if (errors > 0) parts.push(`失敗 ${errors} 本`)
        setSnackMsg(parts.join(' · ') || '上傳完成')
        setSnackOpen(true)
        return prev
      })
    }
    pump()
  }

  const finishedCount = items.filter(i => ['done', 'duplicate', 'error'].includes(i.status)).length
  const total = items.length
  const pct = total > 0 ? Math.round((finishedCount / total) * 100) : 0
  const allFinished = total > 0 && finishedCount === total

  function handleSnackClose() {
    setSnackOpen(false)
    onClose()
  }

  return (
    <>
      {/* Floating progress card — non-blocking, visible while uploading */}
      {open && !allFinished && total > 0 && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            width: 220,
            p: 1.5,
            zIndex: 1400,
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            上傳中 ({finishedCount}/{total})
          </Typography>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{ borderRadius: 1, height: 6 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">{pct}%</Typography>
          </Box>
        </Paper>
      )}

      {/* Completion toast — auto-dismisses after 5 seconds */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={handleSnackClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackClose}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackMsg}
        </Alert>
      </Snackbar>
    </>
  )
}
