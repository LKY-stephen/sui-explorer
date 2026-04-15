// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { describe, expect, it, vi } from 'vitest';

import {
	aggregateMoveCallMetrics,
	getTopPackages,
	selectTopPackagesForFilter,
} from './metrics';

function createMoveCallTransaction(
	digest: string,
	timestampMs: number,
	moveCall: {
		package: string;
		module: string;
		function: string;
	},
) {
	return {
		digest,
		timestampMs: timestampMs.toString(),
		transaction: {
			txSignatures: [],
			data: {
				transaction: {
					kind: 'ProgrammableTransaction',
					transactions: [{ MoveCall: moveCall }],
				},
			},
		},
	} as unknown as SuiTransactionBlockResponse;
}

describe('top package metrics', () => {
	it('selects move-call metrics directly when the RPC method is available', async () => {
		const getMoveCallMetrics = vi.fn().mockResolvedValue({
			rank3Days: [[{ package: '0x1', module: 'm', function: 'a' }, '3']],
			rank7Days: [[{ package: '0x2', module: 'm', function: 'b' }, '7']],
			rank30Days: [[{ package: '0x3', module: 'm', function: 'c' }, '30']],
		});
		const queryTransactionBlocks = vi.fn();

		await expect(
			getTopPackages({ getMoveCallMetrics, queryTransactionBlocks }, '7D'),
		).resolves.toEqual([[{ package: '0x2', module: 'm', function: 'b' }, '7']]);
		expect(queryTransactionBlocks).not.toHaveBeenCalled();
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

	it('falls back to recent transaction blocks when move-call metrics are unavailable', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-15T00:00:00Z'));

		const getMoveCallMetrics = vi.fn().mockRejectedValue(new Error('Method not found'));
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

		await expect(
			getTopPackages({ getMoveCallMetrics, queryTransactionBlocks }, '7D'),
		).resolves.toEqual([
			[{ package: '0x1', module: 'coin', function: 'mint' }, '2'],
			[{ package: '0x2', module: 'swap', function: 'trade' }, '1'],
		]);
		expect(queryTransactionBlocks).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
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
});
