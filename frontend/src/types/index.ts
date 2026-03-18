export interface User {
  id: string
  name: string
  avatar?: string
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
}

export interface ReadingProgress {
  chapterIndex: number
  scrollFraction: number
}

export interface ReaderSettings {
  writingMode: 'vertical-rl' | 'horizontal-tb'
  fontSize: number  // px, default 18
  theme: 'light' | 'sepia' | 'dark'
  openccMode: 'none' | 'tw2s' | 's2tw'
  tapZoneLayout: 'default' | 'bottom-next' | 'bottom-prev'
}

export interface TocItem {
  label: string
  href: string
  subitems?: TocItem[]
}
