import * as OpenCC from 'opencc-js'

type ConverterFn = (text: string) => string

// Lazily initialized and cached converters
let tw2sConverter: ConverterFn | null = null
let s2twConverter: ConverterFn | null = null

function getConverter(mode: 'tw2s' | 's2tw'): ConverterFn {
  if (mode === 'tw2s') {
    if (!tw2sConverter) {
      tw2sConverter = OpenCC.Converter({ from: 'tw', to: 'cn' })
    }
    return tw2sConverter
  } else {
    if (!s2twConverter) {
      s2twConverter = OpenCC.Converter({ from: 'cn', to: 'tw' })
    }
    return s2twConverter
  }
}

/**
 * Converts all text nodes in the given document using the specified OpenCC mode.
 * Uses TreeWalker for efficient traversal and only processes nodes with non-whitespace content.
 */
export async function convertDoc(doc: Document, mode: 'tw2s' | 's2tw'): Promise<void> {
  if (!doc?.body) return

  const converter = getConverter(mode)

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  let node: Node | null = walker.nextNode()
  while (node !== null) {
    textNodes.push(node as Text)
    node = walker.nextNode()
  }

  for (const textNode of textNodes) {
    const content = textNode.textContent
    if (content && content.trim().length > 0) {
      textNode.textContent = converter(content)
    }
  }
}
