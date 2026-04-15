// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TOP_PACKAGES_REFRESH_INTERVAL, TopPackagesCard } from './TopPackagesCard';

const useQuerySpy = vi.fn();
const useSuiClientQuerySpy = vi.fn();
const topPackagesTableSpy = vi.fn();
const client = {};

vi.mock('@mysten/dapp-kit', () => ({
	useSuiClient: () => client,
	useSuiClientQuery: (...args: unknown[]) => useSuiClientQuerySpy(...args),
}));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: unknown) => {
		useQuerySpy(options);
		return {
			data: [],
			isPending: false,
		};
	},
}));

vi.mock('./TopPackagesTable', () => ({
	TopPackagesTable: (props: unknown) => {
		topPackagesTableSpy(props);
		return <div data-testid="top-packages-table" />;
	},
}));

vi.mock('~/ui/FilterList', () => ({
	FilterList: ({
		value,
		onChange,
	}: {
		value: string;
		onChange: (value: '3D' | '7D' | '30D') => void;
	}) => (
		<button type="button" onClick={() => onChange('7D')}>
			{value}
		</button>
	),
}));

vi.mock('~/ui/Tabs', () => ({
	TabHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../error-boundary/ErrorBoundary', () => ({
	ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('TopPackagesCard', () => {
	it('tracks current epoch changes and refreshes the top-packages query', () => {
		useQuerySpy.mockClear();
		useSuiClientQuerySpy.mockClear();
		topPackagesTableSpy.mockClear();
		useSuiClientQuerySpy.mockReturnValue({ data: '42' });

		render(<TopPackagesCard />);

		expect(useSuiClientQuerySpy).toHaveBeenCalledWith(
			'getLatestSuiSystemState',
			undefined,
			expect.objectContaining({
				refetchInterval: TOP_PACKAGES_REFRESH_INTERVAL,
				refetchIntervalInBackground: true,
				refetchOnMount: 'always',
				select: expect.any(Function),
			}),
		);
		expect(useQuerySpy).toHaveBeenCalledWith(
			expect.objectContaining({
				queryKey: ['top-packages', '3D', '42'],
				refetchOnMount: 'always',
			}),
		);
		expect(topPackagesTableSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				data: [],
				isLoading: false,
			}),
		);
	});

	it('rekeys the query when the selected time window changes', () => {
		useQuerySpy.mockClear();
		useSuiClientQuerySpy.mockClear();
		useSuiClientQuerySpy.mockReturnValue({ data: '42' });

		render(<TopPackagesCard />);
		fireEvent.click(screen.getByRole('button', { name: '3D' }));

		expect(useQuerySpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				queryKey: ['top-packages', '7D', '42'],
			}),
		);
	});
});
