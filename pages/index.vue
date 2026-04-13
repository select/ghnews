<template>
  <div class="max-w-2xl mx-auto p-4 font-sans text-sm leading-6">
    <header class="flex items-center justify-between py-4">
      <h1 class="text-base font-semibold"><a href="/" class="text-black no-underline hover:underline">hckrnews - GitHub Trending</a></h1>
      <div class="text-sm text-gray-700">
        <label class="mr-2">Period:</label>
        <select v-model="days" class="px-2 py-1 border rounded text-sm">
          <option :value="1">Daily</option>
          <option :value="7">Weekly</option>
          <option :value="30">Monthly</option>
        </select>
      </div>
    </header>

    <main>
      <div v-if="error" class="text-red-600">Error: {{ error }}</div>
      <div v-if="!items" class="text-gray-500">Loading...</div>

      <ol v-if="items" class="divide-y divide-gray-200 list-none pl-0">
        <li v-for="(repo, i) in items" :key="repo.id" class="flex w-full items-start gap-3 py-3 px-4 sm:px-6 hover:bg-gray-50">
          <div class="flex-none w-6 text-right text-gray-500 pr-2 select-none">{{ i + 1 }}</div>

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between">
              <a :href="repo.html_url" target="_blank" class="text-sm text-blue-600 hover:underline font-medium">{{ repo.full_name }}</a>
              <div class="text-xs text-gray-500 ml-3 flex items-center gap-2"><i class="i-mdi-star text-[14px]"></i> {{ repo.stars.toLocaleString() }}</div>
            </div>

            <p v-if="repo.description" class="text-xs text-gray-600 mt-1">{{ repo.description }}</p>

            <div class="mt-2 text-xs text-gray-500 flex flex-wrap gap-3 items-center">
              <span v-if="repo.language" class="flex items-center gap-1"><i class="i-mdi-file-code text-[14px]"></i><span>{{ repo.language }}</span></span>
              <span class="flex items-center gap-1"><i class="i-mdi-source-branch text-[14px]"></i><span>{{ repo.forks.toLocaleString() }}</span></span>
              <span class="flex items-center gap-1"><i class="i-mdi-clock-outline text-[14px]"></i><span>{{ formatDate(repo.created_at) }}</span></span>
              <span v-if="repo.owner" class="flex items-center gap-2">
                <img v-if="repo.owner.avatar" :src="repo.owner.avatar" class="w-4 h-4 rounded-full" />
                <a :href="repo.owner.url" class="text-gray-700 hover:underline text-xs">{{ repo.owner.login }}</a>
              </span>
            </div>
          </div>
        </li>
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
      items.value = (res as any).items
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
</script>
