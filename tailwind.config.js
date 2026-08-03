/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        taupe: '#B8A99A',
        'taupe-dark': '#8B7355',
        'dedecker-dark': '#2d2d2d',
        'dedecker-light': '#f9f7f5',
        'dedecker-bg': '#f0ebe6',
      },
    },
  },
  plugins: [],
};
