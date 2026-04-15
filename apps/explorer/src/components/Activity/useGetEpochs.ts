// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSuiClient } from '@mysten/dapp-kit';
import { type EpochPage, type SuiClient } from '@mysten/sui.js/client';
import { type InfiniteData, keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { getEpochsCacheKey, readEpochsCache, writeEpochsCache } from './epochsCache';

export const EPOCHS_QUERY_RECOVERY_RETRY_COUNT = 3;

export function getEpochsInfiniteQueryOptions(
	client: Pick<SuiClient, 'getEpochs'>,
	limit: number,
	refetchInterval?: number,
	initialData?: InfiniteData<EpochPage>,
) {
	return {
		queryKey: ['get-epochs', limit],
		queryFn: async ({ pageParam }: { pageParam: unknown }) => {
			const cursor = pageParam as string | null | undefined;

			return await client.getEpochs({
				limit,
				descendingOrder: true,
				...(cursor !== null && cursor !== undefined ? { cursor } : {}),
			});
		},
		initialPageParam: null,
		getNextPageParam: ({ hasNextPage, nextCursor }: EpochPage) => (hasNextPage ? nextCursor : null),
		staleTime: 10 * 1000,
		retry: EPOCHS_QUERY_RECOVERY_RETRY_COUNT,
		placeholderData: keepPreviousData,
		refetchInterval,
		refetchOnMount: 'always',
		refetchOnReconnect: true,
		initialData,
		initialDataUpdatedAt: initialData ? 0 : undefined,
	} as const;
}

export function useGetEpochs(limit: number, refetchInterval?: number) {
	const client = useSuiClient();
	const cacheKey = useMemo(() => getEpochsCacheKey(limit), [limit]);
	const initialData = useMemo(() => readEpochsCache(cacheKey), [cacheKey]);
	const query = useInfiniteQuery<EpochPage>(
		getEpochsInfiniteQueryOptions(client, limit, refetchInterval, initialData),
	);

	useEffect(() => {
		if (query.data) {
			writeEpochsCache(cacheKey, query.data);
		}
	}, [cacheKey, query.data]);

	return query;
}
