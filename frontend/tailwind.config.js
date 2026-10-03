/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        office: {
          charcoal: '#14141e',
          void: '#1a1c29',
          nightFloor: '#282d3f',
          dayFloor: '#475069',
          floorLight: '#687594',
          coolMetal: '#9ca8b8',
          whiteClean: '#f5f0e1',
          jarvisNavy: '#1f3a68',
          daedalusBlue: '#2f6fb3',
          oraclePurple: '#8a4fbf',
          merlinAmber: '#b5652b',
          museRose: '#e0567a',
          prismCyan: '#2bb3c0',
          forgeOrange: '#d9622b',
          vectorGreen: '#3fa66b',
          sentinelRed: '#d23c3c',
          bastionSlate: '#6b7785',
          relayIndigo: '#6d5bd0',
          wardenOlive: '#8e8e3a',
          stewardLime: '#9cc23a',
          scribeBrown: '#7a4a2e',
          novaGold: '#f2c230',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
