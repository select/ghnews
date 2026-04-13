<template>
  <div class="max-w-2xl mx-auto p-4 font-sans text-sm leading-6">
    <header class="flex items-center justify-between py-4">
      <h1 class="text-3xl font-light">hckr news</h1>
      <nav class="text-sm">
        <a href="#" class="mr-4 text-gray-700 hover:underline">settings</a>
        <a href="#" class="text-gray-700 hover:underline">about</a>
      </nav>
    </header>

    <div class="text-center my-3">
      <div class="inline-block text-sm text-gray-700 underline">auto-refresh disabled</div>
      <div class="float-right">
        <span class="text-sm mr-2">Filter:</span>
        <span class="inline-block bg-orange-500 text-white px-3 py-1 rounded-full text-sm">top 20</span>
      </div>
    </div>

    <main>
      <div v-if="error" class="text-red-600">Error: {{ error }}</div>
      <div v-if="!items" class="text-gray-500">Loading...</div>

      <ol v-if="items" class="divide-y divide-gray-200 list-none pl-0">
        <template v-for="(repo, i) in items" :key="repo.id">
          <li v-if="i === 0 || formatDateDay(repo.created_at) !== formatDateDay(items[i-1].created_at)" class="py-2">
            <div class="relative">
              <div class="absolute inset-x-0 top-1/2 transform -translate-y-1/2">
                <div class="mx-auto inline-block bg-orange-500 text-white px-3 py-1 rounded-md text-xs">{{ formatDateDay(repo.created_at) }}</div>
              </div>
              <div class="h-px bg-orange-300 mt-2"></div>
            </div>
          </li>

          <li class="flex w-full items-start gap-3 py-2 px-2 sm:px-6 hover:bg-gray-50">
            <div class="flex-none w-12 flex flex-col items-end text-sm text-gray-700 pr-2 select-none">
              <span class="text-gray-700">{{ repo.forks.toLocaleString() }}</span>
              <span class="text-orange-500 font-semibold mt-1">{{ repo.stars.toLocaleString() }}</span>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <a :href="repo.html_url" target="_blank" class="text-sm text-gray-900 font-medium no-underline">{{ repo.full_name }}</a>
              </div>

              <div class="mt-0.5">
                <p v-if="repo.description" class="text-xs text-gray-600 leading-tight">
                  {{ repo.description }} <span class="text-xs text-gray-400">({{ extractDomain(repo.html_url) }})</span>
                </p>
                <p v-else class="text-xs text-gray-400">({{ extractDomain(repo.html_url) }})</p>
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
