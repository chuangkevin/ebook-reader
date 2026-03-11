import type { TapZoneLayout } from '../store/settingsSlice';

/**
 * Determine action based on tap position and layout preference.
 * @param zone 0-1, horizontal position within container
 * @param layout tap zone layout setting
 */
export function getTapAction(
  zone: number,
  layout: TapZoneLayout,
): 'prev' | 'next' | 'toggle' {
  if (zone >= 0.3 && zone <= 0.7) return 'toggle';

  const isLeftZone = zone < 0.3;

  switch (layout) {
    case 'left-hand':
      // Left-hand: left tap = next (thumb forward), right tap = prev
      return isLeftZone ? 'next' : 'prev';
    case 'right-hand':
    case 'default':
    default:
      // Right-hand/default: left tap = prev, right tap = next
      return isLeftZone ? 'prev' : 'next';
  }
}
