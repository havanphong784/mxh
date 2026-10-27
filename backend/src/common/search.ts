export function toContainsPattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, '\\$&')}%`;
}
