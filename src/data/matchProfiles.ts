export type MatchProfileKey =
  | 'o8' | 'o9' | 'o10' | 'o11' | 'o12' | 'o14' | 'o16'
  | 'senior' | 'zaal' | 'custom';

export interface MatchProfile {
  label: string;
  periods: number;
  periodMinutes: number;
  breakMinutes: number;
}

export const MATCH_PROFILES: Record<MatchProfileKey, MatchProfile> = {
  o8:     { label: 'O8',        periods: 4, periodMinutes: 8,  breakMinutes: 3  },
  o9:     { label: 'O9',        periods: 4, periodMinutes: 10, breakMinutes: 3  },
  o10:    { label: 'O10',       periods: 4, periodMinutes: 10, breakMinutes: 5  },
  o11:    { label: 'O11',       periods: 4, periodMinutes: 12, breakMinutes: 5  },
  o12:    { label: 'O12',       periods: 2, periodMinutes: 20, breakMinutes: 10 },
  o14:    { label: 'O14',       periods: 2, periodMinutes: 25, breakMinutes: 10 },
  o16:    { label: 'O16',       periods: 2, periodMinutes: 30, breakMinutes: 10 },
  senior: { label: 'Senioren',  periods: 2, periodMinutes: 35, breakMinutes: 10 },
  zaal:   { label: 'Zaal',      periods: 2, periodMinutes: 15, breakMinutes: 5  },
  custom: { label: 'Aangepast', periods: 2, periodMinutes: 25, breakMinutes: 10 },
};

export function getPeriodLabel(currentPeriod: number, totalPeriods: number): string {
  if (totalPeriods === 2) return currentPeriod === 1 ? '1e helft' : '2e helft';
  return `${currentPeriod}e kwart`;
}
