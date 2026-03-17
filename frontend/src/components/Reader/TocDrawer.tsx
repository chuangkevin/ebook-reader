import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'
import type { TocItem } from '../../types'

interface TocDrawerProps {
  open: boolean
  onClose: () => void
  toc: TocItem[]
  onNavigate: (href: string) => void
}

function renderItems(
  items: TocItem[],
  onNavigate: (href: string) => void,
  onClose: () => void,
  depth = 0
): React.ReactNode {
  return items.map((item, idx) => (
    <Box key={`${depth}-${idx}`}>
      <ListItemButton
        onClick={() => {
          onNavigate(item.href)
          onClose()
        }}
        sx={{ pl: 2 + depth * 2 }}
      >
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{ fontSize: depth === 0 ? '0.95rem' : '0.85rem' }}
        />
      </ListItemButton>
      {item.subitems && item.subitems.length > 0 &&
        renderItems(item.subitems, onNavigate, onClose, depth + 1)}
    </Box>
  ))
}

export default function TocDrawer({ open, onClose, toc, onNavigate }: TocDrawerProps) {
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 280 } }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#111',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
          目錄
        </Typography>
      </Box>
      <List dense disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
        {toc.length === 0 ? (
          <ListItemButton disabled>
            <ListItemText primary="無目錄" />
          </ListItemButton>
        ) : (
          renderItems(toc, onNavigate, onClose)
        )}
      </List>
    </Drawer>
  )
}
