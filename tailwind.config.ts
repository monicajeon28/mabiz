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
      screens: {
        xs: "375px",
      },
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
        /* 기본 폰트: Noto Sans KR (본문) */
        sans: [
          "var(--font-noto-sans-kr)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        /* 제목 폰트: Noto Sans KR Weight 600/700 (헤드라인) */
        heading: [
          "var(--font-noto-sans-kr)",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        /* 고정폭 폰트: 코드 표시 */
        mono: ["Menlo", "Monaco", "Courier New", "monospace"],
      },
      fontSize: {
        /* 용도별 폰트 크기 + 라인높이 + 레터스페이싱 */
        display: ["32px", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        h1: ["28px", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        h2: ["24px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        h3: ["20px", { lineHeight: "1.4", letterSpacing: "0" }],
        body: ["16px", { lineHeight: "1.7" }],
        "body-sm": ["14px", { lineHeight: "1.6" }],
        label: ["13px", { lineHeight: "1.4" }],
        caption: ["12px", { lineHeight: "1.4" }],
      },
      fontWeight: {
        body: 400,
        semibold: 600,
        bold: 700,
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.6s ease-out forwards',
        fadeInDown: 'fadeInDown 0.6s ease-out forwards',
        fadeInLeft: 'fadeInLeft 0.6s ease-out forwards',
        fadeInRight: 'fadeInRight 0.6s ease-out forwards',
        scaleIn: 'scaleIn 0.6s ease-out forwards',
        slideInUp: 'slideInUp 0.7s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
