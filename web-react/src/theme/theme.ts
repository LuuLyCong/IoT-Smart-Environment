import { createTheme, ThemeOptions } from '@mui/material/styles'

export const TOKENS = {
  bgBase: '#0B0F1E',
  bgElevated: '#121833',
  bgCard: 'rgba(24, 30, 62, 0.55)',
  borderGlass: 'rgba(160, 190, 255, 0.16)',

  neonBlue: '#6FE7FF',
  neonBlueSoft: '#A5F3FF',
  neonBlueDeep: '#4D9DFF',
  neonPink: '#FF8FD8',
  neonPinkSoft: '#FFC2EC',
  neonPinkDeep: '#FF5FC4',
  neonViolet: '#B79CFF',

  colorTemp: '#FF8FB8',
  colorHum: '#6FE7FF',
  colorSoil: '#7CFFCB',
  colorLux: '#FFE58A',
  colorAlert: '#FF6B9D',
  colorSuccess: '#7CFFCB',
  colorWarning: '#FFD98A',

  textPrimary: '#EAF0FF',
  textSecondary: '#9AA6D1',
  textMuted: '#6B7699',

  gradMain: 'linear-gradient(135deg, #6FE7FF 0%, #B79CFF 50%, #FF8FD8 100%)',
  gradCard: 'linear-gradient(145deg, rgba(28, 36, 75, 0.65) 0%, rgba(18, 24, 52, 0.45) 100%)',
  gradBlue: 'linear-gradient(135deg, #6FE7FF 0%, #4D9DFF 100%)',
  gradPink: 'linear-gradient(135deg, #FF8FD8 0%, #FF5FC4 100%)',

  glowBlue: '0 0 12px rgba(111, 231, 255, 0.55), 0 0 32px rgba(111, 231, 255, 0.25)',
  glowPink: '0 0 12px rgba(255, 143, 216, 0.55), 0 0 32px rgba(255, 143, 216, 0.25)',
  glowViolet: '0 0 12px rgba(183, 156, 255, 0.55), 0 0 32px rgba(183, 156, 255, 0.25)',
  glowMint: '0 0 12px rgba(124, 255, 203, 0.55), 0 0 32px rgba(124, 255, 203, 0.25)',
}

const getThemeOptions = (mode: 'dark' | 'light'): ThemeOptions => {
  const isDark = mode === 'dark'

  return {
    palette: {
      mode,
      primary: {
        main: TOKENS.neonBlue,
        light: TOKENS.neonBlueSoft,
        dark: TOKENS.neonBlueDeep,
        contrastText: '#0B0F1E',
      },
      secondary: {
        main: TOKENS.neonPink,
        light: TOKENS.neonPinkSoft,
        dark: TOKENS.neonPinkDeep,
        contrastText: '#0B0F1E',
      },
      error: {
        main: TOKENS.colorAlert,
        light: '#FFA6C5',
        contrastText: '#0B0F1E',
      },
      warning: {
        main: TOKENS.colorWarning,
        light: '#FFF0B8',
        contrastText: '#0B0F1E',
      },
      info: {
        main: TOKENS.neonViolet,
        light: '#D4C4FF',
        contrastText: '#0B0F1E',
      },
      success: {
        main: TOKENS.colorSuccess,
        light: '#B0FFE0',
        contrastText: '#0B0F1E',
      },
      background: {
        default: isDark ? TOKENS.bgBase : '#F5F7FF',
        paper: isDark ? TOKENS.bgElevated : '#FFFFFF',
      },
      text: {
        primary: isDark ? TOKENS.textPrimary : '#121833',
        secondary: isDark ? TOKENS.textSecondary : '#536288',
      },
      divider: isDark ? TOKENS.borderGlass : 'rgba(111, 140, 220, 0.2)',
    },
    typography: {
      fontFamily: `'Inter', 'Be Vietnam Pro', sans-serif`,
      h1: { fontFamily: `'Orbitron', 'Rajdhani', sans-serif`, letterSpacing: '0.5px', fontWeight: 700 },
      h2: { fontFamily: `'Orbitron', 'Rajdhani', sans-serif`, letterSpacing: '0.5px', fontWeight: 700 },
      h3: { fontFamily: `'Orbitron', 'Rajdhani', sans-serif`, letterSpacing: '0.5px', fontWeight: 700 },
      h4: { fontFamily: `'Orbitron', 'Rajdhani', sans-serif`, letterSpacing: '0.5px', fontWeight: 700 },
      h5: { fontFamily: `'Orbitron', 'Rajdhani', sans-serif`, letterSpacing: '0.5px', fontWeight: 600 },
      h6: { fontFamily: `'Orbitron', 'Rajdhani', sans-serif`, letterSpacing: '0.5px', fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 600, letterSpacing: '0.2px' },
      button: {
        fontFamily: `'Inter', sans-serif`,
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: '0.3px',
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? TOKENS.bgBase : '#F5F7FF',
            color: isDark ? TOKENS.textPrimary : '#121833',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? TOKENS.bgCard : 'rgba(255, 255, 255, 0.85)',
            backgroundImage: isDark ? TOKENS.gradCard : 'none',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${isDark ? TOKENS.borderGlass : 'rgba(111, 140, 220, 0.2)'}`,
            borderRadius: 20,
            boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.45)' : '0 8px 32px 0 rgba(111, 140, 220, 0.15)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            fontWeight: 600,
            padding: '8px 20px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
            },
            '&:active': {
              transform: 'scale(0.97)',
            },
          },
          containedPrimary: {
            background: TOKENS.gradBlue,
            color: '#0B0F1E',
            boxShadow: '0 0 16px rgba(111, 231, 255, 0.4)',
            '&:hover': {
              boxShadow: TOKENS.glowBlue,
            },
          },
          containedSecondary: {
            background: TOKENS.gradPink,
            color: '#0B0F1E',
            boxShadow: '0 0 16px rgba(255, 143, 216, 0.4)',
            '&:hover': {
              boxShadow: TOKENS.glowPink,
            },
          },
          outlinedPrimary: {
            borderColor: TOKENS.neonBlue,
            color: TOKENS.neonBlue,
            borderWidth: 1.5,
            '&:hover': {
              borderWidth: 1.5,
              borderColor: TOKENS.neonBlueSoft,
              backgroundColor: 'rgba(111, 231, 255, 0.1)',
              boxShadow: '0 0 15px rgba(111, 231, 255, 0.3)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isDark ? 'rgba(160, 190, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            padding: '14px 16px',
          },
          head: {
            backgroundColor: isDark ? 'rgba(14, 20, 44, 0.9)' : 'rgba(240, 244, 255, 0.9)',
            color: isDark ? TOKENS.textSecondary : '#536288',
            fontWeight: 700,
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.2s ease',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(111, 231, 255, 0.06) !important' : 'rgba(111, 231, 255, 0.1) !important',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              backgroundColor: isDark ? 'rgba(11, 15, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
              '& fieldset': {
                borderColor: isDark ? 'rgba(160, 190, 255, 0.2)' : 'rgba(111, 140, 220, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: TOKENS.neonBlue,
              },
              '&.Mui-focused fieldset': {
                borderColor: TOKENS.neonBlue,
                borderWidth: 2,
                boxShadow: '0 0 12px rgba(111, 231, 255, 0.35)',
              },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? 'rgba(18, 24, 52, 0.92)' : 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${isDark ? 'rgba(111, 231, 255, 0.3)' : 'rgba(111, 140, 220, 0.3)'}`,
            boxShadow: isDark ? '0 0 40px rgba(11, 15, 30, 0.8), 0 0 20px rgba(111, 231, 255, 0.2)' : '0 20px 60px rgba(0,0,0,0.15)',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backdropFilter: 'blur(10px)',
          },
        },
      },
    },
  }
}

export const darkTheme = createTheme(getThemeOptions('dark'))
export const lightTheme = createTheme(getThemeOptions('light'))
export default darkTheme

