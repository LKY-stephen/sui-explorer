// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	EPOCHS_QUERY_RECOVERY_RETRY_COUNT,
	getEpochsInfiniteQueryOptions,
	useGetEpochs,
} from './useGetEpochs';
import { getEpochsCacheKey, writeEpochsCache } from './epochsCache';

const getEpochs = vi.fn();

vi.mock('@mysten/dapp-kit', () => ({
	useSuiClient: () => ({
		getEpochs,
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
		return createElement(QueryClientProvider, { client: queryClient }, children);
	};
}

describe('getEpochsInfiniteQueryOptions', () => {
	beforeEach(() => {
		getEpochs.mockReset();
		window.localStorage.clear();
	});

	it('omits the first-page cursor and only sends later pagination cursors', async () => {
		const localGetEpochs = vi.fn().mockResolvedValue({
			data: [],
			hasNextPage: false,
			nextCursor: null,
		});
		const options = getEpochsInfiniteQueryOptions({ getEpochs: localGetEpochs }, 20, 10_000);

		await options.queryFn({ pageParam: null });
		await options.queryFn({ pageParam: '5' });

		expect(localGetEpochs).toHaveBeenNthCalledWith(1, {
			limit: 20,
			descendingOrder: true,
		});
		expect(localGetEpochs).toHaveBeenNthCalledWith(2, {
			cursor: '5',
			limit: 20,
			descendingOrder: true,
		});
	});

	it('keeps epoch polling recoverable after transient failures', () => {
		const options = getEpochsInfiniteQueryOptions({ getEpochs: vi.fn() }, 20, 10_000);

		expect(options.getNextPageParam({ data: [], hasNextPage: true, nextCursor: '6' })).toBe('6');
		expect(options.getNextPageParam({ data: [], hasNextPage: false, nextCursor: '6' })).toBeNull();
		expect(options.refetchInterval).toBe(10_000);
		expect(options.retry).toBe(EPOCHS_QUERY_RECOVERY_RETRY_COUNT);
		expect(options.refetchOnMount).toBe('always');
		expect(options.refetchOnReconnect).toBe(true);
	});

	it('accepts cached epoch pages as initial data for refresh recovery', () => {
		const initialData = {
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
		};
		const options = getEpochsInfiniteQueryOptions({ getEpochs: vi.fn() }, 20, 10_000, initialData);

		expect(options.initialData).toEqual(initialData);
		expect(options.initialDataUpdatedAt).toBe(0);
	});

	it('hydrates from cached epoch pages before refetching on revisit', async () => {
		writeEpochsCache(getEpochsCacheKey(20), {
			pages: [
				{
					data: [{ epoch: '7' }],
					hasNextPage: false,
					nextCursor: null,
				} as any,
			],
			pageParams: [null],
		});
		getEpochs.mockResolvedValue({
			data: [{ epoch: '8' }],
			hasNextPage: false,
			nextCursor: null,
		});

		const { result } = renderHook(() => useGetEpochs(20), {
			wrapper: createWrapper(),
		});

		expect(result.current.data?.pages[0].data[0]).toEqual(expect.objectContaining({ epoch: '7' }));

		await waitFor(() => {
			expect(getEpochs).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			expect(result.current.data?.pages[0].data[0]).toEqual(
				expect.objectContaining({ epoch: '8' }),
			);
		});
	});
});
