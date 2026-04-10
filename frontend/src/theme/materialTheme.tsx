// Material Design 3 theme configuration for WeSign
export const materialTheme = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#b5c4ff",
        "on-primary": "#00297a",
        "primary-container": "#003cac",
        "on-primary-container": "#dbe1ff",
        "secondary": "#83d5c7",
        "on-secondary": "#003731",
        "secondary-container": "#005048",
        "on-secondary-container": "#9ff2e3",
        "tertiary": "#bfc5e5",
        "on-tertiary": "#262e48",
        "tertiary-container": "#3f4660",
        "on-tertiary-container": "#dce1ff",
        "error": "#ffb4ab",
        "on-error": "#690005",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",
        "background": "#1a1b22",
        "on-background": "#e3e1ea",
        "surface": "#1a1b22",
        "on-surface": "#e3e1ea",
        "surface-variant": "#454652",
        "on-surface-variant": "#c5c5d4",
        "outline": "#8f909e",
        "outline-variant": "#454652",
        "surface-container-lowest": "#0f0f15",
        "surface-container-low": "#1c1c25",
        "surface-container": "#202029",
        "surface-container-high": "#2b2b34",
        "surface-container-highest": "#36363f",
        "primary-fixed": "#dbe1ff",
        "on-primary-fixed": "#00164d",
        "primary-fixed-dim": "#b5c4ff",
        "on-primary-fixed-variant": "#003cac",
        "secondary-fixed": "#9ff2e3",
        "on-secondary-fixed": "#00201c",
        "secondary-fixed-dim": "#83d5c7",
        "on-secondary-fixed-variant": "#005048",
        "tertiary-fixed": "#dce1ff",
        "on-tertiary-fixed": "#141a32",
        "tertiary-fixed-dim": "#bfc5e5",
        "on-tertiary-fixed-variant": "#3f4660"
      },
      fontFamily: {
        "headline": ["Manrope"],
        "body": ["Inter"],
        "label": ["Inter"]
      },
      borderRadius: {
        "DEFAULT": "0.25rem", 
        "lg": "0.5rem", 
        "xl": "0.75rem", 
        "full": "9999px",
        "2xl": "2rem"
      },
      animation: {
        'ping-once': 'ping 1s cubic-bezier(0, 0, 0.2, 1) 1',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
      },
      keyframes: {
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
};
