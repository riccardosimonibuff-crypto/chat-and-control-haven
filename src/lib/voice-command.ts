export function extractWakeCommand(transcript: string): string | null {
  const match = /(?:^|[^\p{L}\p{N}_])(?:ehi\s+)?vega\b[\s,.:;!?-]*(.*)$/iu.exec(transcript);
  return match?.[1]?.trim() || null;
}

export function localRecognitionReady(status: string): boolean {
  return status === "available";
}