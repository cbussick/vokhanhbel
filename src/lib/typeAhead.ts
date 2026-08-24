const typeAheadResetMilliseconds = 500;

export interface TypeAheadState {
  query: string;
  lastKeyAt: number;
}

/**
 * Accumulates keystrokes into a search query for a listbox.
 *
 * A pause longer than the reset window starts a new query. Repeating a single key cycles through
 * the entries starting with that key instead of narrowing the query, so the query collapses back to
 * the key itself. Splitting on the key rather than on characters keeps that check correct for
 * letters built from more than one code point, such as Vietnamese combining diacritics.
 */
export function nextTypeAheadState(state: TypeAheadState, key: string): TypeAheadState {
  const now = Date.now();
  const accumulatedQuery =
    now - state.lastKeyAt > typeAheadResetMilliseconds ? key : `${state.query}${key}`;
  const query = accumulatedQuery.split(key).every((segment) => segment === "")
    ? key
    : accumulatedQuery;

  return { query, lastKeyAt: now };
}
