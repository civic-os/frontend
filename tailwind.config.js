/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    container: {
      center: true,
    },
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
    require("daisyui")({
      themes: ["light", "dark", "corporate", "nord", "emerald"]
    })
  ]
}

