import {
  calculateCm,
  calculateDeltaCm,
  calculateTrimAngleRad,
  calculateTrimResponse,
  classifyDisturbance,
  degreesToRadians,
  isTrimmed,
  radiansToDegrees,
} from "../physics/trim-response.js";

const INPUT_KEYS = [
  "cm0",
  "cmAlphaPerRad",
  "angleOfAttackDeg",
  "disturbanceAlphaDeg",
];

const NUMERICAL_TOLERANCE = 1e-6;

function getCapabilities(context) {
  return context?.capabilities ?? context?.capabilityContext?.capabilities ?? {};
}

function hasRequiredCapability(context, id, version) {
  const capabilities = getCapabilities(context);

  if (Array.isArray(capabilities)) {
    return capabilities.some(
      (capability) =>
        capability?.id === id &&
        Number(capability?.version) >= version,
    );
  }

  const capability = capabilities[id];

  if (capability === undefined || capability === null) {
    return false;
  }

  if (typeof capability === "number") {
    return capability >= version;
  }

  return Number(capability.version) >= version;
}

function buildResults(calculation) {
  return [
    {
      key: "cm",
      label: "Pitching-moment coefficient, Cm(alpha)",
      value: calculation.cm,
      unit: "",
      precision: 6,
      emphasis: true,
    },
    {
      key: "trimAngleDeg",
      label: "Trim angle",
      value:
        calculation.trimAngleDeg === null
          ? "not available"
          : calculation.trimAngleDeg,
      unit: calculation.trimAngleDeg === null ? "" : "deg",
      precision: 5,
    },
    {
      key: "deltaCm",
      label: "Disturbance moment-coefficient change, delta_Cm",
      value: calculation.deltaCm,
      unit: "",
      precision: 5,
    },
    {
      key: "trimmed",
      label: "Selected condition trimmed",
      value: calculation.trimmed ? "trimmed" : "not trimmed",
      unit: "",
      precision: 0,
    },
    {
      key: "disturbanceTendency",
      label: "Disturbance tendency",
      value: calculation.disturbanceTendency,
      unit: "",
      precision: 0,
    },
  ];
}

function buildVerificationCases() {
  const numericalInputs = {
    cm0: 0.04,
    cmAlphaPerRad: -0.8,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 2.0,
  };

  const numericalExpected = {
    cm: 0.00007,
    trimAngleDeg: 2.86479,
    deltaCm: -0.02793,
  };

  const numerical = calculateTrimResponse(numericalInputs);

  const behavioralInputs = {
    cm0: 0.04,
    cmAlphaPerRad: -0.8,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 4.0,
  };

  const baselineBehavioral = calculateTrimResponse({
    ...behavioralInputs,
    disturbanceAlphaDeg: 2.0,
  });
  const behavioral = calculateTrimResponse(behavioralInputs);

  const boundaryInputs = {
    cm0: 0.04,
    cmAlphaPerRad: 0,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 2.0,
  };

  const boundary = calculateTrimResponse(boundaryInputs);

  return [
    {
      id: "numerical",
      name: "Numerical reference case",
      inputs: numericalInputs,
      expected: numericalExpected,
      tolerance: NUMERICAL_TOLERANCE,
      passed:
        Math.abs(numerical.cm - numericalExpected.cm) <=
          NUMERICAL_TOLERANCE &&
        Math.abs(
          numerical.trimAngleDeg - numericalExpected.trimAngleDeg,
        ) <= NUMERICAL_TOLERANCE &&
        Math.abs(numerical.deltaCm - numericalExpected.deltaCm) <=
          NUMERICAL_TOLERANCE &&
        numerical.trimmed === false &&
        numerical.disturbanceTendency === "restoring",
    },
    {
      id: "behavioral",
      name: "Doubled disturbance case",
      inputs: behavioralInputs,
      expected: {
        deltaCmMoreNegative: true,
        magnitudeDoubles: true,
        tendency: "restoring",
      },
      passed:
        behavioral.deltaCm < baselineBehavioral.deltaCm &&
        Math.abs(
          Math.abs(behavioral.deltaCm) -
            2 * Math.abs(baselineBehavioral.deltaCm),
        ) <= NUMERICAL_TOLERANCE &&
        behavioral.disturbanceTendency === "restoring",
    },
    {
      id: "boundary-zero-slope",
      name: "Zero-slope boundary case",
      inputs: boundaryInputs,
      expected: {
        cm: 0.04,
        deltaCm: 0,
        trimAngle: "not available",
        tendency: "neutral",
      },
      passed:
        boundary.cm === boundaryInputs.cm0 &&
        boundary.deltaCm === 0 &&
        boundary.trimAngleDeg === null &&
        boundary.trimmed === false &&
        boundary.disturbanceTendency === "neutral",
    },
  ];
}

function buildPlot(cm0, cmAlphaPerRad, selectedAngleDeg) {
  const points = [];

  for (let angleDeg = -10; angleDeg <= 10; angleDeg += 1) {
    points.push({
      x: angleDeg,
      y: calculateCm(
        cm0,
        cmAlphaPerRad,
        degreesToRadians(angleDeg),
      ),
    });
  }

  return {
    id: "cm-alpha",
    title: "Cm–alpha relationship",
    xAxis: {
      label: "Angle of attack",
      unit: "deg",
    },
    yAxis: {
      label: "Pitching-moment coefficient",
      unit: "",
    },
    series: [
      {
        id: "cm-alpha-model",
        label: "Cm(alpha)",
        points,
      },
    ],
    selectedX: selectedAngleDeg,
    regions: [],
    referenceLines: [
      {
        id: "trim-line",
        label: "Cm = 0",
        axis: "y",
        value: 0,
      },
    ],
  };
}

export const feature = {
  contractVersion: 4,
  id: "trim-response",
  title: "Live Cm–alpha relationship and trim",
  description:
    "Assess trim and small-disturbance pitching-moment tendency using the linear Cm–alpha model.",
  category: "Stability · Student feature",
  learningMode: "concept",
  topicId: "stability",
  inputKeys: INPUT_KEYS,
  requiresCapabilities: [
    { id: "loads.pitch.component-sum", version: 1 },
  ],
  providesCapabilities: [
    { id: "stability.pitch.cm-alpha", version: 1 },
  ],
  assumptions: [
    "The Cm–alpha relationship is linear over the investigated range.",
    "The model is quasi-static and represents a small disturbance about the selected condition.",
    "Cm0 and Cm_alpha represent the same aircraft configuration and flight condition.",
    "Positive pitching moment and positive angle of attack are nose-up.",
  ],
  validityLimits: [
    "Do not use the linear relationship at stall, at large angle of attack, or where aerodynamic coefficients are strongly nonlinear.",
    "This model does not calculate a time history, damping, control motion, or handling quality.",
    "A restoring tendency is not proof of acceptable safety, controllability, or flightworthiness.",
    "The calculated trim angle is meaningful only when the linear model remains valid at that angle.",
  ],
  simulation: {
    display: "analysis-only",
    durationS: 1,
    initialState: {},
    controls: {},
    disturbance: {},
  },

  analyze(aircraft, capabilityContext) {
    if (
      !hasRequiredCapability(
        capabilityContext,
        "loads.pitch.component-sum",
        1,
      )
    ) {
      return {
        results: [],
        verificationCases: [],
        decision: {
          question:
            "At the selected angle of attack, is the simplified pitching-moment model trimmed, and does a small angle-of-attack disturbance create a restoring moment tendency?",
          interpretation:
            "The required loads.pitch.component-sum capability is not available, so this Stage 4 analysis is locked.",
          status: "caution",
        },
        plots: [],
        scene: null,
      };
    }

    const calculation = calculateTrimResponse({
      cm0: aircraft.cm0,
      cmAlphaPerRad: aircraft.cmAlphaPerRad,
      angleOfAttackDeg: aircraft.angleOfAttackDeg,
      disturbanceAlphaDeg: aircraft.disturbanceAlphaDeg,
    });

    const interpretation = calculation.trimmed
      ? `The selected condition is trimmed under the linear quasi-static model. The small angle-of-attack disturbance has a ${calculation.disturbanceTendency} tendency under the specified sign convention.`
      : `The selected condition is not trimmed under the linear quasi-static model. The small angle-of-attack disturbance has a ${calculation.disturbanceTendency} tendency under the specified sign convention.`;

    const status =
      calculation.disturbanceTendency === "destabilizing"
        ? "caution"
        : calculation.disturbanceTendency === "neutral"
          ? "neutral"
          : "pass";

    return {
      results: buildResults(calculation),
      verificationCases: buildVerificationCases(),
      decision: {
        question:
          "At the selected angle of attack, is the simplified pitching-moment model trimmed, and does a small angle-of-attack disturbance create a restoring moment tendency?",
        interpretation,
        status,
      },
      plots: [
        buildPlot(
          aircraft.cm0,
          aircraft.cmAlphaPerRad,
          aircraft.angleOfAttackDeg,
        ),
      ],
      scene: null,
    };
  },
};

export const model = {
  kind: "derived",

  evaluate(runtimeContext) {
    const aircraft = runtimeContext?.aircraft ?? {};
    const calculation = calculateTrimResponse({
      cm0: aircraft.cm0,
      cmAlphaPerRad: aircraft.cmAlphaPerRad,
      angleOfAttackDeg: aircraft.angleOfAttackDeg,
      disturbanceAlphaDeg: aircraft.disturbanceAlphaDeg,
    });

    return {
      values: {
        cm: calculation.cm,
        trimAngleDeg: calculation.trimAngleDeg,
        deltaCm: calculation.deltaCm,
        trimmed: calculation.trimmed,
        disturbanceTendency: calculation.disturbanceTendency,
      },
    };
  },
};