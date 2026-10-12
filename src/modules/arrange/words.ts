import type { RoomType } from '../../adapter/types';

/**
 * What your Ace worker says, and the labels around it. Short, plain and warm.
 */

export const roomTypeLabel: Record<RoomType, string> = {
  parlour: 'Parlour',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  bath: 'Bathroom',
  study: 'Study',
  yard: 'Yard',
  unassigned: 'No purpose yet',
};

/** What to call a room in a sentence: "your parlour". */
export function roomNoun(type: RoomType, label: string): string {
  if (type === 'unassigned') return 'room';
  if (type === 'bath') return 'bathroom';
  if (type === 'yard') return label.toLowerCase().includes('compound') ? 'compound' : 'yard';
  return type;
}

/** "self-contain" → "Self-contain". */
export function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function greeting(name: string, now = new Date()): string {
  const hour = now.getHours();
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name.split(' ')[0]}.`;
}

export const lines = {
  home: (name: string) => `${greeting(name)} I'm here. Which home are we fixing?`,
  rooms: 'Which room are we fixing?',
  purpose: "This room doesn't have a job yet. What will you use it for?",
  brief: (noun: string) => `Tell me how you want your ${noun} to feel, and what you want to spend.`,
  measuring: 'Give me a moment, let me measure.',
  plan: (noun: string) => `Here's my plan for your ${noun}. Tap anything to find it on the receipt.`,
  working: "Leave it with me. I'm on it.",
  steps: 'Here is how to set it up. Tick each step as you go.',
  ready: (noun: string) => `Your ${noun} is ready.`,
};
