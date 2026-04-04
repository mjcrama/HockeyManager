export type MatchProfileKey = 'p15' | 'p20' | 'p25' | 'p30' | 'custom';

export interface MatchProfile {
  label: string;
  periods: number;
  periodMinutes: number;
  breakMinutes: number;
}

export const MATCH_PROFILES: Record<MatchProfileKey, MatchProfile> = {
  p15:    { label: '2×15 +5',   periods: 2, periodMinutes: 15, breakMinutes: 5 },
  p20:    { label: '2×20 +5',   periods: 2, periodMinutes: 20, breakMinutes: 5 },
  p25:    { label: '2×25 +5',   periods: 2, periodMinutes: 25, breakMinutes: 5 },
  p30:    { label: '2×30 +5',   periods: 2, periodMinutes: 30, breakMinutes: 5 },
  custom: { label: 'Aangepast', periods: 2, periodMinutes: 25, breakMinutes: 5 },
};

export function getPeriodLabel(currentPeriod: number, totalPeriods: number): string {
  if (totalPeriods === 2) return currentPeriod === 1 ? '1e helft' : '2e helft';
  return `${currentPeriod}e kwart`;
}
