/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8A0F13',
          50:  '#FEF2F2',
          100: '#FDE3E3',
          200: '#FCCDCD',
          300: '#F9A8A8',
          400: '#F27476',
          500: '#E84749',
          600: '#D52B2E',
          700: '#B21E21',
          800: '#8A0F13',
          900: '#761316',
          950: '#410507',
        },
        surface: '#FAFAFA',
      },
      fontFamily: {
        satoshi: ["'Satoshi'", '-apple-system', "'Segoe UI'", 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
      },
    },
  },
  plugins: [],
}
