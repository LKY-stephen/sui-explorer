// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type PaginatedTransactionResponse, type TransactionFilter } from '@mysten/sui.js/client';
import { type InfiniteData } from '@tanstack/react-query';

export const TRANSACTION_BLOCKS_CACHE_TTL_MS = 10 * 60 * 1000;
export const MAX_CACHED_TRANSACTION_BLOCK_PAGES = 10;
const TRANSACTION_BLOCKS_CACHE_KEY_PREFIX = 'sui-explorer:transaction-blocks:v1';

type PersistedTransactionBlocksCache = {
	updatedAt: number;
	pages: PaginatedTransactionResponse[];
	pageParams: (string | null)[];
};

function getTransactionBlocksCacheStorage() {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.localStorage;
}

function serializeTransactionFilter(filter?: TransactionFilter) {
	return filter ? JSON.stringify(filter) : 'all';
}

export function getTransactionBlocksCacheKey(filter?: TransactionFilter, limit?: number) {
	return `${TRANSACTION_BLOCKS_CACHE_KEY_PREFIX}:${limit ?? 'default'}:${serializeTransactionFilter(
		filter,
	)}`;
}

function readParsedTransactionBlocksCache(
	storage: Storage,
	cacheKey: string,
	now: number,
): InfiniteData<PaginatedTransactionResponse> | undefined {
	try {
		const cachedValue = storage.getItem(cacheKey);
		if (!cachedValue) {
			return undefined;
		}

		const parsedCache = JSON.parse(cachedValue) as PersistedTransactionBlocksCache;
		if (
			typeof parsedCache.updatedAt !== 'number' ||
			!Array.isArray(parsedCache.pages) ||
			!Array.isArray(parsedCache.pageParams) ||
			now - parsedCache.updatedAt > TRANSACTION_BLOCKS_CACHE_TTL_MS
		) {
			storage.removeItem(cacheKey);
			return undefined;
		}

		return {
			pages: parsedCache.pages.slice(0, MAX_CACHED_TRANSACTION_BLOCK_PAGES),
			pageParams: parsedCache.pageParams.slice(0, MAX_CACHED_TRANSACTION_BLOCK_PAGES),
		};
	} catch {
		storage.removeItem(cacheKey);
		return undefined;
	}
}

export function readTransactionBlocksCache(
	cacheKey: string,
	now = Date.now(),
): InfiniteData<PaginatedTransactionResponse> | undefined {
	const storage = getTransactionBlocksCacheStorage();
	if (!storage) {
		return undefined;
	}

	return readParsedTransactionBlocksCache(storage, cacheKey, now);
}

export function readLatestTransactionBlocksCache(
	filter?: TransactionFilter,
	limit?: number,
	now = Date.now(),
) {
	const storage = getTransactionBlocksCacheStorage();
	if (!storage) {
		return undefined;
	}

	const exactCache = readParsedTransactionBlocksCache(
		storage,
		getTransactionBlocksCacheKey(filter, limit),
		now,
	);
	if (exactCache) {
		return exactCache;
	}

	const filterSuffix = `:${serializeTransactionFilter(filter)}`;
	let freshestCache:
		| {
				key: string;
				updatedAt: number;
				data: InfiniteData<PaginatedTransactionResponse>;
		  }
		| undefined;

	for (let index = 0; index < storage.length; index += 1) {
		const key = storage.key(index);
		if (!key || !key.startsWith(TRANSACTION_BLOCKS_CACHE_KEY_PREFIX) || !key.endsWith(filterSuffix)) {
			continue;
		}

		try {
			const cachedValue = storage.getItem(key);
			if (!cachedValue) {
				continue;
			}

			const parsedCache = JSON.parse(cachedValue) as PersistedTransactionBlocksCache;
			if (
				typeof parsedCache.updatedAt !== 'number' ||
				!Array.isArray(parsedCache.pages) ||
				!Array.isArray(parsedCache.pageParams) ||
				now - parsedCache.updatedAt > TRANSACTION_BLOCKS_CACHE_TTL_MS
			) {
				storage.removeItem(key);
				continue;
			}

			if (!freshestCache || parsedCache.updatedAt > freshestCache.updatedAt) {
				freshestCache = {
					key,
					updatedAt: parsedCache.updatedAt,
					data: {
						pages: parsedCache.pages.slice(0, MAX_CACHED_TRANSACTION_BLOCK_PAGES),
						pageParams: parsedCache.pageParams.slice(0, MAX_CACHED_TRANSACTION_BLOCK_PAGES),
					},
				};
			}
		} catch {
			storage.removeItem(key);
		}
	}

	return freshestCache?.data;
}

export function writeTransactionBlocksCache(
	cacheKey: string,
	data: InfiniteData<PaginatedTransactionResponse>,
	now = Date.now(),
) {
	const storage = getTransactionBlocksCacheStorage();
	if (!storage) {
		return;
	}

	const limitedPages = data.pages.slice(0, MAX_CACHED_TRANSACTION_BLOCK_PAGES);
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
			} satisfies PersistedTransactionBlocksCache),
		);
	} catch {
		// Ignore storage quota failures and keep the live query path working.
	}
}
