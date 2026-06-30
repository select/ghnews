import { defineNuxtConfig } from 'nuxt/config'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const SITE_URL = isGitHubPages ? 'https://select.github.io/ghnews' : 'http://localhost:3000'
const OG_IMAGE = `${SITE_URL}/og-preview.png`

export default defineNuxtConfig({
  app: {
    baseURL: isGitHubPages ? '/ghnews/' : '/',
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'ghnews — GitHub Trending, archived daily',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'A daily archive of GitHub trending repositories, with stars, forks, and social-preview banners.' },
        // Open Graph (Facebook, LinkedIn, Slack, iMessage…)
        { property: 'og:site_name', content: 'ghnews' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'ghnews — GitHub Trending, archived daily' },
        { property: 'og:description', content: 'A daily archive of GitHub trending repositories, with stars, forks, and social-preview banners.' },
        { property: 'og:url', content: SITE_URL + '/' },
        { property: 'og:image', content: OG_IMAGE },
        { property: 'og:image:alt', content: 'ghnews preview' },
        // Twitter / X
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'ghnews — GitHub Trending, archived daily' },
        { name: 'twitter:description', content: 'A daily archive of GitHub trending repositories, with stars, forks, and social-preview banners.' },
        { name: 'twitter:image', content: OG_IMAGE },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: 'og-preview.png' },
      ],
    },
  },

  modules: ['@unocss/nuxt'],
  css: [],

  nitro: {
    preset: isGitHubPages ? 'github-pages' : undefined,
  },
})
