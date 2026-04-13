import { defineConfig, presetUno, presetIcons, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
  ],
  shortcuts: {
    'btn': 'px-4 py-2 rounded inline-block bg-primary text-white'
  },
  theme: {
    colors: {
      primary: '#3b82f6'
    }
  }
})
