// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
	type CheckpointPage,
	type PaginatedTransactionResponse,
	type SuiTransactionBlockResponse,
} from '@mysten/sui.js/client';
import { normalizeSuiAddress } from '@mysten/sui.js/utils';

import { Network } from '~/utils/api/DefaultRpcClient';

export const PROGRAMMABLE_TRANSACTION_FILTER = 'ProgrammableTransaction' as const;
export const ZERO_SENDER_ADDRESS = normalizeSuiAddress('0x0');
export const ZERO_SENDER_FILTER_LABEL = 'Show 0x0 Sender Transactions';
export const SYSTEM_TRANSACTION_FILTER_LABEL = 'Filter System Transactions';

export function isTransactionKindFilterSupported(network: string) {
	return network === Network.MAINNET || network === Network.LOCAL;
}

export function getTransactionKindFilter(
	filterSystemTransactions: boolean,
	network: string,
): typeof PROGRAMMABLE_TRANSACTION_FILTER | undefined {
	return filterSystemTransactions && isTransactionKindFilterSupported(network)
		? PROGRAMMABLE_TRANSACTION_FILTER
		: undefined;
}

export function isSystemTransaction(transaction: SuiTransactionBlockResponse) {
	return transaction.transaction?.data.transaction.kind !== PROGRAMMABLE_TRANSACTION_FILTER;
}

export function isZeroSenderTransaction(transaction: SuiTransactionBlockResponse) {
	const sender = transaction.transaction?.data.sender;

	return !!sender && normalizeSuiAddress(sender) === ZERO_SENDER_ADDRESS;
}

export function filterActivityTransactions(
	transactions: SuiTransactionBlockResponse[],
	showZeroSenderTransactions = false,
) {
	if (showZeroSenderTransactions) {
		return transactions;
	}

	return transactions.filter((transaction) => !isZeroSenderTransaction(transaction));
}

export function getActivityTransactionPage(
	pages: PaginatedTransactionResponse[],
	currentPage: number,
	limit: number,
	showZeroSenderTransactions: boolean,
) {
	const filteredTransactions = filterActivityTransactions(
		pages.flatMap(({ data }) => data),
		showZeroSenderTransactions,
	);
	const start = currentPage * limit;
	const end = start + limit;
	const lastLoadedPage = pages[pages.length - 1];

	return {
		transactions: filteredTransactions.slice(start, end),
		hasNextPage: filteredTransactions.length > end || !!lastLoadedPage?.hasNextPage,
		needsMoreData: !!lastLoadedPage?.hasNextPage && filteredTransactions.length < end,
	};
}

export function isSystemOnlyCheckpoint(
	checkpoint: CheckpointPage['data'][number],
	transactionsByDigest: Map<string, SuiTransactionBlockResponse>,
) {
	if (!checkpoint.transactions.length) {
		return false;
	}

	return checkpoint.transactions.every((digest) => {
		const transaction = transactionsByDigest.get(digest);

		return transaction ? isSystemTransaction(transaction) : false;
	});
}

export function filterSystemCheckpoints(
	checkpoints: CheckpointPage['data'],
	showSystemCheckpoints: boolean,
	transactionsByDigest: Map<string, SuiTransactionBlockResponse>,
) {
	if (showSystemCheckpoints) {
		return checkpoints;
	}

	return checkpoints.filter(
		(checkpoint) => !isSystemOnlyCheckpoint(checkpoint, transactionsByDigest),
	);
}

export function getActivityFilterLabel(tab: 'transactions' | 'checkpoints') {
	return tab === 'transactions' ? SYSTEM_TRANSACTION_FILTER_LABEL : 'Show System Checkpoints';
}
