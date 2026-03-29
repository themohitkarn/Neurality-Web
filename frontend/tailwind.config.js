/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f6f1ea",
        ink: "#1d1620",
        ember: "#db5b38",
        mist: "#fdf8f3",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Instrument Sans'", "sans-serif"],
      },
      boxShadow: {
        lift: "0 24px 80px rgba(42, 24, 31, 0.12)",
        soft: "0 18px 40px rgba(42, 24, 31, 0.08)",
      },
    },
  },
  plugins: [],
};
