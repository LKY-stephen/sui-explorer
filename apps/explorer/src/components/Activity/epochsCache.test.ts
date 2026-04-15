// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from 'vitest';

import {
	EPOCHS_CACHE_TTL_MS,
	getEpochsCacheKey,
	readEpochsCache,
	writeEpochsCache,
} from './epochsCache';

describe('epochsCache', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('stores epoch pages in persistent local storage', () => {
		const cacheKey = getEpochsCacheKey(20);

		writeEpochsCache(
			cacheKey,
			{
				pages: [
					{
						data: [
							{
								epoch: '7',
						},
					],
					hasNextPage: false,
					nextCursor: null,
					} as any,
				],
				pageParams: [null],
			},
			1_000,
		);

		expect(readEpochsCache(cacheKey, 1_000)).toEqual({
			pages: [
				{
					data: [
						{
							epoch: '7',
						},
					],
					hasNextPage: false,
					nextCursor: null,
				} as any,
			],
			pageParams: [null],
		});
	});

	it('expires stale epoch cache entries', () => {
		const cacheKey = getEpochsCacheKey(20);

		writeEpochsCache(
			cacheKey,
			{
				pages: [
					{
						data: [],
						hasNextPage: false,
						nextCursor: null,
					} as any,
				],
				pageParams: [null],
			},
			1_000,
		);

		expect(readEpochsCache(cacheKey, 1_000 + EPOCHS_CACHE_TTL_MS + 1)).toBeUndefined();
		expect(window.localStorage.getItem(cacheKey)).toBeNull();
	});
});
