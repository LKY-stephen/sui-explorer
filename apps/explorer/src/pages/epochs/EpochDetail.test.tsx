// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import EpochDetail from './EpochDetail';

const checkpointsTableSpy = vi.fn();

vi.mock('@mysten/core', () => ({
	useFormatCoin: () => ['1', 'SUI'],
}));

vi.mock('@mysten/dapp-kit', () => ({
	useSuiClient: () => ({
		getEpochs: vi.fn(),
	}),
	useSuiClientQuery: () => ({
		data: {
			epoch: '7',
		},
	}),
}));

vi.mock('@tanstack/react-query', () => ({
	useQuery: () => ({
		data: {
			data: [
				{
					epoch: '7',
					firstCheckpointId: '10',
					epochStartTimestamp: '100',
					endOfEpochInfo: {
						epochEndTimestamp: '200',
						totalStake: '1',
						stakeSubsidyAmount: '1',
						totalStakeRewardsDistributed: '1',
						totalGasFees: '1',
						storageFundBalance: '1',
						storageCharge: '1',
						storageRebate: '1',
						lastCheckpointId: '20',
					},
					validators: [],
				},
			],
		},
		isPending: false,
		isError: false,
	}),
}));

vi.mock('react-router-dom', () => ({
	useParams: () => ({
		id: '7',
	}),
}));

vi.mock('./stats/EpochProgress', () => ({
	EpochProgress: () => <div data-testid="epoch-progress" />,
}));

vi.mock('./stats/EpochStats', () => ({
	EpochStats: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./stats/ValidatorStatus', () => ({
	ValidatorStatus: () => <div data-testid="validator-status" />,
}));

vi.mock('../validators/Validators', () => ({
	validatorsTableData: () => ({
		data: [],
		columns: [],
	}),
}));

vi.mock('~/components/Layout/PageLayout', () => ({
	PageLayout: ({ content }: { content: ReactNode }) => <div>{content}</div>,
}));

vi.mock('~/components/checkpoints/CheckpointsTable', () => ({
	CheckpointsTable: (props: unknown) => {
		checkpointsTableSpy(props);
		return <div data-testid="checkpoints-table" />;
	},
}));

vi.mock('~/ui/Banner', () => ({
	Banner: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('~/ui/Stats', () => ({
	Stats: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('~/ui/TableCard', () => ({
	TableCard: () => <div data-testid="validators-table" />,
}));

vi.mock('~/ui/Tabs', () => ({
	Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
	TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('~/utils/getStorageFundFlow', () => ({
	getEpochStorageFundFlow: () => ({
		fundInflow: '1',
		fundOutflow: '1',
		netInflow: '1',
	}),
}));

describe('EpochDetail', () => {
	it('shows system checkpoints on the epoch detail checkpoints table', () => {
		checkpointsTableSpy.mockClear();

		render(<EpochDetail />);

		expect(checkpointsTableSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				showSystemCheckpoints: true,
			}),
		);
	});
});
