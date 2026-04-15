// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { render, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TransactionsActivityTable } from './TransactionsActivityTable';

const genTableDataFromTxDataSpy = vi.fn((transactions: { digest: string }[]) => ({
	data: transactions.map(({ digest }) => ({ digest })),
	columns: [{ header: 'Digest', accessorKey: 'digest' }],
}));

const mockFetchNextPage = vi.fn();
let mockTransactionsQuery: any = {
	data: {
		pages: [
			{
				data: [
					{
						digest: 'zero-sender',
						transaction: {
							data: {
								sender: '0x0',
								transaction: {
									kind: 'ProgrammableTransaction',
									transactions: [],
								},
							},
						},
					},
					{
						digest: 'user-sender',
						transaction: {
							data: {
								sender: '0x2',
								transaction: {
									kind: 'ProgrammableTransaction',
									transactions: [],
								},
							},
						},
					},
				],
				hasNextPage: false,
				nextCursor: null,
			},
		],
	},
	isFetching: false,
	isPending: false,
	isError: false,
	fetchNextPage: mockFetchNextPage,
	hasNextPage: false,
	isFetchingNextPage: false,
};

vi.mock('@mysten/dapp-kit', () => ({
	useSuiClient: () => ({
		getTotalTransactionBlocks: vi.fn().mockResolvedValue(2),
	}),
}));

vi.mock('@tanstack/react-query', () => ({
	useQuery: () => ({
		data: '2',
	}),
}));

vi.mock('../transactions/TxCardUtils', () => ({
	genTableDataFromTxData: (transactions: { digest: string }[]) =>
		genTableDataFromTxDataSpy(transactions),
}));

vi.mock('~/hooks/useGetTransactionBlocks', () => ({
	useGetTransactionBlocks: () => mockTransactionsQuery,
}));

vi.mock('~/ui/Pagination', () => ({
	Pagination: () => null,
}));

vi.mock('~/ui/Link', () => ({
	Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('~/ui/PlaceholderTable', () => ({
	PlaceholderTable: () => null,
}));

vi.mock('~/ui/TableCard', () => ({
	TableCard: () => <div data-testid="table-card" />,
}));

describe('TransactionsActivityTable', () => {
	it('filters zero-sender transactions before rendering the activity table', () => {
		genTableDataFromTxDataSpy.mockClear();
		mockFetchNextPage.mockClear();

		render(<TransactionsActivityTable initialLimit={20} />);

		expect(genTableDataFromTxDataSpy).toHaveBeenCalledWith([
			expect.objectContaining({ digest: 'user-sender' }),
		]);
	});

	it('can show zero-sender transactions when the filter is disabled', () => {
		genTableDataFromTxDataSpy.mockClear();
		mockFetchNextPage.mockClear();

		render(<TransactionsActivityTable initialLimit={20} showZeroSenderTransactions />);

		expect(genTableDataFromTxDataSpy).toHaveBeenCalledWith([
			expect.objectContaining({ digest: 'zero-sender' }),
			expect.objectContaining({ digest: 'user-sender' }),
		]);
	});

	it('fetches more raw pages when filtered rows leave the current page empty', async () => {
		genTableDataFromTxDataSpy.mockClear();
		mockFetchNextPage.mockClear();
		mockTransactionsQuery = {
			...mockTransactionsQuery,
			data: {
				pages: [
					{
						data: [
							{
								digest: 'zero-a',
								transaction: {
									data: {
										sender: '0x0',
										transaction: {
											kind: 'ProgrammableTransaction',
											transactions: [],
										},
									},
								},
							},
							{
								digest: 'zero-b',
								transaction: {
									data: {
										sender: '0x0',
										transaction: {
											kind: 'ProgrammableTransaction',
											transactions: [],
										},
									},
								},
							},
						],
						hasNextPage: true,
						nextCursor: 'cursor-1',
					},
				],
			},
			hasNextPage: true,
		};

		render(<TransactionsActivityTable initialLimit={2} />);

		await waitFor(() => {
			expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
		});
	});
});
