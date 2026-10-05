// SIG-SCOPE Design Tokens - Modern Translucent Glassmorphism
// Light & Dark Themes, Pill-Shaped Controls, Purple #6D3AE8, Lime #C6F432

export const tokens = {
  light: {
    bgApp: '#F4F7FB',
    bgAppGradient: 'radial-gradient(1100px 750px at 2% 2%, rgba(109, 58, 232, 0.10) 0%, transparent 60%), radial-gradient(1000px 750px at 98% 4%, rgba(22, 163, 74, 0.10) 0%, transparent 55%), radial-gradient(950px 800px at 50% 95%, rgba(14, 165, 233, 0.08) 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #EEF3F8 100%)',
    bgCard: 'rgba(255, 255, 255, 0.12)',
    bgCardElevated: 'rgba(255, 255, 255, 0.20)',
    bgTile: 'rgba(255, 255, 255, 0.10)',
    bgTileHover: 'rgba(255, 255, 255, 0.26)',
    bgPill: 'rgba(0, 0, 0, 0.04)',
    bgPillActive: 'linear-gradient(135deg, #6D3AE8 0%, #5826C6 100%)',
    bgPillActiveText: '#FFFFFF',
    bgCanvas: 'rgba(255, 255, 255, 0.15)',

    borderHairline: 'rgba(0, 0, 0, 0.06)',
    borderCard: 'rgba(255, 255, 255, 0.65)',
    borderMuted: 'rgba(0, 0, 0, 0.10)',

    accentPurple: '#6D3AE8',
    accentPurpleLight: '#8B5CF6',
    accentPurpleDark: '#3B2078',
    accentPurpleGlow: 'rgba(109, 58, 232, 0.15)',

    accentLime: '#16A34A',
    accentLimeVibrant: '#C6F432',
    accentLimeGlow: 'rgba(22, 163, 74, 0.2)',

    accentAmber: '#D97706',
    accentRed: '#DC2626',

    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',

    shadowCard: '0 16px 36px -6px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02), inset 0 1px 1px 0 rgba(255, 255, 255, 0.85)',
  },

  radii: {
    pill: '999px',
    card: '26px',
    tile: '16px',
    sm: '8px',
  },

  blur: {
    card: 'blur(24px)',
    tile: 'blur(16px)',
  }
};
