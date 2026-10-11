import type { Tag } from '../data/catalogue';

/**
 * Turns a free-text vibe ("soft life Lekki but cosy") into tag weights the
 * selector can score items against. Pure and offline: keyword rules only.
 */

export type TagWeights = Partial<Record<Tag, number>>;

export interface VibePreset {
  id: string;
  label: string;
  /** Phrases that point at this vibe. Matched on word boundaries, case-insensitive. */
  keywords: string[];
  weights: TagWeights;
  suggestedBudget: number;
}

export interface VibeReading {
  weights: TagWeights;
  /** Presets the text matched, strongest first. */
  presets: VibePreset[];
  /** Tags with the strongest positive pull, for showing the player what was understood. */
  leaning: Tag[];
  suggestedBudget: number | null;
  /** False when nothing in the text matched and neutral weights were used. */
  understood: boolean;
}

export const vibePresets: VibePreset[] = [
  {
    id: 'soft-life-lekki',
    label: 'soft life Lekki',
    keywords: ['soft life', 'lekki', 'ikoyi', 'victoria island', 'banana island', 'luxury', 'luxe', 'bougie', 'enjoyment', 'baller'],
    weights: { luxe: 2.2, comfort: 1.2, tech: 0.6, decor: 0.8, green: 0.5, cooling: 0.4, budget: -1.6, starter: -0.8, traditional: -0.3 },
    suggestedBudget: 800_000,
  },
  {
    id: 'corpers-self-con',
    label: "corper's self-con",
    keywords: ['corper', 'corpers', 'corps', 'nysc', 'self con', 'selfcon', 'ppa', 'allawee', 'khaki'],
    weights: { budget: 2, starter: 1.5, minimal: 0.8, power: 0.8, study: 0.6, cooling: 0.4, luxe: -1.6 },
    suggestedBudget: 90_000,
  },
  {
    id: 'mummys-parlour',
    label: "mummy's parlour",
    keywords: ['mummy', 'mummys', 'mama', 'mum', 'parlour', 'parlor', 'aunty', 'auntie', 'church', 'visitors', 'sitting room'],
    weights: { traditional: 2, family: 1.6, hosting: 1.2, decor: 0.8, comfort: 0.6, food: 0.4, tech: -0.6, minimal: -0.5, budget: -0.4 },
    suggestedBudget: 600_000,
  },
  {
    id: 'yaba-tech-bro',
    label: 'Yaba tech bro',
    keywords: ['yaba', 'tech bro', 'tech', 'developer', 'dev', 'startup', 'coder', 'coding', 'laptop', 'remote', 'wfh', 'work from home', 'engineer'],
    weights: { work: 2, tech: 2, power: 1.4, minimal: 1, cooling: 0.6, study: 0.4, traditional: -0.8, party: -0.4 },
    suggestedBudget: 650_000,
  },
  {
    id: 'boys-quarters-starter',
    label: "boys' quarters starter",
    keywords: ['boys quarters', 'boys quarter', 'bq', 'starter', 'first place', 'just moved', 'hustle', 'hustler', 'face me i face you', 'small room'],
    weights: { budget: 1.8, starter: 2, minimal: 0.6, power: 0.6, luxe: -1.4 },
    suggestedBudget: 60_000,
  },
  {
    id: 'owambe-ready-parlour',
    label: 'owambe-ready parlour',
    keywords: ['owambe', 'aso ebi', 'asoebi', 'celebration', 'guests', 'jollof', 'dj', 'sallah', 'christmas', 'naming ceremony', 'hosting'],
    weights: { party: 2.2, hosting: 1.8, food: 1, traditional: 0.8, decor: 0.6, minimal: -0.6, study: -0.4 },
    suggestedBudget: 450_000,
  },
];

/** Single words and phrases that nudge one tag, on top of any preset. */
const tagKeywords: Record<Tag, string[]> = {
  luxe: ['gold', 'marble', 'velvet', 'rich', 'fancy', 'classy', 'premium', 'posh', 'expensive'],
  budget: ['cheap', 'budget', 'manage', 'broke', 'sapa', 'small money', 'low budget', 'affordable'],
  starter: ['basic', 'basics', 'essentials', 'new', 'first'],
  minimal: ['minimal', 'minimalist', 'clean', 'simple', 'scandi', 'calm', 'quiet', 'neat'],
  comfort: ['cosy', 'cozy', 'comfy', 'comfortable', 'soft', 'relax', 'chill'],
  traditional: ['traditional', 'classic', 'old school', 'yoruba', 'igbo', 'hausa', 'heritage'],
  family: ['family', 'kids', 'children', 'pikin', 'husband', 'wife'],
  hosting: ['host', 'guests', 'visitors', 'friends'],
  party: ['party', 'music', 'dance', 'turn up', 'vibes', 'jams'],
  food: ['food', 'cook', 'cooking', 'eat', 'chop', 'jollof', 'drinks'],
  work: ['work', 'office', 'desk', 'zoom', 'calls', 'freelance'],
  tech: ['gaming', 'gamer', 'stream', 'streamer', 'content', 'creator', 'tiktok', 'youtube', 'gadgets', 'smart'],
  study: ['study', 'read', 'reading', 'books', 'exam', 'exams', 'school', 'student'],
  power: ['nepa', 'phcn', 'light', 'power', 'generator', 'gen', 'solar', 'outage', 'inverter'],
  cooling: ['cool', 'heat', 'hot', 'breeze', 'fan', 'ac', 'air'],
  decor: ['art', 'pretty', 'aesthetic', 'decor', 'colour', 'color', 'design', 'beautiful'],
  green: ['plant', 'plants', 'green', 'garden', 'nature', 'leafy'],
};

function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function countHits(haystack: string, phrases: string[]): number {
  let hits = 0;
  for (const phrase of phrases) {
    const needle = normalise(phrase);
    if (needle.trim() && haystack.includes(needle)) {
      // Longer phrases are more specific, so they count for more.
      hits += needle.trim().split(' ').length;
    }
  }
  return hits;
}

/** Weights used when the text gives us nothing to go on: a tidy, functional room. */
const neutralWeights: TagWeights = { comfort: 0.6, minimal: 0.6, starter: 0.3 };

/** The offline, rule-based scorer. */
export function ruleBasedReading(text: string): VibeReading {
  const haystack = normalise(text);
  const weights: TagWeights = {};
  const add = (tag: Tag, amount: number) => {
    weights[tag] = (weights[tag] ?? 0) + amount;
  };

  const presetHits = vibePresets
    .map((preset) => ({ preset, hits: countHits(haystack, preset.keywords) }))
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const totalPresetHits = presetHits.reduce((sum, entry) => sum + entry.hits, 0);
  for (const { preset, hits } of presetHits) {
    // Blend presets by how strongly each was mentioned.
    const share = hits / totalPresetHits;
    for (const [tag, weight] of Object.entries(preset.weights) as [Tag, number][]) {
      add(tag, weight * share);
    }
  }

  let tagHits = 0;
  for (const [tag, phrases] of Object.entries(tagKeywords) as [Tag, string[]][]) {
    const hits = countHits(haystack, phrases);
    if (hits > 0) {
      tagHits += hits;
      add(tag, Math.min(hits, 2) * 0.9);
    }
  }

  const understood = presetHits.length > 0 || tagHits > 0;
  const finalWeights = understood ? weights : { ...neutralWeights };

  const leaning = (Object.entries(finalWeights) as [Tag, number][])
    .filter(([, weight]) => weight > 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  return {
    weights: finalWeights,
    presets: presetHits.map((entry) => entry.preset),
    leaning,
    suggestedBudget: presetHits[0]?.preset.suggestedBudget ?? null,
    understood,
  };
}

/*
 * ---------------------------------------------------------------------------
 * Scorer seam
 *
 * `readVibe` is the only entry point the app uses. To hand interpretation to a
 * language model, write a function with the `VibeScorer` signature that returns
 * the same `VibeReading` shape (tag weights over the `Tag` vocabulary), and
 * assign it to `activeScorer`. Keep `ruleBasedReading` as the fallback for when
 * the model call fails or the player is offline.
 * ---------------------------------------------------------------------------
 */
export type VibeScorer = (text: string) => VibeReading | Promise<VibeReading>;

const activeScorer: VibeScorer = ruleBasedReading;

export async function readVibe(text: string): Promise<VibeReading> {
  try {
    return await activeScorer(text);
  } catch {
    return ruleBasedReading(text);
  }
}
