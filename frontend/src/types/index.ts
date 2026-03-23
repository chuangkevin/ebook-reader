export interface User {
  id: string
  name: string
  avatar?: string
  avatarColor?: string
}

export interface Book {
  id: string
  title: string
  author: string
  format: 'epub' | 'pdf' | 'txt'
  coverUrl?: string
  progress?: string  // "@@chapterIndex@@scrollFraction" format
  addedAt: string
  uploadedBy?: string
  collection?: string | null
}

export interface ReadingProgress {
  chapterIndex: number
  scrollFraction: number
}

export interface ReaderSettings {
  writingMode: 'vertical-rl' | 'horizontal-tb'
  fontSize: number  // px, default 18
  gap: number  // fraction of viewport, default 0.06 (6%)
  theme: 'light' | 'sepia' | 'dark'
  openccMode: 'none' | 'tw2s' | 's2tw'
  tapZoneLayout: 'default' | 'bottom-next' | 'bottom-prev'
}

export interface TocItem {
  label: string
  href: string
  subitems?: TocItem[]
}
