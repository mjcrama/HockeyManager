import { useEffect, useRef, useState } from 'react';
import type { Match } from '../types';
import { getPeriodLabel } from '../data/matchProfiles';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function playEndBeep(volume: 'soft' | 'loud') {
  try {
    const ctx = new AudioContext();
    const gainLevel = volume === 'loud' ? 1.0 : 0.3;
    const roundDuration = 1.1;
    const pause = 2.0;
    [0, 1, 2].forEach((round) => {
      const base = round * (roundDuration + pause);
      [0, 0.4, 0.8].forEach((offset) => {
        const t = base + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(gainLevel, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.3);
      });
    });
  } catch { /* audio not available */ }
}

interface ProgressSegment {
  type: 'period' | 'break';
  duration: number;
  start: number;
}

export interface MatchTimerState {
  currentSeconds: number;
  currentBreakSeconds: number;
  displayTime: string;
  displayBreakTime: string;
  isOvertime: boolean;
  isBreakOvertime: boolean;
  isMatchOver: boolean;
  isLastPeriod: boolean;
  isPaused: boolean;
  periodLabel: string;
  nextPeriodLabel: string;
  endPeriodLabel: string;
  progressSegments: ProgressSegment[];
  totalMatchDuration: number;
  absolutePosition: number;
}

export function useMatchTimer(match: Match): MatchTimerState {
  // Local tick to trigger re-renders while running
  const [, tick] = useState(0);
  useEffect(() => {
    if (!match.timerRunning && !match.breakRunning) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [match.timerRunning, match.breakRunning]);

  // Compute current elapsed seconds from wall clock
  const currentSeconds = match.timerRunning && match.timerStartedAt != null
    ? match.timerSeconds + Math.floor((Date.now() - match.timerStartedAt) / 1000)
    : match.timerSeconds;

  const currentBreakSeconds = match.breakRunning && match.breakStartedAt != null
    ? match.breakSeconds + Math.floor((Date.now() - match.breakStartedAt) / 1000)
    : match.breakSeconds;

  // Beep + vibrate when period/break timer crosses duration
  const prevSeconds = useRef(currentSeconds);
  const prevBreakSeconds = useRef(currentBreakSeconds);
  useEffect(() => {
    const prev = prevSeconds.current;
    prevSeconds.current = currentSeconds;
    const periodEnded = match.timerRunning &&
      match.timerDuration > 0 &&
      prev < match.timerDuration &&
      currentSeconds >= match.timerDuration;

    if (periodEnded) {
      if (match.timerBeep !== 'off') playEndBeep(match.timerBeep);
      if (match.timerVibrate && 'vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 300]);
    }

    const prevBreak = prevBreakSeconds.current;
    prevBreakSeconds.current = currentBreakSeconds;
    const breakEnded = match.breakRunning &&
      match.breakDuration > 0 &&
      prevBreak < match.breakDuration &&
      currentBreakSeconds >= match.breakDuration;

    if (breakEnded) {
      if (match.timerBeep !== 'off') playEndBeep(match.timerBeep);
      if (match.timerVibrate && 'vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 300]);
    }
  });

  const isOvertime = match.timerDuration > 0 && currentSeconds >= match.timerDuration;
  const isBreakOvertime = match.inBreak && match.breakDuration > 0 && currentBreakSeconds >= match.breakDuration;
  const isMatchOver = match.currentPeriod > match.periods && !match.inBreak;
  const isLastPeriod = match.currentPeriod >= match.periods;

  const displaySeconds = match.timerCountDown
    ? isOvertime
      ? currentSeconds - match.timerDuration
      : match.timerDuration - currentSeconds
    : currentSeconds;

  const displayBreakSeconds = isBreakOvertime
    ? currentBreakSeconds - match.breakDuration
    : match.breakDuration - currentBreakSeconds;

  const displayTime = (isOvertime && match.timerCountDown ? '+' : '') + formatTime(displaySeconds);
  const displayBreakTime = (isBreakOvertime ? '+' : '') + formatTime(displayBreakSeconds);

  const isPaused = (!match.timerRunning && !match.inBreak && !isMatchOver)
    || (match.inBreak && !match.breakRunning);

  const periodLabel = isMatchOver
    ? 'Wedstrijd afgelopen'
    : match.inBreak
      ? 'Rust'
      : getPeriodLabel(match.currentPeriod, match.periods);

  const nextPeriodLabel = getPeriodLabel(match.currentPeriod + 1, match.periods);
  const endPeriodLabel = isLastPeriod ? 'Wedstrijd beëindigen' : `Einde ${getPeriodLabel(match.currentPeriod, match.periods)} →`;

  // Build match progress segments
  const progressSegments: ProgressSegment[] = [];
  let segOffset = 0;
  for (let i = 0; i < match.periods; i++) {
    progressSegments.push({ type: 'period', duration: match.timerDuration, start: segOffset });
    segOffset += match.timerDuration;
    if (i < match.periods - 1) {
      progressSegments.push({ type: 'break', duration: match.breakDuration, start: segOffset });
      segOffset += match.breakDuration;
    }
  }
  const totalMatchDuration = segOffset;

  const absolutePosition = isMatchOver
    ? totalMatchDuration
    : match.inBreak
      ? match.currentPeriod * match.timerDuration +
        (match.currentPeriod - 1) * match.breakDuration +
        currentBreakSeconds
      : (match.currentPeriod - 1) * match.timerDuration +
        (match.currentPeriod - 1) * match.breakDuration +
        currentSeconds;

  return {
    currentSeconds,
    currentBreakSeconds,
    displayTime,
    displayBreakTime,
    isOvertime,
    isBreakOvertime,
    isMatchOver,
    isLastPeriod,
    isPaused,
    periodLabel,
    nextPeriodLabel,
    endPeriodLabel,
    progressSegments,
    totalMatchDuration,
    absolutePosition,
  };
}

export { formatTime };
