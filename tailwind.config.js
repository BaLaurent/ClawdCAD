/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: {
            dark: '#1a1a2e',
            light: '#F5F5F5',
          },
          surface: {
            dark: '#16213e',
            light: '#FFFFFF',
          },
          primary: '#3B82F6',
          secondary: '#10B981',
          accent: '#F59E0B',
          error: '#EF4444',
          text: {
            dark: '#E5E5E5',
            light: '#1F2937',
          },
          border: {
            dark: '#404040',
            light: '#E5E5E5',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
