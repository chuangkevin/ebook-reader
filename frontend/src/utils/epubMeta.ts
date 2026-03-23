import { unzipSync } from 'fflate'

/**
 * Extract book title from a File object before uploading.
 * - EPUB: parse container.xml → OPF → <dc:title>
 * - TXT: filename without extension
 * - PDF / other: return null (fallback to filename)
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

    // PDF and others: no client-side extraction
    return null
  } catch {
    return null
  }
}

async function extractEpubTitle(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    // Only decompress the two files we need
    const unzipped = unzipSync(data, {
      filter: (f) =>
        f.name === 'META-INF/container.xml' || f.name.endsWith('.opf'),
    })

    // Parse container.xml to find OPF path
    const containerBytes = unzipped['META-INF/container.xml']
    if (!containerBytes) return null

    const containerXml = new TextDecoder().decode(containerBytes)
    const opfPathMatch = containerXml.match(/full-path="([^"]+\.opf)"/i)
    if (!opfPathMatch) return null

    const opfPath = opfPathMatch[1]
    const opfBytes = unzipped[opfPath]
    if (!opfBytes) return null

    // Parse <dc:title> from OPF
    const opfXml = new TextDecoder().decode(opfBytes)
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
    return titleMatch ? titleMatch[1].trim() : null
  } catch {
    return null
  }
}
