/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tisa: {
          purple: '#5A2D82',
          light: '#7B4BA3',
          dark: '#3D1F5C',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both infinite',
        'bounce-slow': 'bounce 2s infinite',
        'float': 'float 2.5s ease-in-out infinite',
      },
      keyframes: {
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0) scale(var(--tw-scale-x, 1))' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0) scale(var(--tw-scale-x, 1))' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0) scale(var(--tw-scale-x, 1))' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0) scale(var(--tw-scale-x, 1))' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}