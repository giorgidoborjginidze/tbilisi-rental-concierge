import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#bcdcff",
          300: "#8ec6ff",
          400: "#59a6ff",
          500: "#3385fb",
          600: "#1e66f0",
          700: "#1751dc",
          800: "#1a44b2",
          900: "#1b3c8c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
