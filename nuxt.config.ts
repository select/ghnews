import { defineNuxtConfig } from 'nuxt/config'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'

export default defineNuxtConfig({
  app: {
    baseURL: isGitHubPages ? '/ghnews/' : '/',
  },

  modules: ['@unocss/nuxt'],
  css: [],

  nitro: {
    preset: isGitHubPages ? 'github-pages' : undefined,
  },
})
