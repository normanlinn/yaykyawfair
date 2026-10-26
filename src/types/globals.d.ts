// Viewer hooks the claude.ai artifact frame may provide (hot reload keeps game state across republishes).
interface ClaudeHot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}
interface Claude { hot?: ClaudeHot }
interface Window { __ykn?: unknown }
