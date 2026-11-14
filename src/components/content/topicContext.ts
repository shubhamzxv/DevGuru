import { createContext } from 'react';

/**
 * The key of the topic being shown ("<track>/<topic id>").
 * Blocks inside a topic (for example <Quiz>) read it to save scores.
 * It is null when a block is rendered outside a topic page.
 */
export const TopicContext = createContext<string | null>(null);
