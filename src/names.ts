export const shortName = (name: string) =>
  name
    .replace(/\s*\(.*\)$/, '')
    .split(': ')[0]!
    .trim();
