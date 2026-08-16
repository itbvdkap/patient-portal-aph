import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#e6f3f0",
          100: "#c8e7e0",
          600: "#006f67",
          700: "#005b55",
          900: "#073c39"
        },
        cream: {
          50: "#fffaf1",
          100: "#f8efdf",
          200: "#eadcc8"
        },
        ink: "#17312f"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "Helvetica", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "Consolas", "monospace"]
      },
      boxShadow: {
        soft: "0 10px 30px rgba(7, 60, 57, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
