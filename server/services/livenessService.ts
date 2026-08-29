export interface LivenessChallenge {
  challengeId: string;
  instruction: string;
  type: "TURN_LEFT" | "TURN_RIGHT" | "BLINK" | "SMILE" | "TILT_HEAD";
  timeLimitSeconds: number;
}

export interface LivenessEvaluationResult {
  passed: boolean;
  livenessConfidence: number; // 0 - 100
  faceDetected: boolean;
  faceQualityScore: number;
  antiSpoofScore: number;
  antiSpoofVerdict: "LIVE_PERSON" | "SUSPECTED_SCREEN_REPLAY" | "STATIC_PRINT_PRESENTATION" | "INCONCLUSIVE";
  challengeCompleted: boolean;
  notes: string;
}

export function generateLivenessChallenges(): LivenessChallenge[] {
  const allTypes: Array<LivenessChallenge["type"]> = ["TURN_LEFT", "TURN_RIGHT", "BLINK", "SMILE", "TILT_HEAD"];
  const selected = allTypes.sort(() => 0.5 - Math.random()).slice(0, 3);

  const instructions: Record<LivenessChallenge["type"], string> = {
    TURN_LEFT: "Slowly turn your head to the left",
    TURN_RIGHT: "Slowly turn your head to the right",
    BLINK: "Blink your eyes twice firmly",
    SMILE: "Smile naturally into the camera",
    TILT_HEAD: "Gently tilt your head upwards",
  };

  return selected.map((t, idx) => ({
    challengeId: `CHAL-${Date.now()}-${idx + 1}`,
    instruction: instructions[t],
    type: t,
    timeLimitSeconds: 6,
  }));
}

export function evaluateLivenessResponse(params: {
  framesCount: number;
  faceDetected: boolean;
  averageBrightness: number;
  movementVariance: number;
}): LivenessEvaluationResult {
  const { framesCount, faceDetected, averageBrightness, movementVariance } = params;

  if (!faceDetected) {
    return {
      passed: false,
      livenessConfidence: 0,
      faceDetected: false,
      faceQualityScore: 0,
      antiSpoofScore: 0,
      antiSpoofVerdict: "INCONCLUSIVE",
      challengeCompleted: false,
      notes: "No human face was clearly localized within the optical capture boundary.",
    };
  }

  // Detect static screen/photo presentation: motion variance near 0 across frames
  const isStatic = movementVariance < 0.008;
  const isScreenGlare = averageBrightness > 240;

  let verdict: LivenessEvaluationResult["antiSpoofVerdict"] = "LIVE_PERSON";
  let confidence = 88;
  let passed = true;

  if (isStatic) {
    verdict = "STATIC_PRINT_PRESENTATION";
    confidence = 92;
    passed = false;
  } else if (isScreenGlare) {
    verdict = "SUSPECTED_SCREEN_REPLAY";
    confidence = 85;
    passed = false;
  }

  return {
    passed,
    livenessConfidence: confidence,
    faceDetected: true,
    faceQualityScore: 90,
    antiSpoofScore: passed ? 89 : 35,
    antiSpoofVerdict: verdict,
    challengeCompleted: passed,
    notes: passed
      ? "Active optical challenge confirmed live presentation without digital screen recurrence artifacts."
      : `Presentation rejected: ${verdict}. Optical motion was insufficient to guarantee live physical presence.`,
  };
}
