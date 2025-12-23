/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    // This line MUST be exactly right to include your JSX/TSX files
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};