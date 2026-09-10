/**
 * 將複製的報價放到最前面，同時在筆數上限內保留被複製的原紀錄。
 */
export function prependHistoryCopy<T>(
  history: readonly T[],
  copy: T,
  sourceIndex: number,
  maxItems: number
): T[] {
  if (maxItems <= 0) return [];

  const next = [copy, ...history];
  const sourcePosition =
    sourceIndex >= 0 && sourceIndex < history.length ? sourceIndex + 1 : null;

  while (next.length > maxItems) {
    let removeIndex = next.length - 1;
    if (removeIndex === sourcePosition) removeIndex -= 1;
    if (removeIndex <= 0) return next.slice(0, maxItems);
    next.splice(removeIndex, 1);
  }

  return next;
}
