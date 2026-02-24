/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "tg-bg": "var(--tg-theme-bg-color, #000000)",
        "tg-text": "var(--tg-theme-text-color, #ffffff)",
        "tg-hint": "var(--tg-theme-hint-color, #999999)",
        "tg-link": "var(--tg-theme-link-color, #5eaaef)",
        "tg-button": "var(--tg-theme-button-color, #5eaaef)",
        "tg-button-text": "var(--tg-theme-button-text-color, #ffffff)",
        "tg-secondary-bg": "var(--tg-theme-secondary-bg-color, #111111)",
        "tg-section-bg": "var(--tg-theme-section-bg-color, #1a1a1a)",
        "tg-section-header": "var(--tg-theme-section-header-text-color, #999999)",
        "tg-separator": "var(--tg-theme-section-separator-color, #222222)",
        "tg-accent": "var(--tg-theme-accent-text-color, #5eaaef)",
        "tg-destructive": "var(--tg-theme-destructive-text-color, #ff4444)",
      },
    },
  },
  plugins: [],
};
