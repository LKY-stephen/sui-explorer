// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type EpochPage } from '@mysten/sui.js/client';
import { type InfiniteData } from '@tanstack/react-query';

export const EPOCHS_CACHE_TTL_MS = 10 * 60 * 1000;
export const MAX_CACHED_EPOCH_PAGES = 5;
const EPOCHS_CACHE_KEY_PREFIX = 'sui-explorer:epochs:v1';

type PersistedEpochsCache = {
	updatedAt: number;
	pages: EpochPage[];
	pageParams: (string | null)[];
};

function getEpochsCacheStorage() {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.localStorage;
}

export function getEpochsCacheKey(limit?: number) {
	return `${EPOCHS_CACHE_KEY_PREFIX}:${limit ?? 'default'}`;
}

export function readEpochsCache(
	cacheKey: string,
	now = Date.now(),
): InfiniteData<EpochPage> | undefined {
	const storage = getEpochsCacheStorage();
	if (!storage) {
		return undefined;
	}

	try {
		const cachedValue = storage.getItem(cacheKey);
		if (!cachedValue) {
			return undefined;
		}

		const parsedCache = JSON.parse(cachedValue) as PersistedEpochsCache;
		if (
			typeof parsedCache.updatedAt !== 'number' ||
			!Array.isArray(parsedCache.pages) ||
			!Array.isArray(parsedCache.pageParams) ||
			now - parsedCache.updatedAt > EPOCHS_CACHE_TTL_MS
		) {
			storage.removeItem(cacheKey);
			return undefined;
		}

		return {
			pages: parsedCache.pages.slice(0, MAX_CACHED_EPOCH_PAGES),
			pageParams: parsedCache.pageParams.slice(0, MAX_CACHED_EPOCH_PAGES),
		};
	} catch {
		storage.removeItem(cacheKey);
		return undefined;
	}
}

export function writeEpochsCache(
	cacheKey: string,
	data: InfiniteData<EpochPage>,
	now = Date.now(),
) {
	const storage = getEpochsCacheStorage();
	if (!storage) {
		return;
	}

	const limitedPages = data.pages.slice(0, MAX_CACHED_EPOCH_PAGES);
	const pageParams = data.pageParams
		.slice(0, limitedPages.length)
		.map((pageParam) => (typeof pageParam === 'string' || pageParam === null ? pageParam : null));

	try {
		storage.setItem(
			cacheKey,
			JSON.stringify({
				updatedAt: now,
				pages: limitedPages,
				pageParams,
			} satisfies PersistedEpochsCache),
		);
	} catch {
		// Ignore storage quota failures and keep the live query path working.
	}
}
