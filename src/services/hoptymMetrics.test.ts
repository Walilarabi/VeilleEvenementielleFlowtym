import { describe, expect, it } from 'bun:test';
import {
  calculateMeanLeadTime,
  calculateNetPickup,
  calculateOccupancyPercent,
  median,
  summarizeCompetitorRates,
} from './hoptymMetrics.ts';

describe('HOPTYM RM metrics', () => {
  it('calculates odd and even medians', () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([1, 2, 9, 10])).toBe(5.5);
    expect(median([])).toBeNull();
  });

  it('summarizes competitor rates without mixing invalid values', () => {
    const result = summarizeCompetitorRates([
      { competitor_name: 'Hotel A', rate_amount: 120 },
      { competitor_name: 'hotel a', rate_amount: 140 },
      { competitor_name: 'Hotel B', rate_amount: 180 },
      { competitor_name: 'Hotel C', rate_amount: null },
      { competitor_name: 'Hotel D', rate_amount: -5 },
    ]);
    expect(result.median).toBe(140);
    expect(result.minimum).toBe(120);
    expect(result.maximum).toBe(180);
    expect(result.observationCount).toBe(3);
    expect(result.competitorCount).toBe(2);
  });

  it('calculates net pickup including cancellations and moves', () => {
    expect(calculateNetPickup({ newRoomsBooked: 12, cancelledRooms: 3, movedInRooms: 2, movedOutRooms: 1 })).toBe(10);
    expect(calculateNetPickup({})).toBe(0);
  });

  it('calculates mean lead time while ignoring missing values', () => {
    expect(calculateMeanLeadTime([2, 4, null, 6])).toBe(4);
    expect(calculateMeanLeadTime([null, undefined])).toBeNull();
  });

  it('calculates bounded occupancy percentages', () => {
    expect(calculateOccupancyPercent(30, 40)).toBe(75);
    expect(calculateOccupancyPercent(50, 40)).toBe(100);
    expect(calculateOccupancyPercent(10, 0)).toBeNull();
  });
});
