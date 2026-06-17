/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        prasha: {
          navy: "#0d1b2a",
          gold: "#caa13d",
          tan: "#d4c5a9",
          slate: "#0b132b",
          accent: "#1b263b",
          light: "#e2e8f0"
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
