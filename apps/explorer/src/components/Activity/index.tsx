// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Filter16 } from '@mysten/icons';
import { Heading } from '@mysten/ui';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { CheckpointsTable } from "../checkpoints/CheckpointsTable";
import { EpochsActivityTable } from './EpochsActivityTable';
import { TransactionsActivityTable } from "./TransactionsActivityTable";
import {
	getActivityFilterLabel,
	getTransactionKindFilter,
	isTransactionKindFilterSupported,
	SYSTEM_TRANSACTION_FILTER_LABEL,
	ZERO_SENDER_FILTER_LABEL,
} from './filters';
import { useNetwork } from '~/context';
import { DropdownMenu, DropdownMenuCheckboxItem } from '~/ui/DropdownMenu';
import { PlayPause } from '~/ui/PlayPause';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/ui/Tabs';

const VALID_TABS = ['transactions', 'epochs', 'checkpoints'];

type Props = {
	initialTab?: string | null;
	initialLimit: number;
	disablePagination?: boolean;
};

const AUTO_REFRESH_ID = 'auto-refresh';
const REFETCH_INTERVAL_SECONDS = 10;
const REFETCH_INTERVAL = REFETCH_INTERVAL_SECONDS * 1000;

export function Activity({ initialTab, initialLimit, disablePagination }: Props) {
	const pollingTxnTableEnabled = true;

	const [paused, setPaused] = useState(false);
	const [activeTab, setActiveTab] = useState(() =>
		initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'transactions',
	);
	const [network] = useNetwork();
	const isTransactionFilterVisible =
		activeTab === 'transactions' && isTransactionKindFilterSupported(network);
	const [filterSystemTransactions, setFilterSystemTransactions] = useState(false);
	const [showZeroSenderTransactions, setShowZeroSenderTransactions] = useState(false);
	const [showSystemCheckpoints, setShowSystemCheckpoints] = useState(false);

	const handlePauseChange = () => {
		if (paused) {
			toast.success(`Auto-refreshing on - every ${REFETCH_INTERVAL_SECONDS} seconds`, {
				id: AUTO_REFRESH_ID,
			});
		} else {
			toast.success('Auto-refresh paused', { id: AUTO_REFRESH_ID });
		}

		setPaused((paused) => !paused);
	};

	const refetchInterval = paused || !pollingTxnTableEnabled ? undefined : REFETCH_INTERVAL;
	useEffect(() => {
		if (!isTransactionKindFilterSupported(network)) {
			setFilterSystemTransactions(false);
		}
	}, [network]);

	const isCheckpointFilterVisible = activeTab === 'checkpoints';
	const isTransactionFilterMenuVisible = activeTab === 'transactions';
	const isFilterVisible = isTransactionFilterMenuVisible || isCheckpointFilterVisible;

	return (
		<div>
			<Tabs size="lg" value={activeTab} onValueChange={setActiveTab}>
				<div className="relative">
					<TabsList>
						<TabsTrigger value="transactions">
							<Heading variant="heading4/semibold">Transaction Blocks</Heading>
						</TabsTrigger>
						<TabsTrigger value="epochs">
							<Heading variant="heading4/semibold">Epochs</Heading>
						</TabsTrigger>
						<TabsTrigger value="checkpoints">
							<Heading variant="heading4/semibold">Checkpoints</Heading>
						</TabsTrigger>
					</TabsList>
					<div className="absolute inset-y-0 -top-1 right-0 flex items-center gap-3 text-2xl">
						{isFilterVisible ? (
							<DropdownMenu
								trigger={<Filter16 className="p-1" />}
								content={
									isCheckpointFilterVisible ? (
										<DropdownMenuCheckboxItem
											checked={showSystemCheckpoints}
											label={getActivityFilterLabel('checkpoints')}
											onSelect={(e) => {
												e.preventDefault();
											}}
											onCheckedChange={() => {
												setShowSystemCheckpoints((value) => !value);
											}}
										/>
									) : (
										<>
											{isTransactionFilterVisible ? (
												<DropdownMenuCheckboxItem
													checked={filterSystemTransactions}
													label={SYSTEM_TRANSACTION_FILTER_LABEL}
													onSelect={(e) => {
														e.preventDefault();
													}}
													onCheckedChange={() => {
														setFilterSystemTransactions((value) => !value);
													}}
												/>
											) : null}
											<DropdownMenuCheckboxItem
												checked={showZeroSenderTransactions}
												label={ZERO_SENDER_FILTER_LABEL}
												onSelect={(e) => {
													e.preventDefault();
												}}
												onCheckedChange={() => {
													setShowZeroSenderTransactions((value) => !value);
												}}
											/>
										</>
									)
								}
								modal={false}
								align="end"
							/>
						) : null}
						{/* todo: re-enable this when rpc is stable */}
						{pollingTxnTableEnabled && activeTab === 'transactions' && (
							<PlayPause paused={paused} onChange={handlePauseChange} />
						)}
					</div>
				</div>
				<TabsContent value="transactions">
					<TransactionsActivityTable
						refetchInterval={refetchInterval}
						initialLimit={initialLimit}
						disablePagination={disablePagination}
						transactionKindFilter={getTransactionKindFilter(filterSystemTransactions, network)}
						showZeroSenderTransactions={showZeroSenderTransactions}
					/>
				</TabsContent>
				<TabsContent value="epochs">
					<EpochsActivityTable
						refetchInterval={refetchInterval}
						initialLimit={initialLimit}
						disablePagination={disablePagination}
					/>
				</TabsContent>
				<TabsContent value="checkpoints">
					<CheckpointsTable
						refetchInterval={refetchInterval}
						initialLimit={initialLimit}
						disablePagination={disablePagination}
						showSystemCheckpoints={showSystemCheckpoints}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
