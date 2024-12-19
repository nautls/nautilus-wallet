/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/extension/connector/index.html",
    "./src/extension/popup/index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["OpenSans"]
      },
      screens: {
        xs: { max: "639px" } // Custom media query for screen sizes smaller than 'sm'
      },
      colors: {
        dark: {
          50: "#4a4a4a",
          100: "#3c3c3c",
          200: "#323232",
          300: "#2d2d2d",
          400: "#222222",
          500: "#1f1f1f",
          600: "#1c1c1e",
          700: "#1b1b1b",
          800: "#181818",
          900: "#0f0f0f"
        },
        light: {
          50: "#fdfdfd",
          100: "#fcfcfc",
          200: "#fafafa",
          300: "#f8f9fa",
          400: "#f6f6f6",
          500: "#f2f2f2",
          600: "#f1f3f5",
          700: "#e9ecef",
          800: "#dee2e6",
          900: "#dde1e3"
        }
      }
    }
  },
  plugins: []
};
