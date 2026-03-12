import type { TapMode, HandPreference } from '../store/settingsSlice';

export interface TapZone {
  action: 'prev' | 'next';
  side: 'left' | 'right';
  vertical: 'top' | 'bottom' | 'full';
}

function flip(action: 'prev' | 'next'): 'prev' | 'next' {
  return action === 'prev' ? 'next' : 'prev';
}

/**
 * Get the tap zone layout configuration for overlay rendering.
 */
export function getTapZones(tapMode: TapMode, hand: HandPreference, invert = false): TapZone[] {
  let zones: TapZone[];

  if (tapMode === 'same-side') {
    const side = hand === 'left' ? 'left' : 'right';
    zones = [
      { action: 'prev', side, vertical: 'top' },
      { action: 'next', side, vertical: 'bottom' },
    ];
  } else if (hand === 'left') {
    zones = [
      { action: 'next', side: 'left', vertical: 'full' },
      { action: 'prev', side: 'right', vertical: 'full' },
    ];
  } else {
    zones = [
      { action: 'prev', side: 'left', vertical: 'full' },
      { action: 'next', side: 'right', vertical: 'full' },
    ];
  }

  if (invert) {
    return zones.map(z => ({ ...z, action: flip(z.action) }));
  }
  return zones;
}

/**
 * Determine action based on tap position.
 */
export function getTapAction(
  x: number,
  y: number,
  tapMode: TapMode,
  hand: HandPreference,
  invert = false,
): 'prev' | 'next' | 'toggle' {
  let result: 'prev' | 'next' | 'toggle';

  if (tapMode === 'same-side') {
    const navSide = hand === 'left' ? 'left' : 'right';
    const ZONE_WIDTH = 0.35;

    if (navSide === 'left') {
      if (x < ZONE_WIDTH) {
        result = y < 0.5 ? 'prev' : 'next';
      } else {
        result = 'toggle';
      }
    } else {
      if (x > (1 - ZONE_WIDTH)) {
        result = y < 0.5 ? 'prev' : 'next';
      } else {
        result = 'toggle';
      }
    }
  } else {
    if (x >= 0.3 && x <= 0.7) {
      result = 'toggle';
    } else {
      const isLeftZone = x < 0.3;
      if (hand === 'left') {
        result = isLeftZone ? 'next' : 'prev';
      } else {
        result = isLeftZone ? 'prev' : 'next';
      }
    }
  }

  if (invert && result !== 'toggle') {
    return flip(result);
  }
  return result;
}
