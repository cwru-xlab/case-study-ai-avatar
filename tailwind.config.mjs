import { heroui } from "@heroui/theme";

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        weatherhead: {
          primary: "#003087",
          white: "#FFFFFF",
          softGray: "#F2F2F2",
          textGray: "#555555",
          badgeGreen: "#22c55e",
        },
      },
      spacing: {
        touch: "44px", // Minimum touch target size
      },
      backgroundImage: {
        "avatar-gradient":
          "linear-gradient(to bottom right, #fb923c, #ec4899, #8b5cf6)",
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};

module.exports = config;
