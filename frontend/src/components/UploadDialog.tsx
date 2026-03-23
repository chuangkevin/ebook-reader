import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Dialog, DialogContent, DialogTitle, IconButton,
  LinearProgress, Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import ErrorIcon from '@mui/icons-material/Error'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { api } from '../services/api.service'

export interface UploadFile {
  file: File
  collection: string | null
}

type ItemStatus = 'pending' | 'uploading' | 'done' | 'duplicate' | 'error'

interface UploadItem extends UploadFile {
  status: ItemStatus
  progress: number
  errorMsg?: string
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
  const startedRef = useRef(false)

  useEffect(() => {
    if (!open) { startedRef.current = false; return }
    setItems(files.map(f => ({ ...f, status: 'pending', progress: 0 })))
    startedRef.current = false
  }, [open, files])

  useEffect(() => {
    if (!open || items.length === 0 || startedRef.current) return
    startedRef.current = true
    runUploads()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length])

  async function runUploads() {
    const queue = items.map((_, i) => i)
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
        const status = e?.status
        if (status === 409) {
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
      onAllDone()
    }
    pump()
  }

  const done = items.filter(i => i.status === 'done').length
  const skipped = items.filter(i => i.status === 'duplicate').length
  const errors = items.filter(i => i.status === 'error').length
  const allFinished = items.length > 0 && items.every(i => ['done', 'duplicate', 'error'].includes(i.status))

  return (
    <Dialog open={open} onClose={allFinished ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>上傳書籍 ({done}/{items.length})</span>
        {allFinished && (
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        )}
      </DialogTitle>
      <DialogContent sx={{ maxHeight: 420, overflowY: 'auto' }}>
        {items.map((item, i) => (
          <Box key={i} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.collection ? `${item.collection}/` : ''}{item.file.name}
              </Typography>
              {item.status === 'done' && <CheckCircleIcon color="success" fontSize="small" />}
              {item.status === 'duplicate' && <WarningAmberIcon color="warning" fontSize="small" />}
              {item.status === 'error' && <ErrorIcon color="error" fontSize="small" />}
            </Box>
            {item.status === 'uploading' && (
              <LinearProgress variant="determinate" value={item.progress} sx={{ mt: 0.5 }} />
            )}
            {item.status === 'pending' && (
              <LinearProgress variant="determinate" value={0} sx={{ mt: 0.5, opacity: 0.3 }} />
            )}
            {item.status === 'duplicate' && (
              <Typography variant="caption" color="warning.main">已存在，跳過</Typography>
            )}
            {item.status === 'error' && (
              <Typography variant="caption" color="error">{item.errorMsg || '上傳失敗'}</Typography>
            )}
          </Box>
        ))}
        {allFinished && (
          <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2">
              完成 {done} 本 · 跳過 {skipped} 本 · 失敗 {errors} 本
            </Typography>
          </Box>
        )}
      </DialogContent>
      {allFinished && (
        <Box sx={{ px: 2, pb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} variant="contained">關閉</Button>
        </Box>
      )}
    </Dialog>
  )
}
