import { describe, expect, it } from "vitest";

import {
  calculateCm,
  calculateDeltaCm,
  calculateTrimAngleRad,
  calculateTrimResponse,
  classifyDisturbance,
  degreesToRadians,
  isTrimmed,
  radiansToDegrees,
} from "../../src/student/physics/trim-response.js";

const TOLERANCE = 1e-6;

const REFERENCE_CM = 0.00006686671436974267;
const REFERENCE_TRIM_ANGLE_DEG = 2.8647889756541165;
const REFERENCE_DELTA_CM = -0.027925268031909273;

describe("Stage 4 trim-response physics", () => {
  describe("numerical verification case", () => {
    it("matches the supplied reference values within the specified tolerance", () => {
      const result = calculateTrimResponse({
        cm0: 0.04,
        cmAlphaPerRad: -0.8,
        angleOfAttackDeg: 2.86,
        disturbanceAlphaDeg: 2.0,
      });

      expect(
        Math.abs(result.cm - REFERENCE_CM),
      ).toBeLessThanOrEqual(TOLERANCE);

      expect(
        Math.abs(result.trimAngleDeg - REFERENCE_TRIM_ANGLE_DEG),
      ).toBeLessThanOrEqual(TOLERANCE);

      expect(
        Math.abs(result.deltaCm - REFERENCE_DELTA_CM),
      ).toBeLessThanOrEqual(TOLERANCE);

      expect(result.trimmed).toBe(false);
      expect(result.disturbanceTendency).toBe("restoring");
    });
  });

  describe("behavioral verification case", () => {
    it("doubles the disturbance response when the disturbance angle doubles", () => {
      const baseline = calculateTrimResponse({
        cm0: 0.04,
        cmAlphaPerRad: -0.8,
        angleOfAttackDeg: 2.86,
        disturbanceAlphaDeg: 2.0,
      });

      const doubled = calculateTrimResponse({
        cm0: 0.04,
        cmAlphaPerRad: -0.8,
        angleOfAttackDeg: 2.86,
        disturbanceAlphaDeg: 4.0,
      });

      expect(doubled.deltaCm).toBeLessThan(baseline.deltaCm);

      expect(
        Math.abs(
          Math.abs(doubled.deltaCm) -
            2 * Math.abs(baseline.deltaCm),
        ),
      ).toBeLessThanOrEqual(TOLERANCE);

      expect(doubled.disturbanceTendency).toBe("restoring");
    });
  });

  describe("boundary verification case", () => {
    it("handles zero slope without dividing by zero", () => {
      const result = calculateTrimResponse({
        cm0: 0.04,
        cmAlphaPerRad: 0,
        angleOfAttackDeg: 2.86,
        disturbanceAlphaDeg: 2.0,
      });

      expect(result.cm).toBe(0.04);
      expect(result.deltaCm).toBe(0);
      expect(result.trimAngleDeg).toBeNull();
      expect(result.trimmed).toBe(false);
      expect(result.disturbanceTendency).toBe("neutral");
    });
  });

  describe("core physics functions", () => {
    it("converts degrees to radians and radians to degrees", () => {
      expect(degreesToRadians(180)).toBe(Math.PI);
      expect(radiansToDegrees(Math.PI)).toBe(180);
    });

    it("calculates Cm using the linear relationship", () => {
      const alphaRad = degreesToRadians(2.86);
      const cm = calculateCm(0.04, -0.8, alphaRad);

      expect(
        Math.abs(cm - REFERENCE_CM),
      ).toBeLessThanOrEqual(TOLERANCE);
    });

    it("calculates the trim angle when the slope is nonzero", () => {
      const trimRad = calculateTrimAngleRad(0.04, -0.8);

      expect(trimRad).toBeCloseTo(0.05, 10);

      expect(
        Math.abs(
          radiansToDegrees(trimRad) - REFERENCE_TRIM_ANGLE_DEG,
        ),
      ).toBeLessThanOrEqual(TOLERANCE);
    });

    it("returns no trim angle for zero slope", () => {
      expect(calculateTrimAngleRad(0.04, 0)).toBeNull();
    });

    it("calculates disturbance delta Cm", () => {
      const disturbanceRad = degreesToRadians(2.0);
      const deltaCm = calculateDeltaCm(-0.8, disturbanceRad);

      expect(
        Math.abs(deltaCm - REFERENCE_DELTA_CM),
      ).toBeLessThanOrEqual(TOLERANCE);
    });

    it("classifies a negative disturbance product as restoring", () => {
      const disturbanceRad = degreesToRadians(2.0);
      const deltaCm = calculateDeltaCm(-0.8, disturbanceRad);

      expect(classifyDisturbance(disturbanceRad, deltaCm)).toBe(
        "restoring",
      );
    });

    it("classifies a positive disturbance product as destabilizing", () => {
      const disturbanceRad = degreesToRadians(2.0);
      const deltaCm = calculateDeltaCm(0.8, disturbanceRad);

      expect(classifyDisturbance(disturbanceRad, deltaCm)).toBe(
        "destabilizing",
      );
    });

    it("classifies a zero disturbance product as neutral", () => {
      expect(classifyDisturbance(0, 0)).toBe("neutral");
    });

    it("uses the specified trim tolerance", () => {
      expect(isTrimmed(1e-6)).toBe(true);
      expect(isTrimmed(-1e-6)).toBe(true);
      expect(isTrimmed(1.000001e-6)).toBe(false);
    });
  });

  describe("input validation", () => {
    it("rejects non-finite numeric inputs", () => {
      expect(() =>
        calculateCm(0.04, -0.8, Number.NaN),
      ).toThrow();

      expect(() =>
        calculateDeltaCm(-0.8, Number.POSITIVE_INFINITY),
      ).toThrow();

      expect(() =>
        calculateTrimResponse({
          cm0: 0.04,
          cmAlphaPerRad: -0.8,
          angleOfAttackDeg: Number.NaN,
          disturbanceAlphaDeg: 2,
        }),
      ).toThrow();
    });
  });
});