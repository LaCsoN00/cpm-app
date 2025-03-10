import daisyui from 'daisyui'

interface TailwindConfig {
  content: string[]
  theme: {
    extend: Record<string, unknown>
  }
  plugins: unknown[]
}

const config: TailwindConfig = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: [daisyui]
}

export default config
