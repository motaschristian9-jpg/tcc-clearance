/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tcc: {
          blue: '#1E3A8A', // Official TCC Navy Blue
          gold: '#F59E0B', // TCC Accent Gold
          dark: '#0F172A',
        },
        status: {
          accept: '#16a34a',
          flag: '#d97706',
          reject: '#dc2626',
        }
      },
      minHeight: {
        'touch': '48px',
      },
      minWidth: {
        'touch': '48px',
      }
    },
  },
  plugins: [],
}

