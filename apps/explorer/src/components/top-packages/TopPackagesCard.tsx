// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getTopPackages, type DateFilter } from './metrics';
import { TopPackagesTable } from './TopPackagesTable';
import { ErrorBoundary } from '../error-boundary/ErrorBoundary';
import { FilterList } from '~/ui/FilterList';
import { TabHeader } from '~/ui/Tabs';

export const TOP_PACKAGES_REFRESH_INTERVAL = 10 * 1000;

export function TopPackagesCard() {
	const client = useSuiClient();
	const [selectedFilter, setSelectedFilter] = useState<DateFilter>('3D');
	const { data: currentEpoch } = useSuiClientQuery('getLatestSuiSystemState', undefined, {
		select: ({ epoch }) => epoch,
		refetchInterval: TOP_PACKAGES_REFRESH_INTERVAL,
		refetchIntervalInBackground: true,
		refetchOnMount: 'always',
	});

	const { data, isPending } = useQuery({
		queryKey: ['top-packages', selectedFilter, currentEpoch ?? null],
		queryFn: async () => getTopPackages(client, selectedFilter),
		refetchOnMount: 'always',
	});

	return (
		<div className="relative">
			<div className="absolute right-0 mt-1">
				<FilterList
					lessSpacing
					options={['3D', '7D', '30D']}
					value={selectedFilter}
					onChange={(val) => setSelectedFilter(val)}
				/>
			</div>
			<TabHeader
				title="Popular Packages"
				tooltip="Popular packages is recomputed on epoch changes."
			>
				<ErrorBoundary>
					<TopPackagesTable data={data ?? []} isLoading={isPending} />
				</ErrorBoundary>
			</TabHeader>
		</div>
	);
}
