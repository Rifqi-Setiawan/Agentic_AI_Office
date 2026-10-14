/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#141414',
        accent: '#ff7a59',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mc: ['"Pixelify Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
