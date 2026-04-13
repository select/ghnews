<template>
  <div class="w-full max-w-full mx-auto px-1 sm:px-2 py-4 font-sans text-sm leading-5">
    <header class="flex items-center justify-between py-4">
      <h1 class="text-3xl font-light">GitHub Trending</h1>
      <nav class="text-sm">
        <a href="#" class="mr-4 text-gray-700 hover:underline">settings</a>
        <a href="#" class="text-gray-700 hover:underline">about</a>
      </nav>
    </header>

    <div class="text-center my-3">
      <div class="inline-block text-sm text-gray-700 underline">auto-refresh disabled</div>
      <div class="float-right">
        <label class="text-sm mr-2">Timespan:</label>
        <select v-model="days" class="text-sm bg-white border border-gray-300 rounded px-2 py-1">
          <option :value="1">Daily</option>
          <option :value="7">Weekly</option>
          <option :value="30">Monthly</option>
        </select>
      </div>
    </div>

    <main>
      <div v-if="error" class="text-red-600">Error: {{ error }}</div>
      <div v-if="!items" class="text-gray-500">Loading...</div>

      <ol v-if="items" class="divide-y divide-gray-200 list-none pl-0">
        <template v-for="(repo, i) in items" :key="repo.id">
          <li v-if="i === 0 || formatDateDay(repo.created_at) !== formatDateDay(items[i-1].created_at)" class="py-3">
            <div class="flex items-center">
              <div class="flex-1 h-px bg-teal-200"></div>
              <div class="mx-4 inline-block bg-teal-600 text-white px-3 py-1 rounded-md text-xs">{{ formatDateDay(repo.created_at) }}</div>
              <div class="flex-1 h-px bg-teal-200"></div>
            </div>
          </li>

          <li class="flex w-full items-start gap-4 py-3 px-0 sm:px-2 hover:bg-gray-50">
            <div class="flex-none w-12 flex flex-col items-end text-sm text-gray-700 pr-6 select-none">
              <span class="text-gray-700 text-xs leading-tight">{{ repo.forks.toLocaleString() }}</span>
              <span class="text-teal-600 font-semibold text-sm leading-tight mt-1">{{ repo.stars.toLocaleString() }}</span>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between">
                <div class="min-w-0">
                  <a :href="repo.html_url" target="_blank" class="block text-sm text-gray-900 font-medium no-underline">
                    <span class="align-middle">{{ repo.name }}</span>
                    <template v-if="repo.description">
                      <span class="text-xs text-gray-600 ml-3 align-middle">— {{ repo.description }}</span>
                    </template>
                  </a>

                  <div class="text-xs text-gray-400 mt-1">(<a :href="repo.owner?.url" class="text-gray-400 hover:underline" target="_blank" rel="noopener">{{ repo.owner?.login || extractDomain(repo.html_url) }}</a>)</div>
                </div>
              </div>
            </div>
          </li>
        </template>
      </ol>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const days = ref<number>(7)
const items = ref<any[] | null>(null)
const error = ref<string | null>(null)

async function fetchData () {
  items.value = null
  error.value = null
  try {
    const res = await $fetch('/api/trending?days=' + days.value)
    if ((res as any).error) {
      error.value = (res as any).error
    } else {
      // Sort by created_at descending so newest (by creation date) appear first
      items.value = (res as any).items.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
  } catch (err: any) {
    error.value = err.message || String(err)
  }
}

watch(days, () => fetchData(), { immediate: true })

function formatDate (iso: string) {
  try {
    return new Date(iso).toLocaleDateString()
  } catch (e) {
    return iso
  }
}

function formatDateDay (iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  } catch (e) {
    return iso
  }
}

function extractDomain (url: string) {
  try {
    const u = new URL(url)
    return u.hostname.replace('www.', '')
  } catch (e) {
    return url
  }
}
</script>
