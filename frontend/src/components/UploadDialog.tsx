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
  const startedFilesRef = useRef<UploadFile[] | null>(null)
  const onAllDoneRef = useRef(onAllDone)
  const mountedRef = useRef(false)

  useEffect(() => { onAllDoneRef.current = onAllDone }, [onAllDone])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    // A batch belongs to the selected files. Route visibility never restarts it.
    if (files.length === 0 || startedFilesRef.current === files) return
    startedFilesRef.current = files
    const batch: UploadItem[] = files.map(file => ({
      ...file,
      status: file.preMarkedDuplicate ? 'duplicate' : 'pending',
      progress: 0,
    }))
    const isCurrent = () => mountedRef.current && startedFilesRef.current === files
    const publish = () => { if (isCurrent()) setItems(batch.map(item => ({ ...item }))) }
    publish()
    const queue = batch.filter(item => item.status === 'pending')

    async function worker() {
      let item: UploadItem | undefined
      while ((item = queue.shift())) {
        const current = item
        current.status = 'uploading'
        publish()
        try {
          await api.books.upload(current.file, userId, {
            collection: current.collection,
            onProgress: pct => { current.progress = pct; publish() },
          })
          current.status = 'done'
          current.progress = 100
        } catch (error: unknown) {
          const failure = error as { status?: number; message?: string }
          current.status = failure?.status === 409 ? 'duplicate' : 'error'
          current.errorMsg = failure?.message
        }
        publish()
      }
    }

    void Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => {
      if (!isCurrent()) return
      onAllDoneRef.current()
      const done = batch.filter(item => item.status === 'done').length
      const skipped = batch.filter(item => item.status === 'duplicate').length
      const errors = batch.filter(item => item.status === 'error').length
      const parts: string[] = []
      if (done > 0) parts.push(`完成 ${done} 本`)
      if (skipped > 0) parts.push(`跳過 ${skipped} 本`)
      if (errors > 0) parts.push(`失敗 ${errors} 本`)
      setSnackMsg(parts.join(' · ') || '上傳完成')
      setSnackOpen(true)
    })
  }, [files, userId])

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
