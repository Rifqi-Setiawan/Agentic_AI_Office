import rawConversations from '../../content/conversations.id.json';

export interface ConversationTurn {
  readonly agent: string;
  readonly text: string;
}

export interface ConversationPair {
  readonly id: string;
  readonly agents: readonly [string, string];
  readonly topic: string;
  readonly turns: readonly ConversationTurn[];
}

export const conversationPairs: readonly ConversationPair[] =
  rawConversations as unknown as readonly ConversationPair[];

/**
 * Mengambil seluruh daftar pasangan percakapan dua arah (F27).
 */
export function getConversationPairs(): readonly ConversationPair[] {
  return conversationPairs;
}

/**
 * Mencari percakapan dua arah berdasarkan ID unik.
 */
export function getConversationById(id: string): ConversationPair | undefined {
  return conversationPairs.find((c) => c.id === id);
}

/**
 * Mengambil seluruh percakapan yang melibatkan agen tertentu.
 */
export function getConversationsForAgent(agentId: string): readonly ConversationPair[] {
  const normalized = agentId.toLowerCase();
  return conversationPairs.filter(
    (c) => c.agents[0].toLowerCase() === normalized || c.agents[1].toLowerCase() === normalized,
  );
}

/**
 * Mengambil seluruh percakapan yang melibatkan pasangan spesifik dua agen.
 */
export function getConversationsBetween(agentA: string, agentB: string): readonly ConversationPair[] {
  const normA = agentA.toLowerCase();
  const normB = agentB.toLowerCase();

  return conversationPairs.filter((c) => {
    const a0 = c.agents[0].toLowerCase();
    const a1 = c.agents[1].toLowerCase();
    return (a0 === normA && a1 === normB) || (a0 === normB && a1 === normA);
  });
}

/**
 * Mengambil satu percakapan acak, opsional difilter berdasarkan dua agen.
 */
export function getRandomConversation(
  agentA?: string,
  agentB?: string,
  randomFn: () => number = Math.random,
): ConversationPair | null {
  let pool: readonly ConversationPair[];

  if (agentA && agentB) {
    pool = getConversationsBetween(agentA, agentB);
  } else if (agentA) {
    pool = getConversationsForAgent(agentA);
  } else {
    pool = conversationPairs;
  }

  if (pool.length === 0) return null;
  const idx = Math.floor(randomFn() * pool.length);
  return pool[Math.min(idx, pool.length - 1)];
}
