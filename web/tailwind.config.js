/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0e1116',
        // indigo-600: passes WCAG AA (≈6.3:1) as text on white, where the old
        // indigo-500 (#6366f1) was 4.47:1 and just missed. Still reads as the
        // same brand indigo for fills and buttons.
        accent: '#4f46e5',
        accent2: '#22d3ee',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        prose2: '70ch',
      },
    },
  },
  plugins: [],
}
