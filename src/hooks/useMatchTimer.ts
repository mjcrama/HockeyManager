import { useEffect, useRef, useState } from 'react';
import type { Match } from '../types';
import { getPeriodLabel } from '../data/matchProfiles';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function playEndBeep(volume: number) {
  if (volume <= 0) return;
  try {
    const ctx = new AudioContext();
    const gainLevel = (volume / 100) * 2.0; // intentionally > 1 to drive clipper hard

    // Hard clipper — forces signal to maximum output, creates harmonic-rich buzz
    const clipper = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const x = (i * 2) / 511 - 1;
      curve[i] = Math.max(-1, Math.min(1, x * 8)); // hard clip at ±1
    }
    clipper.curve = curve;

    // Compressor after clipper to keep output at max without distortion artifacts
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -3;
    compressor.knee.value = 1;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.05;

    clipper.connect(compressor);
    compressor.connect(ctx.destination);

    const roundDuration = 1.1;
    const pause = 2.0;

    // Frequencies in 2000–3000Hz range — peak of phone speaker output AND human hearing
    const layers: { freq: number; detune: number; type: OscillatorType }[] = [
      { freq: 2000, detune:   0, type: 'square'   }, // main: piercing, cuts through noise
      { freq: 2000, detune: +10, type: 'square'   }, // slightly detuned: beating effect
      { freq: 1000, detune:   0, type: 'sawtooth' }, // octave lower: body and fullness
    ];

    [0, 1, 2].forEach((round) => {
      const base = round * (roundDuration + pause);
      [0, 0.4, 0.8].forEach((offset) => {
        const t = base + offset;
        layers.forEach(({ freq, detune, type }) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(clipper);
          osc.type = type;
          osc.frequency.value = freq;
          osc.detune.value = detune;
          gain.gain.setValueAtTime(gainLevel, ctx.currentTime + t);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.45);
          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + 0.45);
        });
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

  // Silent audio loop — keeps iOS JS alive when screen is locked.
  // iOS suspends JS in PWAs unless audio is playing; this tiny near-zero
  // buffer running in a loop prevents that suspension.
  const silentCtxRef = useRef<AudioContext | null>(null);
  const silentSrcRef = useRef<AudioBufferSourceNode | null>(null);
  useEffect(() => {
    const isRunning = match.timerRunning || match.breakRunning;
    if (isRunning) {
      try {
        if (!silentCtxRef.current || silentCtxRef.current.state === 'closed') {
          silentCtxRef.current = new AudioContext();
        }
        const ctx = silentCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        // 1-second buffer of near-zero audio (not true silence — iOS detects that)
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 0.0002 - 0.0001;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(ctx.destination);
        src.start();
        silentSrcRef.current = src;
      } catch { /* audio not available */ }
    } else {
      try {
        silentSrcRef.current?.stop();
        silentSrcRef.current = null;
        silentCtxRef.current?.close();
        silentCtxRef.current = null;
      } catch { /* ignore */ }
    }
    return () => {
      try {
        silentSrcRef.current?.stop();
        silentSrcRef.current = null;
      } catch { /* ignore */ }
    };
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
      if (match.timerBeep > 0) playEndBeep(match.timerBeep);
      if (match.timerVibrate && 'vibrate' in navigator) navigator.vibrate([
        // Three rounds of: rapid buzz → pause → long pulse → pause
        80, 40, 80, 40, 80, 80, 400, 200,
        80, 40, 80, 40, 80, 80, 400, 200,
        80, 40, 80, 40, 80, 80, 600,
      ]);
    }

    const prevBreak = prevBreakSeconds.current;
    prevBreakSeconds.current = currentBreakSeconds;
    const breakEnded = match.breakRunning &&
      match.breakDuration > 0 &&
      prevBreak < match.breakDuration &&
      currentBreakSeconds >= match.breakDuration;

    if (breakEnded) {
      if (match.timerBeep > 0) playEndBeep(match.timerBeep);
      if (match.timerVibrate && 'vibrate' in navigator) navigator.vibrate([
        // Three rounds of: rapid buzz → pause → long pulse → pause
        80, 40, 80, 40, 80, 80, 400, 200,
        80, 40, 80, 40, 80, 80, 400, 200,
        80, 40, 80, 40, 80, 80, 600,
      ]);
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

  // Helper: duration of break after period i (0-based)
  function breakDurationAt(i: number): number {
    return match.breakDurations?.[i] ?? match.breakDuration;
  }
  function sumBreaks(count: number): number {
    let s = 0;
    for (let i = 0; i < count; i++) s += breakDurationAt(i);
    return s;
  }

  // Build match progress segments
  const progressSegments: ProgressSegment[] = [];
  let segOffset = 0;
  for (let i = 0; i < match.periods; i++) {
    progressSegments.push({ type: 'period', duration: match.timerDuration, start: segOffset });
    segOffset += match.timerDuration;
    if (i < match.periods - 1) {
      const bd = breakDurationAt(i);
      progressSegments.push({ type: 'break', duration: bd, start: segOffset });
      segOffset += bd;
    }
  }
  const totalMatchDuration = segOffset;

  const absolutePosition = isMatchOver
    ? totalMatchDuration
    : match.inBreak
      ? match.currentPeriod * match.timerDuration +
        sumBreaks(match.currentPeriod - 1) +
        currentBreakSeconds
      : (match.currentPeriod - 1) * match.timerDuration +
        sumBreaks(match.currentPeriod - 1) +
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
