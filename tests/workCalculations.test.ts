import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDailyWork,
  calculateWeeklyOvertime,
  roundCompletedWorkMinutes,
} from '../src/features/work-summaries/domain/workCalculations.js';

test('calcula una jornada partida y descuenta el descanso', () => {
  const result = calculateDailyWork([
    { type: 'entry', registeredAt: '2026-07-20T06:00:00.000Z' },
    { type: 'break_start', registeredAt: '2026-07-20T10:00:00.000Z' },
    { type: 'break_end', registeredAt: '2026-07-20T10:30:00.000Z' },
    { type: 'exit', registeredAt: '2026-07-20T14:07:00.000Z' },
  ]);

  assert.deepEqual(result, {
    rawWorkedMinutes: 457,
    breakMinutes: 30,
    roundedWorkedMinutes: 450,
    weightedMinutes: 450,
    isComplete: true,
    hasIncident: false,
  });
});

test('no redondea a la baja una jornada todavía incompleta', () => {
  const result = calculateDailyWork([
    { type: 'entry', registeredAt: '2026-07-20T06:00:00.000Z' },
    { type: 'break_start', registeredAt: '2026-07-20T10:07:00.000Z', hasIncident: true },
  ], 1.5);

  assert.equal(result.roundedWorkedMinutes, 247);
  assert.equal(result.weightedMinutes, 371);
  assert.equal(result.isComplete, false);
  assert.equal(result.hasIncident, true);
});

test('aplica reducción de objetivo y ajustes sin producir horas extra negativas', () => {
  assert.deepEqual(calculateWeeklyOvertime({
    contractedMinutes: 2_400,
    weightedWorkedMinutes: 2_250,
    targetReductionMinutes: 480,
    manualAdjustmentMinutes: -500,
  }), {
    adjustedTargetMinutes: 1_920,
    automaticOvertimeMinutes: 330,
    finalOvertimeMinutes: 0,
  });
});

test('rechaza minutos y multiplicadores fuera de rango', () => {
  assert.throws(() => roundCompletedWorkMinutes(-1, true), RangeError);
  assert.throws(() => calculateDailyWork([], 5.1), RangeError);
});
