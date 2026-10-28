/**
 * Recursively removes all keys with `undefined` values from an object or array.
 * Firestore SDK throws an error if any field value is `undefined`.
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as unknown as T;
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      result[key] = typeof val === 'object' && val !== null ? cleanUndefined(val) : val;
    }
  }
  return result;
}
