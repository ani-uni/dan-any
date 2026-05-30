export function* array2chunk<T>(data: readonly T[], size?: number) {
  const MAX_PARAMETERS = Math.pow(2, 16) - 2;
  const parametersPerRecord = data[0] ? Object.keys(data[0]).length : 1;
  const maxSize = Math.floor(MAX_PARAMETERS / parametersPerRecord);

  if (!size || size > maxSize) size = maxSize;

  for (let i = 0; i < data.length; i += size) {
    yield data.slice(i, i + size);
  }
}
