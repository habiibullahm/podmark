// YouTube's transcript panel copies as one short line per caption cue, with a
// timestamp either on its own line above each cue or inline in front of it.
// Pasted as-is the model sees a column of fragments rather than prose, and the
// timestamps burn tokens without adding meaning — so fold it back into flowing
// text on the way in. This is what lets the paste box accept a raw copy without
// the reader having to strip anything first.
const TIMESTAMP_ONLY_LINE = /^\(?\d{1,2}:\d{2}(?::\d{2})?\)?$/;
const LEADING_TIMESTAMP = /^\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s+/;

export function normalizeTranscript(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !TIMESTAMP_ONLY_LINE.test(line))
    .map((line) => line.replace(LEADING_TIMESTAMP, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
