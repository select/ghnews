<template>
  <div class="max-w-3xl mx-auto p-4">
    <header class="flex items-center justify-between py-6">
      <h1 class="text-2xl font-bold"><a href="/">hckrnews - GitHub Trending</a></h1>
      <div>
        <label class="mr-2">Period:</label>
        <select v-model="days" class="px-2 py-1 border rounded">
          <option :value="1">Daily</option>
          <option :value="7">Weekly</option>
          <option :value="30">Monthly</option>
        </select>
      </div>
    </header>

    <main>
      <div v-if="error" class="text-red-600">Error: {{ error }}</div>
      <div v-if="!items" class="text-gray-500">Loading...</div>

      <ol v-if="items" class="list-decimal pl-6 space-y-4">
        <li v-for="repo in items" :key="repo.id" class="py-2">
          <div class="flex items-start gap-3">
            <div class="flex-1">
              <a :href="repo.html_url" target="_blank" class="text-lg font-medium text-blue-600 hover:underline">{{ repo.full_name }}</a>
              <p class="text-sm text-gray-600">{{ repo.description }}</p>

              <div class="mt-2 text-sm text-gray-500 flex flex-wrap gap-4">
                <span>⭐ {{ repo.stars.toLocaleString() }}</span>
                <span v-if="repo.language">📘 {{ repo.language }}</span>
                <span>🍴 {{ repo.forks.toLocaleString() }}</span>
                <span>🕒 created: {{ formatDate(repo.created_at) }}</span>
                <span v-if="repo.owner" class="flex items-center gap-2">
                  <img v-if="repo.owner.avatar" :src="repo.owner.avatar" class="w-4 h-4 rounded-full" />
                  <a :href="repo.owner.url" class="text-blue-600">{{ repo.owner.login }}</a>
                </span>
              </div>
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
