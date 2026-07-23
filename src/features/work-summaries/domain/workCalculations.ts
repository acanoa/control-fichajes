export type PunchType = 'entry' | 'break_start' | 'break_end' | 'exit';

export interface WorkPunch {
  type: PunchType;
  registeredAt: string | Date;
  hasIncident?: boolean;
}

export interface DailyCalculation {
  rawWorkedMinutes: number;
  breakMinutes: number;
  roundedWorkedMinutes: number;
  weightedMinutes: number;
  isComplete: boolean;
  hasIncident: boolean;
}

function elapsedMinutes(from: number, to: number): number {
  return Math.max(0, Math.round((to - from) / 60_000));
}

export function roundCompletedWorkMinutes(rawMinutes: number, isComplete: boolean): number {
  if (!Number.isFinite(rawMinutes) || rawMinutes < 0) {
    throw new RangeError('Los minutos trabajados deben ser un número positivo.');
  }
  return isComplete ? Math.floor(rawMinutes / 15) * 15 : rawMinutes;
}

/**
 * Especificación ejecutable del cálculo diario aplicado por
 * "Gestion_Fichajes".recalculate_employee_hours. PostgreSQL sigue siendo
 * la autoridad; esta función permite probar la regla sin duplicar persistencia.
 */
export function calculateDailyWork(punches: WorkPunch[], multiplier = 1): DailyCalculation {
  if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 5) {
    throw new RangeError('El multiplicador debe estar entre 0 y 5.');
  }

  const ordered = [...punches]
    .map((punch) => ({ ...punch, timestamp: new Date(punch.registeredAt).getTime() }))
    .sort((left, right) => left.timestamp - right.timestamp);

  if (ordered.some((punch) => !Number.isFinite(punch.timestamp))) {
    throw new TypeError('Todos los fichajes deben tener una fecha válida.');
  }

  let rawWorkedMinutes = 0;
  let breakMinutes = 0;
  let lastEntryAt: number | undefined;
  let breakStartedAt: number | undefined;

  for (const punch of ordered) {
    switch (punch.type) {
      case 'entry':
        lastEntryAt = punch.timestamp;
        break;
      case 'break_start':
        breakStartedAt = punch.timestamp;
        if (lastEntryAt !== undefined) {
          rawWorkedMinutes += elapsedMinutes(lastEntryAt, punch.timestamp);
          lastEntryAt = undefined;
        }
        break;
      case 'break_end':
        if (breakStartedAt !== undefined) {
          breakMinutes += elapsedMinutes(breakStartedAt, punch.timestamp);
          breakStartedAt = undefined;
        }
        lastEntryAt = punch.timestamp;
        break;
      case 'exit':
        if (lastEntryAt !== undefined) {
          rawWorkedMinutes += elapsedMinutes(lastEntryAt, punch.timestamp);
          lastEntryAt = undefined;
        }
        break;
    }
  }

  const isComplete = ordered.at(-1)?.type === 'exit';
  const roundedWorkedMinutes = roundCompletedWorkMinutes(rawWorkedMinutes, isComplete);

  return {
    rawWorkedMinutes,
    breakMinutes,
    roundedWorkedMinutes,
    weightedMinutes: Math.round(roundedWorkedMinutes * multiplier),
    isComplete,
    hasIncident: ordered.some((punch) => Boolean(punch.hasIncident)),
  };
}

export interface WeeklyCalculationInput {
  contractedMinutes: number;
  weightedWorkedMinutes: number;
  targetReductionMinutes?: number;
  specialTargetAdjustmentMinutes?: number;
  manualAdjustmentMinutes?: number;
}

export function calculateWeeklyOvertime(input: WeeklyCalculationInput) {
  const adjustedTargetMinutes = Math.max(
    0,
    input.contractedMinutes
      - (input.targetReductionMinutes ?? 0)
      - (input.specialTargetAdjustmentMinutes ?? 0),
  );
  const automaticOvertimeMinutes = Math.max(0, input.weightedWorkedMinutes - adjustedTargetMinutes);
  const finalOvertimeMinutes = Math.max(
    0,
    automaticOvertimeMinutes + (input.manualAdjustmentMinutes ?? 0),
  );
  return { adjustedTargetMinutes, automaticOvertimeMinutes, finalOvertimeMinutes };
}
