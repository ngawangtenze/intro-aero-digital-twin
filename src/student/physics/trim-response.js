const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TRIM_TOLERANCE = 1e-6;

function assertFiniteNumber(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

/**
 * Input angles are degrees. Output angle is radians.
 * Positive angle of attack follows the nose-up sign convention.
 */
export function degreesToRadians(angleDeg) {
  assertFiniteNumber(angleDeg, "angleDeg");
  return angleDeg * DEG_TO_RAD;
}

/**
 * Input angle is radians. Output angle is degrees.
 */
export function radiansToDegrees(angleRad) {
  assertFiniteNumber(angleRad, "angleRad");
  return angleRad * RAD_TO_DEG;
}

/**
 * cm0 is dimensionless, cmAlphaPerRad is 1/rad, and alphaRad is radians.
 * Output Cm is dimensionless.
 * Uses the linear, quasi-static Cm-alpha model.
 */
export function calculateCm(cm0, cmAlphaPerRad, alphaRad) {
  assertFiniteNumber(cm0, "cm0");
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(alphaRad, "alphaRad");

  return cm0 + cmAlphaPerRad * alphaRad;
}

/**
 * cm0 is dimensionless and cmAlphaPerRad is 1/rad.
 * Output trim angle is radians, or null when no unique trim angle exists.
 */
export function calculateTrimAngleRad(cm0, cmAlphaPerRad) {
  assertFiniteNumber(cm0, "cm0");
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");

  if (cmAlphaPerRad === 0) {
    return null;
  }

  return -cm0 / cmAlphaPerRad;
}

/**
 * disturbanceAlphaRad is radians and cmAlphaPerRad is 1/rad.
 * Output delta Cm is dimensionless.
 */
export function calculateDeltaCm(cmAlphaPerRad, disturbanceAlphaRad) {
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(disturbanceAlphaRad, "disturbanceAlphaRad");

  return cmAlphaPerRad * disturbanceAlphaRad;
}

/**
 * Uses the specified |Cm| <= 1e-6 trim criterion.
 */
export function isTrimmed(cm) {
  assertFiniteNumber(cm, "cm");
  return Math.abs(cm) <= TRIM_TOLERANCE;
}

/**
 * Classification uses disturbanceAlphaRad * deltaCm.
 * Negative is restoring, positive is destabilizing, zero is neutral.
 */
export function classifyDisturbance(disturbanceAlphaRad, deltaCm) {
  assertFiniteNumber(disturbanceAlphaRad, "disturbanceAlphaRad");
  assertFiniteNumber(deltaCm, "deltaCm");

  const tendencyProduct = disturbanceAlphaRad * deltaCm;

  if (tendencyProduct < 0) {
    return "restoring";
  }

  if (tendencyProduct > 0) {
    return "destabilizing";
  }

  return "neutral";
}

export function calculateTrimResponse({
  cm0,
  cmAlphaPerRad,
  angleOfAttackDeg,
  disturbanceAlphaDeg,
}) {
  assertFiniteNumber(cm0, "cm0");
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(angleOfAttackDeg, "angleOfAttackDeg");
  assertFiniteNumber(disturbanceAlphaDeg, "disturbanceAlphaDeg");

  const alphaRad = degreesToRadians(angleOfAttackDeg);
  const disturbanceAlphaRad = degreesToRadians(disturbanceAlphaDeg);

  const cm = calculateCm(cm0, cmAlphaPerRad, alphaRad);
  const trimAngleRad = calculateTrimAngleRad(cm0, cmAlphaPerRad);
  const deltaCm = calculateDeltaCm(
    cmAlphaPerRad,
    disturbanceAlphaRad,
  );

  return {
    cm,
    trimAngleDeg:
      trimAngleRad === null ? null : radiansToDegrees(trimAngleRad),
    deltaCm,
    trimmed: isTrimmed(cm),
    disturbanceTendency: classifyDisturbance(
      disturbanceAlphaRad,
      deltaCm,
    ),
  };
}

export { TRIM_TOLERANCE };