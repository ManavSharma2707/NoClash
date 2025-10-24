/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Important: Scan jsx files in src
  ],
  theme: {
    extend: {
      fontFamily: {
         sans: ['Inter', 'sans-serif'], // Optional: Use Inter font
      }
    },
  },
  plugins: [],
}