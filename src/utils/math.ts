export function snapToNearestStep(value: number, step: number): number {
  if (step <= 0) {
    return Math.round(value);
  }
  return Math.round(value / step) * step;
}
