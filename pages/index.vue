<template>
	<div
		class="w-full max-w-[940px] mx-auto px-2 sm:px-4 py-4 font-sans text-base leading-6 antialiased"
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
			<div
				v-if="initError"
				class="my-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-center"
			>
				<p class="font-medium">Error loading data</p>
				<p class="text-sm mt-1">{{ initError }}</p>
				<button
					type="button"
					class="mt-3 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
					@click="init"
				>
					Retry
				</button>
			</div>
			<div v-if="!items.length && !initError" class="text-gray-500 py-4">Loading...</div>

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
										<div class="truncate">
											<span class="align-middle capitalize">{{ repo.name }}</span>
										<span class="text-gray-400 ml-2 align-middle"
											>({{
												repo.owner?.login || extractDomain(repo.html_url)
											}})</span
										>
										</div>
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
									class="hidden sm:block flex-none w-32 aspect-2/1 object-cover rounded border border-gray-200 bg-gray-50"
									@error="failedImgs.add(repo.id); failedImgs = new Set(failedImgs)"
								/>
							</div>
						</div>
					</li>
				</template>
			</ol>

			<div ref="sentinel" class="h-1"></div>

			<div
				v-if="chunkError"
				class="my-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-center text-sm space-y-2"
			>
				<div>{{ chunkError }}</div>
				<div class="flex justify-center gap-3 pt-1">
					<button
						type="button"
						class="px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition text-xs font-medium"
						@click="loadNextChunk()"
					>
						Retry
					</button>
					<button
						type="button"
						class="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition text-xs font-medium"
						@click="skipChunk"
					>
						Skip date
					</button>
				</div>
			</div>

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
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from "vue";

const items = ref<any[]>([]);
const initError = ref<string | null>(null);
const chunkError = ref<string | null>(null);
const refreshing = ref(false);
const loadingMore = ref(false);
const allDates = ref<string[]>([]);
const chunkIndex = ref(0);
const sentinel = ref<HTMLElement | null>(null);
const failedImgs = ref(new Set<string | number>());
let observer: IntersectionObserver | null = null;
let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null;

const mounted = ref(false);
const isLocalhost = computed(() => {
	if (!mounted.value) return false;
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

function isSentinelInView(margin = 800): boolean {
	if (!sentinel.value || typeof window === "undefined") return false;
	const rect = sentinel.value.getBoundingClientRect();
	return rect.top <= (window.innerHeight || document.documentElement.clientHeight) + margin;
}

async function loadNextChunk(retryCount = 0) {
	if (loadingMore.value) return;
	if (chunkIndex.value >= allDates.value.length) return;

	loadingMore.value = true;
	chunkError.value = null;

	const date = allDates.value[chunkIndex.value];
	let success = false;

	try {
		const data = await $fetch<{ items: any[] }>(`data/${date}.json`);
		if (data && Array.isArray(data.items)) {
			// keep archive order (already sorted by stars in-file); dedup
			pushChunk(data.items);
		}
		chunkIndex.value++;
		success = true;
	} catch (err: any) {
		if (retryCount < 2) {
			// Transient network retry
			loadingMore.value = false;
			await new Promise((r) => setTimeout(r, 600));
			return loadNextChunk(retryCount + 1);
		}
		chunkError.value = `Failed to load ${date || "archive"}: ${err?.message || String(err)}`;
	} finally {
		loadingMore.value = false;
	}

	// If sentinel is still in/near viewport (e.g. high-res screen, filtered items, or duplicates), keep loading
	if (success && chunkIndex.value < allDates.value.length) {
		await nextTick();
		if (isSentinelInView(800)) {
			requestAnimationFrame(() => {
				if (!loadingMore.value && !chunkError.value && isSentinelInView(800)) {
					loadNextChunk();
				}
			});
		}
	}
}

function skipChunk() {
	chunkError.value = null;
	chunkIndex.value++;
	loadNextChunk();
}

async function init() {
	items.value = [];
	initError.value = null;
	chunkError.value = null;
	seen.clear();
	chunkIndex.value = 0;
	try {
		const index = await $fetch<{ dates: string[] }>("data/index.json");
		if (!index.dates || index.dates.length === 0) {
			initError.value = "No data available.";
			return;
		}
		allDates.value = index.dates;
		await loadNextChunk();
	} catch (err: any) {
		initError.value = err.message || String(err);
	}
}

function setupObserver() {
	if (observer || !sentinel.value || typeof IntersectionObserver === "undefined") return;
	observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting) {
				loadNextChunk();
			}
		},
		{ rootMargin: "800px" },
	);
	observer.observe(sentinel.value);
}

function onScrollOrResize() {
	if (
		scrollThrottleTimer ||
		loadingMore.value ||
		chunkError.value ||
		chunkIndex.value >= allDates.value.length
	) {
		return;
	}
	scrollThrottleTimer = setTimeout(() => {
		scrollThrottleTimer = null;
		if (isSentinelInView(800)) {
			loadNextChunk();
		}
	}, 100);
}

onMounted(() => {
	mounted.value = true;
	setupObserver();
	window.addEventListener("scroll", onScrollOrResize, { passive: true });
	window.addEventListener("resize", onScrollOrResize, { passive: true });
	init();
});

onBeforeUnmount(() => {
	observer?.disconnect();
	observer = null;
	if (scrollThrottleTimer) clearTimeout(scrollThrottleTimer);
	if (typeof window !== "undefined") {
		window.removeEventListener("scroll", onScrollOrResize);
		window.removeEventListener("resize", onScrollOrResize);
	}
});

async function refresh() {
	if (refreshing.value) return;
	refreshing.value = true;
	try {
		const res = await $fetch<{ ok: boolean; stdout: string; stderr: string }>(
			"/api/refresh",
			{ method: "POST" },
		);
		if (!res.ok) {
			initError.value =
				"Refresh failed: " + (res.stderr || res.stdout || "unknown error");
		} else {
			// Bust cache and reload from scratch
			await $fetch("data/index.json", { query: { _t: Date.now() } });
			await init();
		}
	} catch (err: any) {
		initError.value = err.message || String(err);
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
