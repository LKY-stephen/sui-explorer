// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit';
import { ArrowRight12 } from '@mysten/icons';
import { Text } from '@mysten/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { filterSystemCheckpoints } from '../Activity/filters';
import { genTableDataFromCheckpointsData } from './utils';
import { useGetCheckpoints } from '~/hooks/useGetCheckpoints';
import { Link } from '~/ui/Link';
import { Pagination, useCursorPagination } from '~/ui/Pagination';
import { PlaceholderTable } from '~/ui/PlaceholderTable';
import { TableCard } from '~/ui/TableCard';
import { numberSuffix } from '~/utils/numberUtil';

const DEFAULT_CHECKPOINTS_LIMIT = 20;

interface Props {
	disablePagination?: boolean;
	refetchInterval?: number;
	initialLimit?: number;
	initialCursor?: string;
	maxCursor?: string;
	showSystemCheckpoints?: boolean;
}

export function CheckpointsTable({
	disablePagination,
	initialLimit = DEFAULT_CHECKPOINTS_LIMIT,
	initialCursor,
	maxCursor,
	showSystemCheckpoints = false,
}: Props) {
	const [limit, setLimit] = useState(initialLimit);
	const client = useSuiClient();

	const countQuery = useSuiClientQuery('getLatestCheckpointSequenceNumber');

	const checkpoints = useGetCheckpoints(initialCursor, limit);

	const { data, isFetching, pagination, isPending, isError } = useCursorPagination(checkpoints);

	const count = useMemo(() => {
		if (maxCursor) {
			if (initialCursor) {
				return Number(initialCursor) - Number(maxCursor);
			} else if (!isError && checkpoints.data) {
				// Special case for ongoing epoch
				return Number(checkpoints.data.pages[0].data[0].sequenceNumber) - Number(maxCursor);
			}
		} else {
			return Number(countQuery.data ?? 0);
		}
	}, [countQuery.data, initialCursor, maxCursor, checkpoints, isError]);

	const checkpointTransactionDigests = useMemo(
		() =>
			showSystemCheckpoints || !data
				? []
				: Array.from(new Set(data.data.flatMap((checkpoint) => checkpoint.transactions))),
		[data, showSystemCheckpoints],
	);
	const checkpointTransactions = useQuery({
		queryKey: ['checkpoint-transactions', checkpointTransactionDigests],
		queryFn: async () => {
			const transactions = await client.multiGetTransactionBlocks({
				digests: checkpointTransactionDigests,
				options: {
					showInput: true,
				},
			});

			return transactions.filter((transaction): transaction is NonNullable<typeof transaction> =>
				Boolean(transaction),
			);
		},
		enabled: checkpointTransactionDigests.length > 0,
		staleTime: 10 * 1000,
		retry: false,
	});
	const checkpointTransactionsByDigest = useMemo(
		() => new Map((checkpointTransactions.data ?? []).map((transaction) => [transaction.digest, transaction])),
		[checkpointTransactions.data],
	);
	const filteredData = useMemo(() => {
		if (!data) {
			return undefined;
		}

		return {
			...data,
			data: filterSystemCheckpoints(
				data.data,
				showSystemCheckpoints,
				checkpointTransactionsByDigest,
			),
		};
	}, [data, showSystemCheckpoints, checkpointTransactionsByDigest]);
	const isCheckpointFilterPending =
		!showSystemCheckpoints &&
		checkpointTransactionDigests.length > 0 &&
		(checkpointTransactions.isPending || checkpointTransactions.isFetching);
	const cardData =
		filteredData && !isCheckpointFilterPending
			? genTableDataFromCheckpointsData(filteredData)
			: undefined;

	return (
		<div className="flex flex-col space-y-3 text-left xl:pr-10">
			{isError && (
				<div className="pt-2 font-sans font-semibold text-issue-dark">
					Failed to load Checkpoints
				</div>
			)}
			{isPending || isFetching || isCheckpointFilterPending || !cardData ? (
				<PlaceholderTable
					rowCount={Number(limit)}
					rowHeight="16px"
					colHeadings={['Digest', 'Sequence Number', 'Time', 'Transaction Count']}
					colWidths={['100px', '120px', '204px', '90px', '38px']}
				/>
			) : (
				<div>
					<TableCard data={cardData.data} columns={cardData.columns} />
				</div>
			)}

			<div className="flex justify-between">
				{!disablePagination ? (
					<Pagination
						{...pagination}
						hasNext={
							maxCursor
								? Number(filteredData && filteredData.nextCursor) > Number(maxCursor)
								: pagination.hasNext
						}
					/>
				) : (
					<Link
						to="/recent?tab=checkpoints"
						after={<ArrowRight12 className="h-3 w-3 -rotate-45" />}
					>
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
								pagination.onFirst();
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
	);
}
