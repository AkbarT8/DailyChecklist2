/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'papco-navy': '#1a1f6e',
        'papco-navy-dark': '#13175a',
        'papco-red': '#cc1f1f',
        'papco-red-dark': '#a81919',
      },
      fontFamily: {
        sans: ['Aptos Display', 'Aptos', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
