export const URGENCY_CONFIG = {
  critical: { emoji: '🔴', label: 'Critical', window: '5 min', multiplier: '5×', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  urgent:   { emoji: '🟠', label: 'Urgent',   window: '15 min', multiplier: '2.5×', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  standard: { emoji: '🟡', label: 'Standard', window: '45 min', multiplier: '1×', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  deep:     { emoji: '🔵', label: 'Deep',     window: '90 min', multiplier: '1.5×', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
} as const;

export type Urgency = keyof typeof URGENCY_CONFIG;

export interface Problem {
  id: string;
  errorType: string;
  errorMessage: string;
  urgency: Urgency;
  bountyAmount: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  stack?: string[];
}
