// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Activity } from '.';
import { Network } from '~/utils/api/DefaultRpcClient';

let currentNetwork = Network.LOCAL;
const transactionsTableSpy = vi.fn();
const checkpointsTableSpy = vi.fn();

vi.mock('./TransactionsActivityTable', () => ({
	TransactionsActivityTable: (props: unknown) => {
		transactionsTableSpy(props);
		return <div data-testid="transactions-table" />;
	},
}));

vi.mock('../checkpoints/CheckpointsTable', () => ({
	CheckpointsTable: (props: unknown) => {
		checkpointsTableSpy(props);
		return <div data-testid="checkpoints-table" />;
	},
}));

vi.mock('./EpochsActivityTable', () => ({
	EpochsActivityTable: () => <div data-testid="epochs-table" />,
}));

vi.mock('~/context', () => ({
	useNetwork: () => [currentNetwork, vi.fn()],
}));

vi.mock('~/ui/DropdownMenu', () => ({
	DropdownMenu: ({ content }: { content: ReactNode }) => <div>{content}</div>,
	DropdownMenuCheckboxItem: ({
		checked = false,
		label,
		onCheckedChange,
	}: {
		checked?: boolean;
		label: string;
		onCheckedChange?: () => void;
	}) => (
		<button type="button" onClick={() => onCheckedChange?.()}>
			{label}:{String(checked)}
		</button>
	),
}));

vi.mock('~/ui/PlayPause', () => ({
	PlayPause: () => <div data-testid="play-pause" />,
}));

describe('Activity', () => {
	it('only enables the programmable-transaction RPC filter when the system filter is turned on', async () => {
		currentNetwork = Network.LOCAL;
		transactionsTableSpy.mockClear();
		checkpointsTableSpy.mockClear();

		render(<Activity initialLimit={20} />);

		expect(screen.getByText('Filter System Transactions:false')).toBeTruthy();
		expect(screen.getByText('Show 0x0 Sender Transactions:false')).toBeTruthy();
		expect(transactionsTableSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				transactionKindFilter: undefined,
				showZeroSenderTransactions: false,
			}),
		);

		fireEvent.click(screen.getByRole('button', { name: 'Filter System Transactions:false' }));

		expect(screen.getByText('Filter System Transactions:true')).toBeTruthy();
		expect(transactionsTableSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({ transactionKindFilter: 'ProgrammableTransaction' }),
		);

		fireEvent.click(screen.getByRole('button', { name: 'Show 0x0 Sender Transactions:false' }));

		expect(screen.getByText('Show 0x0 Sender Transactions:true')).toBeTruthy();
		expect(transactionsTableSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				showZeroSenderTransactions: true,
			}),
		);
	});

	it('keeps the zero-sender transaction filter on unsupported networks', () => {
		currentNetwork = Network.DEVNET;
		transactionsTableSpy.mockClear();
		checkpointsTableSpy.mockClear();

		render(<Activity initialLimit={20} />);

		expect(screen.queryByText(/Filter System Transactions/)).toBeNull();
		expect(screen.getByText('Show 0x0 Sender Transactions:false')).toBeTruthy();
		expect(transactionsTableSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				transactionKindFilter: undefined,
				showZeroSenderTransactions: false,
			}),
		);
	});

	it('hides system checkpoints by default and lets the user reveal them', () => {
		currentNetwork = Network.LOCAL;
		transactionsTableSpy.mockClear();
		checkpointsTableSpy.mockClear();

		render(<Activity initialLimit={20} initialTab="checkpoints" />);

		expect(screen.getByText('Show System Checkpoints:false')).toBeTruthy();
		expect(checkpointsTableSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({ showSystemCheckpoints: false }),
		);

		fireEvent.click(screen.getByRole('button', { name: 'Show System Checkpoints:false' }));

		expect(screen.getByText('Show System Checkpoints:true')).toBeTruthy();
		expect(checkpointsTableSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({ showSystemCheckpoints: true }),
		);
	});
});
