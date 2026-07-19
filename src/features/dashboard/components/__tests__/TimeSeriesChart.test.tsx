import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TimeSeriesChart } from '../TimeSeriesChart';
import type { RankedGate } from '@/types/csv';

describe('TimeSeriesChart', () => {
  it('renders nothing when no gates have a timestamp', () => {
    // Construct a dataset strictly without the timestamp property
    const rankedGatesWithoutTime: RankedGate[] = [
      {
        gate: {
          gate: 'Gate A',
          capacity: 1000,
          currentVisitors: 500,
          queueLength: 50,
          volunteerCount: 10,
          status: 'normal',
          transportDelay: 0,
          weather: 'Clear',
          medicalIncidents: 0
          // No timestamp provided
        },
        priorityScore: 10,
        rank: 1
      }
    ];

    const { container } = render(
      <TimeSeriesChart rankedGates={rankedGatesWithoutTime} />
    );

    // The component should return null, rendering an empty DOM
    expect(container.firstChild).toBeNull();
  });

  it('renders chart when timestamp is present', () => {
    const rankedGatesWithTime: RankedGate[] = [
      {
        gate: {
          gate: 'Gate B',
          capacity: 1000,
          currentVisitors: 500,
          queueLength: 50,
          volunteerCount: 10,
          status: 'normal',
          transportDelay: 0,
          weather: 'Clear',
          medicalIncidents: 0,
          timestamp: '2026-06-11T14:30:00Z'
        },
        priorityScore: 10,
        rank: 1
      }
    ];

    const { container } = render(
      <TimeSeriesChart rankedGates={rankedGatesWithTime} />
    );

    // The component should render the Card structure
    expect(container.querySelector('.recharts-responsive-container')).toBeDefined();
    // And it should not be null
    expect(container.firstChild).not.toBeNull();
  });
});
