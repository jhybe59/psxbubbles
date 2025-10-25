// gamma-corrected percent -> radius helper
export function createRadiusScale(maxAbsPct = 10, minR = 14, maxR = 160, gamma = 1.6) {
  const maxV = Math.max(1, Math.abs(maxAbsPct));
  return function(pctAbs) {
    const p = Math.max(0, Math.abs(pctAbs));
    const n = Math.min(1, p / maxV);
    const g = Math.pow(n, gamma);
    return minR + g * (maxR - minR);
  }
}
