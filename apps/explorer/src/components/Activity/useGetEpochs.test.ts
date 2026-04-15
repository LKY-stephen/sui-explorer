// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';

import { getEpochsInfiniteQueryOptions } from './useGetEpochs';

describe('getEpochsInfiniteQueryOptions', () => {
	it('queries epoch pages via getEpochs for Sui 1.69.1 compatibility', async () => {
		const getEpochs = vi.fn().mockResolvedValue({
			data: [],
			hasNextPage: false,
			nextCursor: null,
		});
		const options = getEpochsInfiniteQueryOptions({ getEpochs }, 20, 10_000);

		await options.queryFn({ pageParam: '5' });

		expect(getEpochs).toHaveBeenCalledWith({
			cursor: '5',
			limit: 20,
			descendingOrder: true,
		});
		expect(options.getNextPageParam({ data: [], hasNextPage: true, nextCursor: '6' })).toBe('6');
		expect(options.getNextPageParam({ data: [], hasNextPage: false, nextCursor: '6' })).toBeNull();
		expect(options.refetchInterval).toBe(10_000);
	});
});
