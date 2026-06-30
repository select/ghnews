<template>
	<div
		class="w-full max-w-[940px] mx-auto px-3 sm:px-4 py-4 font-sans text-base leading-6"
	>
		<header class="flex items-center justify-between py-4">
			<h1 class="text-3xl font-light">ghnews</h1>
			<nav class="flex items-center gap-3">
				<button
					v-if="isLocalhost"
					type="button"
					class="text-sm px-2.5 py-1 rounded border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed"
					:disabled="refreshing"
					@click="refresh"
				>
					{{ refreshing ? "Refreshing…" : "Refresh" }}
				</button>
				<a
					href="https://github.com/select/ghnews"
					target="_blank"
					rel="noopener"
					class="text-gray-700 hover:text-gray-900 text-2xl"
					aria-label="GitHub repository"
				>
					<span class="i-mdi-github"></span>
				</a>
			</nav>
		</header>

		<div
			class="flex items-start gap-3 sm:gap-4 py-1 px-0 sm:px-2 text-xs text-gray-400 select-none"
		>
			<div
				class="flex-none w-16 sm:w-32 flex flex-col sm:flex-row items-end sm:items-baseline gap-0.5 sm:gap-3 pr-3 sm:pr-6"
			>
				<span class="text-right w-full sm:w-14">forks</span>
				<span class="text-right w-full sm:w-14 text-teal-600/80">stars</span>
			</div>
			<div class="flex-1">repository</div>
		</div>

		<main>
			<div v-if="error" class="text-red-600">Error: {{ error }}</div>
			<div v-if="!items.length && !error" class="text-gray-500">Loading...</div>

			<ol v-if="items.length" class="divide-y divide-gray-200 list-none pl-0">
				<template v-for="(repo, i) in items" :key="repo.id">
					<li
						v-if="
							i === 0 ||
							formatDateDay(repo.created_at) !==
								formatDateDay(items[i - 1].created_at)
						"
						class="py-3"
					>
						<div class="flex items-center">
							<div class="flex-1 h-px bg-teal-200"></div>
							<div
								class="mx-4 inline-block bg-teal-600 text-white px-3 py-1 rounded-md text-xs"
							>
								{{ formatDateDay(repo.created_at) }}
							</div>
							<div class="flex-1 h-px bg-teal-200"></div>
						</div>
					</li>

					<li
						class="flex w-full items-start gap-3 sm:gap-4 py-3 px-0 sm:px-2 hover:bg-gray-50"
					>
						<div
							class="flex-none w-16 sm:w-32 flex flex-col sm:flex-row items-end sm:items-baseline gap-0.5 sm:gap-3 text-base text-gray-700 pr-3 sm:pr-6 pt-1 select-none tabular-nums"
						>
							<span
								class="text-gray-500 text-sm sm:text-base leading-tight text-right w-full sm:w-14"
								>{{ repo.forks.toLocaleString() }}</span
							>
							<span
								class="text-teal-600 font-semibold text-base leading-tight text-right w-full sm:w-14"
								>{{ repo.stars.toLocaleString() }}</span
							>
						</div>

						<div class="flex-1 min-w-0">
							<div class="flex items-start justify-between">
								<div class="min-w-0">
									<a
										:href="repo.html_url"
										target="_blank"
										rel="noopener"
										class="block text-base text-gray-900 font-medium no-underline"
									>
										<span class="align-middle capitalize">{{ repo.name }}</span>
										<span class="text-gray-400 ml-2 align-middle"
											>({{
												repo.owner?.login || extractDomain(repo.html_url)
											}})</span
										>
										<p
											v-if="repo.description"
											class="text-sm text-gray-600 mt-0.5 line-clamp-2"
										>{{ repo.description }}</p
										>
									</a>
								</div>
								<img
									v-if="!failedImgs.has(repo.id)"
									:src="ogImage(repo)"
									:alt="repo.full_name"
									loading="lazy"
									class="flex-none w-24 sm:w-32 aspect-2/1 object-cover rounded border border-gray-200 bg-gray-50"
									@error="failedImgs.add(repo.id); failedImgs = new Set(failedImgs)"
								/>
							</div>
						</div>
					</li>
				</template>
			</ol>

			<div ref="sentinel" class="h-1"></div>
			<div v-if="loadingMore" class="text-center text-sm text-gray-400 py-4">
				Loading more…
			</div>
			<div
				v-else-if="chunkIndex >= allDates.length && items.length"
				class="text-center text-sm text-gray-400 py-4"
			>
				— end of archive —
			</div>
		</main>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";

const items = ref<any[]>([]);
const error = ref<string | null>(null);
const refreshing = ref(false);
const loadingMore = ref(false);
const allDates = ref<string[]>([]);
const chunkIndex = ref(0);
const sentinel = ref<HTMLElement | null>(null);
const failedImgs = ref(new Set<string | number>());
let observer: IntersectionObserver | null = null;

const isLocalhost = computed(() => {
	if (import.meta.server) return false;
	const h = window.location.hostname;
	return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
});

// de-dup by repo id across chunks
const seen = new Set<number | string>();
function pushChunk(itemsIn: any[]) {
	for (const r of itemsIn) {
		if (seen.has(r.id)) continue;
		seen.add(r.id);
		items.value.push(r);
	}
}

async function loadNextChunk() {
	if (loadingMore.value || error.value) return;
	if (chunkIndex.value >= allDates.value.length) return;
	loadingMore.value = true;
	try {
		const date = allDates.value[chunkIndex.value];
		const data = await $fetch<{ items: any[] }>(`/data/${date}.json`);
		if (data.items) {
			// keep archive order (already sorted by stars in-file); dedup
			pushChunk(data.items);
		}
		chunkIndex.value++;
	} catch (err: any) {
		error.value = err.message || String(err);
	} finally {
		loadingMore.value = false;
	}
}

async function init() {
	items.value = [];
	error.value = null;
	seen.clear();
	chunkIndex.value = 0;
	try {
		const index = await $fetch<{ dates: string[] }>("/data/index.json");
		if (!index.dates || index.dates.length === 0) {
			error.value = "No data available.";
			return;
		}
		allDates.value = index.dates;
		await loadNextChunk();
		setupObserver();
	} catch (err: any) {
		error.value = err.message || String(err);
	}
}

function setupObserver() {
	if (observer || !sentinel.value || import.meta.server) return;
	observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting) loadNextChunk();
		},
		{ rootMargin: "600px" },
	);
	observer.observe(sentinel.value);
}

onMounted(init);
onBeforeUnmount(() => observer?.disconnect());

async function refresh() {
	if (refreshing.value) return;
	refreshing.value = true;
	try {
		const res = await $fetch<{ ok: boolean; stdout: string; stderr: string }>(
			"/api/refresh",
			{ method: "POST" },
		);
		if (!res.ok) {
			error.value =
				"Refresh failed: " + (res.stderr || res.stdout || "unknown error");
		} else {
			// Bust cache and reload from scratch
			await $fetch("/data/index.json", { query: { _t: Date.now() } });
			await init();
		}
	} catch (err: any) {
		error.value = err.message || String(err);
	} finally {
		refreshing.value = false;
	}
}

function formatDateDay(iso: string) {
	try {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, {
			weekday: "short",
			month: "short",
			day: "numeric",
		});
	} catch (e) {
		return iso;
	}
}

function extractDomain(url: string) {
	try {
		const u = new URL(url);
		return u.hostname.replace("www.", "");
	} catch (e) {
		return url;
	}
}

// Prefer a repo's *custom* social-preview banner (collected at scrape time,
// hosted on repository-images.githubusercontent.com) when available. Otherwise
// fall back to GitHub's generated OG card (opengraph.githubassets.com, 2:1).
// Both are hotlinked from GitHub's CDN; we never host images ourselves.
function ogImage(repo: any): string {
	if (repo.banner_url) return repo.banner_url;
	const full = repo.full_name || repo.owner?.login + "/" + repo.name;
	return `https://opengraph.githubassets.com/1/${full}`;
}
</script>
