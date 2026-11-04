/**
 * Platform specs live here, not scattered in code, so they can change when Behance changes.
 * Sources: Behance help center (cover at least 808x632, project images shown at 1400px wide).
 */
export const BEHANCE = {
  /** Width Behance shows project images at in project view. */
  moduleWidth: 1400,
  /** Cover: minimum upload size. Rendered at 2x for retina. */
  cover: { width: 808, height: 632, scale: 2 },
  /** Quality rule, not a hard Behance limit: keep each image light enough for mobile. */
  maxModuleBytes: 5 * 1024 * 1024,
  /** Sections taller than this get split by the art director, not stretched. */
  maxModuleHeight: 6000,
  minModuleHeight: 200,
  /** Smallest readable text at 1400px wide, since Behance scales modules down on phones. */
  minFontPx: 18,
} as const;

/** WCAG AA contrast for body text. */
export const MIN_CONTRAST = 4.5;
