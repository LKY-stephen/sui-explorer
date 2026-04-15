// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from 'vitest';

import {
	getTransactionBlocksCacheKey,
	readLatestTransactionBlocksCache,
	readTransactionBlocksCache,
	TRANSACTION_BLOCKS_CACHE_TTL_MS,
	writeTransactionBlocksCache,
} from './transactionBlocksCache';

describe('transactionBlocksCache', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('stores a bounded snapshot in persistent local storage', () => {
		const cacheKey = getTransactionBlocksCacheKey({ TransactionKind: 'ProgrammableTransaction' }, 20);

		writeTransactionBlocksCache(
			cacheKey,
			{
				pages: Array.from({ length: 12 }, (_, index) => ({
					data: [{ digest: `tx-${index}` }],
					hasNextPage: index < 11,
					nextCursor: index < 11 ? `cursor-${index}` : null,
				})),
				pageParams: Array.from({ length: 12 }, (_, index) => (index === 0 ? null : `cursor-${index - 1}`)),
			},
			1_000,
		);

		expect(readTransactionBlocksCache(cacheKey, 1_000)).toEqual({
			pages: Array.from({ length: 10 }, (_, index) => ({
				data: [{ digest: `tx-${index}` }],
				hasNextPage: index < 11,
				nextCursor: index < 11 ? `cursor-${index}` : null,
			})),
			pageParams: Array.from({ length: 10 }, (_, index) => (index === 0 ? null : `cursor-${index - 1}`)),
		});
	});

	it('expires stale cache entries', () => {
		const cacheKey = getTransactionBlocksCacheKey(undefined, 20);

		writeTransactionBlocksCache(
			cacheKey,
			{
				pages: [
					{
						data: [{ digest: 'tx-1' }],
						hasNextPage: false,
						nextCursor: null,
					},
				],
				pageParams: [null],
			},
			1_000,
		);

		expect(readTransactionBlocksCache(cacheKey, 1_000 + TRANSACTION_BLOCKS_CACHE_TTL_MS + 1)).toBeUndefined();
		expect(window.localStorage.getItem(cacheKey)).toBeNull();
	});

	it('can reuse the freshest cache entry for the same filter across limits', () => {
		writeTransactionBlocksCache(
			getTransactionBlocksCacheKey(undefined, 25),
			{
				pages: [
					{
						data: [{ digest: 'tx-home' }],
						hasNextPage: false,
						nextCursor: null,
					},
				],
				pageParams: [null],
			},
			2_000,
		);

		expect(readLatestTransactionBlocksCache(undefined, 20, 2_000)).toEqual({
			pages: [
				{
					data: [{ digest: 'tx-home' }],
					hasNextPage: false,
					nextCursor: null,
				},
			],
			pageParams: [null],
		});
	});
});
