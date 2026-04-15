// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
	type MoveCallMetric,
	type MoveCallMetrics,
	type SuiClient,
	type SuiTransactionBlockResponse,
} from '@mysten/sui.js/client';

export type DateFilter = '3D' | '7D' | '30D';
export type ApiDateFilter = 'rank3Days' | 'rank7Days' | 'rank30Days';

export const FILTER_TO_API_FILTER: Record<DateFilter, ApiDateFilter> = {
	'3D': 'rank3Days',
	'7D': 'rank7Days',
	'30D': 'rank30Days',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const FILTER_TO_WINDOW_MS: Record<DateFilter, number> = {
	'3D': 3 * DAY_MS,
	'7D': 7 * DAY_MS,
	'30D': 30 * DAY_MS,
};
const FALLBACK_PAGE_LIMIT = 100;
const MAX_FALLBACK_PAGES = 50;
const MAX_TOP_PACKAGES = 20;

type MoveCallMetricsClient = Pick<SuiClient, 'getMoveCallMetrics' | 'queryTransactionBlocks'>;

export function selectTopPackagesForFilter(metrics: MoveCallMetrics, filter: DateFilter) {
	return metrics[FILTER_TO_API_FILTER[filter]];
}

export function collectMoveCalls(transaction: SuiTransactionBlockResponse) {
	const transactionData = transaction.transaction?.data.transaction;
	if (transactionData?.kind !== 'ProgrammableTransaction') {
		return [];
	}

	return transactionData.transactions.flatMap((entry) =>
		'MoveCall' in entry ? [entry.MoveCall] : [],
	);
}

export function aggregateMoveCallMetrics(transactions: SuiTransactionBlockResponse[]) {
	const counts = new Map<
		string,
		{
			target: MoveCallMetric[0];
			count: number;
		}
	>();

	for (const transaction of transactions) {
		for (const moveCall of collectMoveCalls(transaction)) {
			const key = `${moveCall.package}::${moveCall.module}::${moveCall.function}`;
			const existing = counts.get(key);
			if (existing) {
				existing.count += 1;
				continue;
			}

			counts.set(key, {
				target: {
					package: moveCall.package,
					module: moveCall.module,
					function: moveCall.function,
				},
				count: 1,
			});
		}
	}

	return Array.from(counts.values())
		.sort(
			(a, b) =>
				b.count - a.count ||
				a.target.package.localeCompare(b.target.package) ||
				a.target.module.localeCompare(b.target.module) ||
				a.target.function.localeCompare(b.target.function),
		)
		.slice(0, MAX_TOP_PACKAGES)
		.map(({ target, count }) => [target, count.toString()] satisfies MoveCallMetric);
}

export async function getTopPackagesFromTransactionBlocks(
	client: Pick<SuiClient, 'queryTransactionBlocks'>,
	filter: DateFilter,
) {
	const cutoff = Date.now() - FILTER_TO_WINDOW_MS[filter];
	const transactions: SuiTransactionBlockResponse[] = [];
	let cursor: string | null = null;

	for (let page = 0; page < MAX_FALLBACK_PAGES; page += 1) {
		const response = await client.queryTransactionBlocks({
			cursor,
			limit: FALLBACK_PAGE_LIMIT,
			order: 'descending',
			options: {
				showInput: true,
			},
		});
		if (!response.data.length) {
			break;
		}

		transactions.push(
			...response.data.filter((transaction) => {
				const timestamp = Number(transaction.timestampMs ?? 0);
				return !timestamp || timestamp >= cutoff;
			}),
		);

		const oldestTimestamp = response.data.reduce((oldest, transaction) => {
			const timestamp = Number(transaction.timestampMs ?? 0);
			if (!timestamp) {
				return oldest;
			}

			return oldest === null ? timestamp : Math.min(oldest, timestamp);
		}, null as number | null);
		if (!response.hasNextPage || !response.nextCursor || (oldestTimestamp !== null && oldestTimestamp < cutoff)) {
			break;
		}

		cursor = response.nextCursor;
	}

	return aggregateMoveCallMetrics(transactions);
}

export async function getTopPackages(client: MoveCallMetricsClient, filter: DateFilter) {
	try {
		return selectTopPackagesForFilter(await client.getMoveCallMetrics(), filter);
	} catch {
		return getTopPackagesFromTransactionBlocks(client, filter);
	}
}
