// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type CheckpointPage, type SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { describe, expect, it } from 'vitest';

import {
	filterActivityTransactions,
	filterSystemCheckpoints,
	getActivityTransactionPage,
	getActivityFilterLabel,
	getTransactionKindFilter,
	isZeroSenderTransaction,
	isSystemOnlyCheckpoint,
	isSystemTransaction,
	isTransactionKindFilterSupported,
	PROGRAMMABLE_TRANSACTION_FILTER,
	SYSTEM_TRANSACTION_FILTER_LABEL,
	ZERO_SENDER_FILTER_LABEL,
} from './filters';
import { Network } from '~/utils/api/DefaultRpcClient';

function createTransaction(kind: string, digest: string, sender = '0x1') {
	return {
		digest,
		transaction: {
			data: {
				sender,
				transaction: {
					kind,
				},
			},
		},
	} as SuiTransactionBlockResponse;
}

function createCheckpoint(
	digest: string,
	transactions: string[],
): CheckpointPage['data'][number] {
	return {
		digest,
		transactions,
		sequenceNumber: '1',
		timestampMs: '1',
		epoch: '1',
		networkTotalTransactions: '1',
		computationCost: '1',
		storageCost: '1',
		storageRebate: '1',
		nonRefundableStorageFee: '1',
		validatorSignature: 'sig',
		checkpointCommitments: [],
		rollingGasSummary: {
			computationCost: '1',
			storageCost: '1',
			storageRebate: '1',
			nonRefundableStorageFee: '1',
		},
		previousDigest: null,
		endOfEpochData: null,
		epochRollingGasCostSummary: {
			computationCost: '1',
			storageCost: '1',
			storageRebate: '1',
			nonRefundableStorageFee: '1',
		},
	} as CheckpointPage['data'][number];
}

describe('activity filters', () => {
	it('supports transaction kind filtering only on mainnet and local', () => {
		expect(isTransactionKindFilterSupported(Network.LOCAL)).toBe(true);
		expect(isTransactionKindFilterSupported(Network.MAINNET)).toBe(true);
		expect(isTransactionKindFilterSupported(Network.DEVNET)).toBe(false);
		expect(isTransactionKindFilterSupported(Network.TESTNET)).toBe(false);
	});

	it('returns the programmable transaction filter only when the system filter is enabled', () => {
		expect(getTransactionKindFilter(true, Network.LOCAL)).toBe(PROGRAMMABLE_TRANSACTION_FILTER);
		expect(getTransactionKindFilter(false, Network.LOCAL)).toBeUndefined();
		expect(getTransactionKindFilter(true, Network.DEVNET)).toBeUndefined();
	});

	it('treats non-programmable transaction kinds as system transactions', () => {
		expect(isSystemTransaction(createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-1'))).toBe(false);
		expect(isSystemTransaction(createTransaction('ChangeEpoch', 'tx-2'))).toBe(true);
	});

	it('treats transactions from the zero sender as hidden activity rows', () => {
		expect(
			isZeroSenderTransaction(
				createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-1', '0x0000000000000000000000000000000000000000'),
			),
		).toBe(true);
		expect(isZeroSenderTransaction(createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-2', '0x2'))).toBe(
			false,
		);
		expect(
			filterActivityTransactions([
				createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-1', '0x0'),
				createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-2', '0x2'),
			]).map(({ digest }) => digest),
		).toEqual(['tx-2']);
		expect(
			filterActivityTransactions(
				[
					createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-1', '0x0'),
					createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-2', '0x2'),
				],
				true,
			).map(({ digest }) => digest),
		).toEqual(['tx-1', 'tx-2']);
	});

	it('requests more raw transaction pages when filtering leaves the current page underfilled', () => {
		expect(
			getActivityTransactionPage(
				[
					{
						data: [
							createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-1', '0x0'),
							createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-2', '0x0'),
						],
						hasNextPage: true,
						nextCursor: 'cursor-1',
					},
				],
				0,
				2,
				false,
			),
		).toEqual({
			transactions: [],
			hasNextPage: true,
			needsMoreData: true,
		});

		expect(
			getActivityTransactionPage(
				[
					{
						data: [
							createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-1', '0x0'),
							createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-2', '0x0'),
						],
						hasNextPage: true,
						nextCursor: 'cursor-1',
					},
					{
						data: [
							createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-3', '0x3'),
							createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-4', '0x4'),
						],
						hasNextPage: false,
						nextCursor: null,
					},
				],
				0,
				2,
				false,
			),
		).toEqual({
			transactions: [
				createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-3', '0x3'),
				createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-4', '0x4'),
			],
			hasNextPage: false,
			needsMoreData: false,
		});
	});

	it('hides checkpoints only when every transaction in the checkpoint is system-only', () => {
		const systemOnlyCheckpoint = createCheckpoint('cp-1', ['tx-1', 'tx-2']);
		const userCheckpoint = createCheckpoint('cp-2', ['tx-3']);
		const transactionsByDigest = new Map<string, SuiTransactionBlockResponse>([
			['tx-1', createTransaction('ChangeEpoch', 'tx-1')],
			['tx-2', createTransaction('ConsensusCommitPrologue', 'tx-2')],
			['tx-3', createTransaction(PROGRAMMABLE_TRANSACTION_FILTER, 'tx-3')],
		]);

		expect(isSystemOnlyCheckpoint(systemOnlyCheckpoint, transactionsByDigest)).toBe(true);
		expect(isSystemOnlyCheckpoint(userCheckpoint, transactionsByDigest)).toBe(false);
		expect(
			filterSystemCheckpoints(
				[systemOnlyCheckpoint, userCheckpoint],
				false,
				transactionsByDigest,
			).map((checkpoint) => checkpoint.digest),
		).toEqual(['cp-2']);
	});

	it('keeps checkpoints visible when transaction enrichment is incomplete', () => {
		const checkpoint = createCheckpoint('cp-1', ['tx-1']);

		expect(filterSystemCheckpoints([checkpoint], false, new Map())).toEqual([checkpoint]);
	});

	it('returns the correct filter label for each supported tab', () => {
		expect(getActivityFilterLabel('transactions')).toBe(SYSTEM_TRANSACTION_FILTER_LABEL);
		expect(getActivityFilterLabel('checkpoints')).toBe('Show System Checkpoints');
		expect(ZERO_SENDER_FILTER_LABEL).toBe('Show 0x0 Sender Transactions');
	});
});
