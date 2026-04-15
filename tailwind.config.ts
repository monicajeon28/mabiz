import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#1E2D4E",
          700: "#2A4080",
          500: "#3B5BA5",
          100: "#EEF2FF",
        },
        gold: {
          500: "#C9A84C",
          300: "#E8C96B",
          100: "#FFF3CD",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#1E2D4E",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#F7F8FC",
          foreground: "#1E2D4E",
        },
        muted: {
          DEFAULT: "#F7F8FC",
          foreground: "#6B7280",
        },
        accent: {
          DEFAULT: "#C9A84C",
          foreground: "#1E2D4E",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#111827",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};

export default config;
