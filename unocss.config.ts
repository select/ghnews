import { defineConfig, presetUno, presetIcons, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      /* use the 'mdi' icon pack via Iconify (no extra config needed) */
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle'
      }
    }),
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
