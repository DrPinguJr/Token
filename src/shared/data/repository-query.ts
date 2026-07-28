export function isWithinUtcRange(
  value: string,
  from: string | undefined,
  to: string | undefined,
): boolean {
  const timestamp = Date.parse(value);
  const fromTimestamp = from === undefined ? undefined : Date.parse(from);
  const toTimestamp = to === undefined ? undefined : Date.parse(to);

  return (
    (fromTimestamp === undefined || timestamp >= fromTimestamp) &&
    (toTimestamp === undefined || timestamp <= toTimestamp)
  );
}

export function containsNormalizedSearch(
  search: string,
  values: readonly string[],
): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase("en-SG");

  return values.some((value) =>
    value.toLocaleLowerCase("en-SG").includes(normalizedSearch),
  );
}

export function newestFirst<T>(
  values: readonly T[],
  selectTimestamp: (value: T) => string,
): T[] {
  return [...values].sort(
    (left, right) =>
      Date.parse(selectTimestamp(right)) - Date.parse(selectTimestamp(left)),
  );
}

export function ascendingText<T>(
  values: readonly T[],
  selectText: (value: T) => string,
): T[] {
  return [...values].sort((left, right) =>
    selectText(left).localeCompare(selectText(right), "en-SG"),
  );
}
