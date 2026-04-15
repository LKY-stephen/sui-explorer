// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSuiClient } from '@mysten/dapp-kit';
import { type EpochPage, type SuiClient } from '@mysten/sui.js/client';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

export function getEpochsInfiniteQueryOptions(
	client: Pick<SuiClient, 'getEpochs'>,
	limit: number,
	refetchInterval?: number,
) {
	return {
		queryKey: ['get-epochs', limit],
		queryFn: async ({ pageParam }: { pageParam: unknown }) =>
			await client.getEpochs({
				cursor: (pageParam as string | null) ?? null,
				limit,
				descendingOrder: true,
			}),
		initialPageParam: null,
		getNextPageParam: ({ hasNextPage, nextCursor }: EpochPage) => (hasNextPage ? nextCursor : null),
		staleTime: 10 * 1000,
		retry: false,
		placeholderData: keepPreviousData,
		refetchInterval,
	} as const;
}

export function useGetEpochs(limit: number, refetchInterval?: number) {
	const client = useSuiClient();

	return useInfiniteQuery<EpochPage>(getEpochsInfiniteQueryOptions(client, limit, refetchInterval));
}
