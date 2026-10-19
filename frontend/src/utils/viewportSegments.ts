const HINGE_GAP_PROBE = 'max(80px, calc(env(viewport-segment-left 1 0, 50vw) - env(viewport-segment-width 0 0, 50vw)))'

// Minimum blank space reserved at the centre of a two-page spread so text never
// runs into the physical hinge of a folding device. Applied even when the
// browser does not expose `viewport-segment-*` values.
export const MIN_SPREAD_GUTTER = 80

// Extra clearance kept between a single-page pane and the hinge that borders it.
export const HINGE_CLEARANCE = 48

export interface ViewportSegment {
  left: number
  width: number
  top: number
  height: number
}

export interface HorizontalViewportSegments {
  first: ViewportSegment
  second: ViewportSegment
  hingeGap: number
}

// Portrait-spanned foldables stack their screens top/bottom with a horizontal
// hinge between them.
export interface StackedViewportSegments {
  top: ViewportSegment
  bottom: ViewportSegment
  hingeGap: number
}

export interface ViewportSegments {
  horizontal: HorizontalViewportSegments | null
  stacked: StackedViewportSegments | null
}

export function getReaderPaneBounds(
  pageLayout: 'single' | 'spread',
  segments: ViewportSegments | null,
): ViewportSegment | null {
  if (pageLayout !== 'single' || !segments) return null
  if (segments.horizontal) return segments.horizontal.first
  if (segments.stacked) return segments.stacked.top
  return null
}

export function resolveHorizontalViewportSegments(
  first: ViewportSegment,
  second: ViewportSegment,
): HorizontalViewportSegments | null {
  if (first.width <= 0 || second.width <= 0 || first.height <= 0 || second.height <= 0) return null
  if (Math.abs(first.top - second.top) > 2 || Math.abs(first.height - second.height) > 2 || second.left <= first.left) return null
  return {
    first,
    second,
    hingeGap: Math.max(0, second.left - (first.left + first.width)),
  }
}

export function resolveStackedViewportSegments(
  first: ViewportSegment,
  second: ViewportSegment,
): StackedViewportSegments | null {
  const [upper, lower] = first.top <= second.top ? [first, second] : [second, first]
  if (upper.height <= 0 || lower.height <= 0 || upper.width <= 0 || lower.width <= 0) return null
  if (upper.height < 240 || lower.height < 240) return null
  if (Math.abs(upper.left - lower.left) > 2 || Math.abs(upper.width - lower.width) > 2) return null
  const hingeGap = lower.top - (upper.top + upper.height)
  if (hingeGap < 0 || hingeGap > 240) return null
  return { top: upper, bottom: lower, hingeGap }
}

// Central gutter for a two-page spread: the detected hinge when available,
// otherwise the reader's requested margin, never less than MIN_SPREAD_GUTTER.
export function spreadGutterPx(hingeGap: number, pageFlowSize: number, gapFraction: number): number {
  return Math.max(hingeGap, pageFlowSize * gapFraction, MIN_SPREAD_GUTTER)
}

function readViewportSegment(column: number, row: number) {
  if (typeof document === 'undefined') return null
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;left:env(viewport-segment-left ${column} ${row}, 0px);top:env(viewport-segment-top ${column} ${row}, 0px);width:env(viewport-segment-width ${column} ${row}, 0px);height:env(viewport-segment-height ${column} ${row}, 0px)`
  document.body.appendChild(probe)
  const { left, top, width, height } = probe.getBoundingClientRect()
  probe.remove()
  return { left, top, width, height }
}

export function measureViewportSegments(): ViewportSegments {
  const simulated = simulatedViewportSegments()
  if (simulated) return simulated
  const first = readViewportSegment(0, 0)
  const second = readViewportSegment(1, 0)
  if (!first || !second) return { horizontal: null, stacked: null }
  return {
    horizontal: resolveHorizontalViewportSegments(first, second),
    stacked: resolveStackedViewportSegments(first, second),
  }
}

// Duo simulator support: the local duo-simulator page loads the app in a
// Duo-sized iframe and passes ?duoSim=<mode>. Report the simulated segments so
// fold-aware layouts engage exactly like on a physical Surface Duo 1
// (two 672px screens with a 48px hinge gap).
function simulatedViewportSegments(): ViewportSegments | null {
  if (typeof window === 'undefined') return null
  const mode = new URLSearchParams(window.location.search).get('duoSim')
  if (mode === 'landscape-span') {
    const height = window.innerHeight
    const first = { left: 0, width: 672, top: 0, height }
    const second = { left: 720, width: 672, top: 0, height }
    return { horizontal: resolveHorizontalViewportSegments(first, second), stacked: null }
  }
  if (mode === 'portrait-span') {
    const width = window.innerWidth
    const first = { left: 0, width, top: 0, height: 672 }
    const second = { left: 0, width, top: 720, height: 672 }
    return { horizontal: null, stacked: resolveStackedViewportSegments(first, second) }
  }
  return null
}

export function measureHorizontalViewportSegments(): HorizontalViewportSegments | null {
  return measureViewportSegments().horizontal
}

export function measureViewportHingeGap(): number {
  const segments = measureHorizontalViewportSegments()
  if (segments) return Math.max(MIN_SPREAD_GUTTER, segments.hingeGap)
  if (typeof document === 'undefined') return MIN_SPREAD_GUTTER
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;width:${HINGE_GAP_PROBE};height:0;inset:0 auto auto 0`
  document.body.appendChild(probe)
  const width = Number.parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return Number.isFinite(width) ? width : MIN_SPREAD_GUTTER
}
