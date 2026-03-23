import { unzipSync } from 'fflate'

/**
 * Extract book title from a File object before uploading.
 * - EPUB: parse container.xml → OPF → <dc:title>
 * - TXT: filename without extension
 * - PDF / other: return null (caller falls back to filename)
 */
export async function extractBookTitle(file: File): Promise<string | null> {
  try {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.txt')) {
      return file.name.replace(/\.txt$/i, '')
    }
    if (lower.endsWith('.epub')) {
      return extractEpubTitle(file)
    }
    return null
  } catch {
    return null
  }
}

async function extractEpubTitle(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    // Decompress only the files we need; case-insensitive path matching
    let unzipped: ReturnType<typeof unzipSync>
    try {
      unzipped = unzipSync(data, {
        filter: (f) => {
          const n = f.name.toLowerCase()
          return n === 'meta-inf/container.xml' || n.endsWith('.opf')
        },
      })
    } catch {
      return null
    }

    // Find container.xml with case-insensitive key lookup
    const containerKey = Object.keys(unzipped).find(
      k => k.toLowerCase() === 'meta-inf/container.xml'
    )
    let opfPath: string | null = null

    if (containerKey) {
      const containerXml = new TextDecoder().decode(unzipped[containerKey])
      // Support both single and double quotes around full-path attribute
      const m = containerXml.match(/full-path=["']([^"']+)["']/i)
      if (m) opfPath = m[1]
    }

    // Find OPF: by resolved path first, then any .opf file as fallback
    let opfKey: string | null = null
    if (opfPath) {
      opfKey = Object.keys(unzipped).find(
        k => k === opfPath || k.toLowerCase() === opfPath!.toLowerCase()
      ) ?? null
    }
    if (!opfKey) {
      opfKey = Object.keys(unzipped).find(k => k.toLowerCase().endsWith('.opf')) ?? null
    }
    if (!opfKey) return null

    const opfXml = new TextDecoder().decode(unzipped[opfKey])
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
    return titleMatch ? titleMatch[1].trim() : null
  } catch {
    return null
  }
}
