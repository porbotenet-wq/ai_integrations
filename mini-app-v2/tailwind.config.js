/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "tg-bg": "var(--tg-theme-bg-color, #0a0a0f)",
        "tg-text": "var(--tg-theme-text-color, #e8e8ed)",
        "tg-hint": "var(--tg-theme-hint-color, #666680)",
        "tg-link": "var(--tg-theme-link-color, #60a5fa)",
        "tg-button": "var(--tg-theme-button-color, #60a5fa)",
        "tg-button-text": "var(--tg-theme-button-text-color, #ffffff)",
        "tg-secondary-bg": "var(--tg-theme-secondary-bg-color, #0f0f17)",
        "tg-section-bg": "var(--tg-theme-section-bg-color, #111118)",
        "tg-section-header": "var(--tg-theme-section-header-text-color, #666680)",
        "tg-separator": "var(--tg-theme-section-separator-color, #1e1e2a)",
        "tg-accent": "var(--tg-theme-accent-text-color, #60a5fa)",
        "tg-destructive": "var(--tg-theme-destructive-text-color, #f87171)",
        // Status colors
        "status-blue": "#60a5fa",
        "status-green": "#34d399",
        "status-yellow": "#fbbf24",
        "status-red": "#f87171",
        "status-orange": "#fb923c",
        // Surface colors
        "surface-0": "#0a0a0f",
        "surface-1": "#111118",
        "surface-2": "#16161f",
        "surface-3": "#1e1e2a",
      },
      fontSize: {
        "2xs": ["10px", "14px"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
    },
  },
  plugins: [],
};
