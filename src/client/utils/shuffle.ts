/**
 * Locally randomizes multiple-choice / multi-select options using Fisher-Yates,
 * while preserving canonical order for simple True/False or Yes/No pairs and
 * keeping "All/None of the above" pinned at the end when present.
 */
export function shuffleOptions(options: string[]): string[] {
  if (options.length <= 1) return [...options];

  // Preserve canonical order for simple boolean pairs
  if (options.length === 2) {
    const normalized = options.map((o) => o.trim().toLowerCase());
    const isTrueFalse =
      (normalized[0] === 'true' && normalized[1] === 'false') ||
      (normalized[0] === 'false' && normalized[1] === 'true');
    const isYesNo =
      (normalized[0] === 'yes' && normalized[1] === 'no') ||
      (normalized[0] === 'no' && normalized[1] === 'yes');
    if (isTrueFalse || isYesNo) {
      return [...options];
    }
  }

  const pinnedEnd: string[] = [];
  const toShuffle: string[] = [];

  for (const opt of options) {
    const lower = opt.trim().toLowerCase();
    if (/^(all|none) of the above\b/.test(lower)) {
      pinnedEnd.push(opt);
    } else {
      toShuffle.push(opt);
    }
  }

  // Fisher-Yates shuffle
  for (let i = toShuffle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
  }

  return [...toShuffle, ...pinnedEnd];
}
