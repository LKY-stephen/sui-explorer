// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSuiClient } from '@mysten/dapp-kit';
import { ArrowRight12 } from '@mysten/icons';
import { Text } from '@mysten/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { genTableDataFromTxData } from '../transactions/TxCardUtils';
import { getActivityTransactionPage } from './filters';
import { useGetTransactionBlocks } from '~/hooks/useGetTransactionBlocks';
import { Link } from '~/ui/Link';
import { Pagination } from '~/ui/Pagination';
import { PlaceholderTable } from '~/ui/PlaceholderTable';
import { TableCard } from '~/ui/TableCard';
import { numberSuffix } from '~/utils/numberUtil';

const DEFAULT_TRANSACTIONS_LIMIT = 20;

interface Props {
	disablePagination?: boolean;
	refetchInterval?: number;
	initialLimit?: number;
	transactionKindFilter?: 'ProgrammableTransaction';
	showZeroSenderTransactions?: boolean;
}

export function TransactionsActivityTable({
	disablePagination,
	refetchInterval,
	initialLimit = DEFAULT_TRANSACTIONS_LIMIT,
	transactionKindFilter,
	showZeroSenderTransactions = false,
}: Props) {
	const [limit, setLimit] = useState(initialLimit);
	const [currentPage, setCurrentPage] = useState(0);
	const client = useSuiClient();
	const { data: count } = useQuery({
		queryKey: ['transactions', 'count'],
		queryFn: () => client.getTotalTransactionBlocks(),
		gcTime: 24 * 60 * 60 * 1000,
		staleTime: Infinity,
		retry: false,
	});
	const transactions = useGetTransactionBlocks(
		transactionKindFilter ? { TransactionKind: transactionKindFilter } : undefined,
		limit,
		refetchInterval,
	);
	const {
		data,
		isFetching,
		isPending,
		isError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = transactions;
	const rawPages = data?.pages ?? [];
	const filteredPage = useMemo(
		() => getActivityTransactionPage(rawPages, currentPage, limit, showZeroSenderTransactions),
		[rawPages, currentPage, limit, showZeroSenderTransactions],
	);
	const cardData =
		data && !filteredPage.needsMoreData
			? genTableDataFromTxData(filteredPage.transactions)
			: undefined;

	useEffect(() => {
		setCurrentPage(0);
	}, [transactionKindFilter, showZeroSenderTransactions, limit]);

	useEffect(() => {
		if (filteredPage.needsMoreData && hasNextPage && !isFetchingNextPage && !isError) {
			void fetchNextPage();
		}
	}, [fetchNextPage, filteredPage.needsMoreData, hasNextPage, isError, isFetchingNextPage]);
	return (
		<div data-testid="tx">
			{isError && (
				<div className="pt-2 font-sans font-semibold text-issue-dark">
					Failed to load Transactions
				</div>
			)}
			<div className="flex flex-col space-y-3 text-left">
				{isPending || (filteredPage.needsMoreData && !isError) || !cardData ? (
					<PlaceholderTable
						rowCount={limit}
						rowHeight="16px"
						colHeadings={['Digest', 'Sender', 'Txns', 'Gas', 'Time']}
						colWidths={['30%', '30%', '10%', '20%', '10%']}
					/>
				) : (
					<div>
						<TableCard data={cardData.data} columns={cardData.columns} />
					</div>
				)}

				<div className="flex justify-between">
					{!disablePagination ? (
						<Pagination
							hasPrev={currentPage !== 0}
							hasNext={filteredPage.hasNextPage}
							onFirst={() => setCurrentPage(0)}
							onPrev={() => setCurrentPage((page) => Math.max(page - 1, 0))}
							onNext={() => {
								if (!filteredPage.hasNextPage || isFetching || isFetchingNextPage) {
									return;
								}

								setCurrentPage((page) => page + 1);
							}}
						/>
					) : (
						<Link to="/recent" after={<ArrowRight12 className="h-3 w-3 -rotate-45" />}>
							View all
						</Link>
					)}

					<div className="flex items-center space-x-3">
						<Text variant="body/medium" color="steel-dark">
							{count ? numberSuffix(Number(count)) : '-'}
							{` Total`}
						</Text>
						{!disablePagination && (
							<select
								className="form-select rounded-md border border-gray-45 px-3 py-2 pr-8 text-bodySmall font-medium leading-[1.2] text-steel-dark shadow-button"
								value={limit}
								onChange={(e) => {
									setLimit(Number(e.target.value));
								}}
							>
								<option value={20}>20 Per Page</option>
								<option value={40}>40 Per Page</option>
								<option value={60}>60 Per Page</option>
							</select>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
