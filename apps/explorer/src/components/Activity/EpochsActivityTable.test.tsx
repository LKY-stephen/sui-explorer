// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { type EpochPage } from '@mysten/sui.js/client';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EpochsActivityTable } from './EpochsActivityTable';

type MockCursorPaginationState = {
	data?: EpochPage;
	isPending: boolean;
	isError: boolean;
	pagination: {
		hasNext: boolean;
		hasPrev: boolean;
		onFirst: ReturnType<typeof vi.fn>;
		onNext: ReturnType<typeof vi.fn>;
		onPrev: ReturnType<typeof vi.fn>;
	};
};

const mockCursorPaginationState: MockCursorPaginationState = {
	data: {
		data: [
			{
				epoch: '7',
				epochTotalTransactions: '12',
				firstCheckpointId: '100',
				epochStartTimestamp: '10',
				endOfEpochInfo: {
					epochEndTimestamp: '20',
					totalStakeRewardsDistributed: '1',
					lastCheckpointId: '101',
					storageCharge: '2',
					storageRebate: '1',
				},
			},
		],
	} as EpochPage,
	isPending: false,
	isError: false,
	pagination: {
		hasNext: false,
		hasPrev: false,
		onFirst: vi.fn(),
		onNext: vi.fn(),
		onPrev: vi.fn(),
	},
};

vi.mock('@mysten/dapp-kit', () => ({
	useSuiClient: () => ({
		getCurrentEpoch: vi.fn().mockResolvedValue({
			epoch: '7',
		}),
	}),
}));

vi.mock('@tanstack/react-query', () => ({
	useQuery: () => ({
		data: 8,
	}),
}));

vi.mock('./useGetEpochs', () => ({
	useGetEpochs: () => ({}),
}));

vi.mock('./utils', () => ({
	genTableDataFromEpochsData: () => ({
		data: [{ epoch: '7' }],
		columns: [{ header: 'Epoch', accessorKey: 'epoch' }],
	}),
}));

vi.mock('~/ui/Pagination', () => ({
	Pagination: () => null,
	useCursorPagination: () => mockCursorPaginationState,
}));

vi.mock('~/ui/Link', () => ({
	Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('~/ui/PlaceholderTable', () => ({
	PlaceholderTable: () => <div data-testid="epochs-placeholder" />,
}));

vi.mock('~/ui/TableCard', () => ({
	TableCard: () => <div data-testid="epochs-table-card" />,
}));

vi.mock('@mysten/ui', () => ({
	Text: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('EpochsActivityTable', () => {
	it('keeps rendering the last good table during a transient refetch failure', () => {
		mockCursorPaginationState.isError = true;

		render(<EpochsActivityTable initialLimit={20} />);

		expect(screen.getByTestId('epochs-table-card')).toBeTruthy();
		expect(screen.queryByText('Failed to load Epochs')).toBeNull();
		expect(screen.queryByTestId('epochs-placeholder')).toBeNull();
	});

	it('shows the epoch failure state when no epoch data is available', () => {
		mockCursorPaginationState.isError = true;
		mockCursorPaginationState.data = undefined;

		render(<EpochsActivityTable initialLimit={20} />);

		expect(screen.getByText('Failed to load Epochs')).toBeTruthy();
		expect(screen.getByTestId('epochs-placeholder')).toBeTruthy();
	});
});
