// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { describe, expect, it, vi } from 'vitest';

import {
	aggregateMoveCallMetrics,
	collectMoveCalls,
	getTopPackages,
	selectTopPackagesForFilter,
	USER_SENT_TRANSACTION_FILTER,
} from './metrics';

function createMoveCallTransaction(
	digest: string,
	timestampMs: number,
	moveCall: {
		package: string;
		module: string;
		function: string;
	},
	sender = '0x2',
) {
	return {
		digest,
		timestampMs: timestampMs.toString(),
		transaction: {
			txSignatures: [],
			data: {
				sender,
				transaction: {
					kind: 'ProgrammableTransaction',
					transactions: [{ MoveCall: moveCall }],
				},
			},
		},
	} as unknown as SuiTransactionBlockResponse;
}

describe('top package metrics', () => {
	it('keeps selecting metrics by filter when a caller already has aggregated RPC data', () => {
		expect(
			selectTopPackagesForFilter(
				{
					rank3Days: [],
					rank7Days: [[{ package: '0x4', module: 'mod', function: 'fn' }, '1']],
					rank30Days: [],
				},
				'7D',
			),
		).toEqual([[{ package: '0x4', module: 'mod', function: 'fn' }, '1']]);
	});

	it('aggregates recent transaction blocks for popular packages', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-15T00:00:00Z'));

		const queryTransactionBlocks = vi
			.fn()
			.mockResolvedValueOnce({
				data: [
					createMoveCallTransaction('tx-1', Date.now() - 1_000, {
						package: '0x1',
						module: 'coin',
						function: 'mint',
					}),
					createMoveCallTransaction('tx-2', Date.now() - 2 * 24 * 60 * 60 * 1000, {
						package: '0x1',
						module: 'coin',
						function: 'mint',
					}),
				],
				hasNextPage: true,
				nextCursor: 'cursor-1',
			})
			.mockResolvedValueOnce({
				data: [
					createMoveCallTransaction('tx-3', Date.now() - 6 * 24 * 60 * 60 * 1000, {
						package: '0x2',
						module: 'swap',
						function: 'trade',
					}),
					createMoveCallTransaction('tx-4', Date.now() - 8 * 24 * 60 * 60 * 1000, {
						package: '0x3',
						module: 'old',
						function: 'drop',
					}),
				],
				hasNextPage: false,
				nextCursor: null,
			});

		await expect(getTopPackages({ queryTransactionBlocks }, '7D')).resolves.toEqual([
			[{ package: '0x1', module: 'coin', function: 'mint' }, '2'],
			[{ package: '0x2', module: 'swap', function: 'trade' }, '1'],
		]);
		expect(queryTransactionBlocks).toHaveBeenCalledTimes(2);
		expect(queryTransactionBlocks).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				filter: USER_SENT_TRANSACTION_FILTER,
				limit: 100,
				order: 'descending',
			}),
		);

		vi.useRealTimers();
	});

	it('drops move-call collection for programmable transactions sent from 0x0', () => {
		expect(
			collectMoveCalls(
				createMoveCallTransaction(
					'tx-system',
					Date.now(),
					{
						package: '0x1',
						module: 'pkg',
						function: 'call',
					},
					'0x0',
				),
			),
		).toEqual([]);
	});

	it('aggregates move calls by package, module, and function', () => {
		expect(
			aggregateMoveCallMetrics([
				createMoveCallTransaction('tx-1', Date.now(), {
					package: '0x1',
					module: 'pkg',
					function: 'call',
				}),
				createMoveCallTransaction('tx-2', Date.now(), {
					package: '0x1',
					module: 'pkg',
					function: 'call',
				}),
				createMoveCallTransaction('tx-3', Date.now(), {
					package: '0x2',
					module: 'other',
					function: 'read',
				}),
			]),
		).toEqual([
			[{ package: '0x1', module: 'pkg', function: 'call' }, '2'],
			[{ package: '0x2', module: 'other', function: 'read' }, '1'],
		]);
	});

	it('ignores programmable transactions sent from 0x0', () => {
		expect(
			aggregateMoveCallMetrics([
				createMoveCallTransaction(
					'tx-system',
					Date.now(),
					{
						package: '0x1',
						module: 'pkg',
						function: 'call',
					},
					'0x0',
				),
				createMoveCallTransaction('tx-user', Date.now(), {
					package: '0x2',
					module: 'other',
					function: 'read',
				}),
			]),
		).toEqual([[{ package: '0x2', module: 'other', function: 'read' }, '1']]);
	});
});
