// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGetTransactionBlocks } from './useGetTransactionBlocks';
import {
	getTransactionBlocksCacheKey,
	readTransactionBlocksCache,
	writeTransactionBlocksCache,
} from './transactionBlocksCache';

const queryTransactionBlocks = vi.fn();

vi.mock('@mysten/dapp-kit', () => ({
	useSuiClient: () => ({
		queryTransactionBlocks,
	}),
}));

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
			},
		},
	});

	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

describe('useGetTransactionBlocks', () => {
	beforeEach(() => {
		queryTransactionBlocks.mockReset();
		window.localStorage.clear();
	});

	it('hydrates from cached pages before refetching the latest data', async () => {
		const cacheKey = getTransactionBlocksCacheKey(undefined, 20);

		writeTransactionBlocksCache(cacheKey, {
			pages: [
				{
					data: [{ digest: 'cached-tx' }],
					hasNextPage: false,
					nextCursor: null,
				},
			],
			pageParams: [null],
		});

		queryTransactionBlocks.mockResolvedValue({
			data: [{ digest: 'live-tx' }],
			hasNextPage: false,
			nextCursor: null,
		});

		const { result } = renderHook(() => useGetTransactionBlocks(undefined, 20), {
			wrapper: createWrapper(),
		});

		expect(result.current.data?.pages[0].data[0]).toEqual(expect.objectContaining({ digest: 'cached-tx' }));

		await waitFor(() => {
			expect(queryTransactionBlocks).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			expect(result.current.data?.pages[0].data[0]).toEqual(
				expect.objectContaining({ digest: 'live-tx' }),
			);
		});
	});

	it('persists fetched transaction pages for reuse', async () => {
		queryTransactionBlocks.mockResolvedValue({
			data: [{ digest: 'persisted-tx' }],
			hasNextPage: false,
			nextCursor: null,
		});

		renderHook(() => useGetTransactionBlocks({ Checkpoint: '10' }, 20), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(queryTransactionBlocks).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			expect(
				readTransactionBlocksCache(getTransactionBlocksCacheKey({ Checkpoint: '10' }, 20)),
			).toEqual({
				pages: [
					{
						data: [{ digest: 'persisted-tx' }],
						hasNextPage: false,
						nextCursor: null,
					},
				],
				pageParams: [null],
			});
		});
	});

	it('hydrates from a same-filter cache entry even when the stored limit differs', () => {
		writeTransactionBlocksCache(getTransactionBlocksCacheKey(undefined, 25), {
			pages: [
				{
					data: [{ digest: 'cached-home-limit' }],
					hasNextPage: false,
					nextCursor: null,
				},
			],
			pageParams: [null],
		});

		const { result } = renderHook(() => useGetTransactionBlocks(undefined, 20), {
			wrapper: createWrapper(),
		});

		expect(result.current.data?.pages[0].data[0]).toEqual(
			expect.objectContaining({ digest: 'cached-home-limit' }),
		);
	});
});
