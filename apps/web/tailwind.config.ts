import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3C3489', // Основний колір кнопок з Design System
          hover: '#26215C',   // Колір при наведенні
        },
        secondary: '#EEEDFE', // Світлий акцентний фон
        danger: '#D85A30',
        success: '#0F6E56',
      },
    },
  },
  plugins: [],
};
export default config;