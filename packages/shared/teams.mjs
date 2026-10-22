export const MAX_TEAM_MEMBERS = 6;
export function teamName(value) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}
export function teamKey(value) {
  return teamName(value).toLocaleLowerCase('es');
}
