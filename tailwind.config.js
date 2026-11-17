/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pedagogy: {
          theory: '#3b82f6',
          experience: '#10b981',
          reflection: '#8b5cf6',
          quiz: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}
