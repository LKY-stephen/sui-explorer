// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSuiClient } from '@mysten/dapp-kit';
import { type SuiClient, type PaginatedTransactionResponse, type TransactionFilter } from '@mysten/sui.js/client';
import { type InfiniteData, keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import {
	getTransactionBlocksCacheKey,
	readLatestTransactionBlocksCache,
	writeTransactionBlocksCache,
} from './transactionBlocksCache';

export const DEFAULT_TRANSACTIONS_LIMIT = 20;

export function getTransactionBlocksInfiniteQueryOptions(
	client: Pick<SuiClient, 'queryTransactionBlocks'>,
	filter?: TransactionFilter,
	limit = DEFAULT_TRANSACTIONS_LIMIT,
	refetchInterval?: number,
	initialData?: InfiniteData<PaginatedTransactionResponse>,
) {
	return {
		queryKey: ['get-transaction-blocks', filter, limit],
		queryFn: async ({ pageParam }: { pageParam: unknown }) => {
			const cursor = pageParam as string | null;

			return await client.queryTransactionBlocks({
				filter,
				...(cursor ? { cursor } : {}),
				order: 'descending',
				limit,
				options: {
					showEffects: true,
					showInput: true,
				},
			});
		},
		initialPageParam: null,
		getNextPageParam: ({ hasNextPage, nextCursor }: PaginatedTransactionResponse) =>
			hasNextPage ? nextCursor : null,
		staleTime: 10 * 1000,
		retry: false,
		placeholderData: keepPreviousData,
		refetchInterval,
		initialData,
		initialDataUpdatedAt: initialData ? 0 : undefined,
	} as const;
}

// Fetch transaction blocks
export function useGetTransactionBlocks(
	filter?: TransactionFilter,
	limit = DEFAULT_TRANSACTIONS_LIMIT,
	refetchInterval?: number,
) {
	const client = useSuiClient();
	const serializedFilter = filter ? JSON.stringify(filter) : 'all';
	const cacheKey = useMemo(
		() => getTransactionBlocksCacheKey(filter, limit),
		[serializedFilter, limit],
	);
	const initialData = useMemo(() => readLatestTransactionBlocksCache(filter, limit), [serializedFilter, limit]);

	const query = useInfiniteQuery<PaginatedTransactionResponse>(
		getTransactionBlocksInfiniteQueryOptions(client, filter, limit, refetchInterval, initialData),
	);

	useEffect(() => {
		if (query.data) {
			writeTransactionBlocksCache(cacheKey, query.data);
		}
	}, [cacheKey, query.data]);

	return query;
}
