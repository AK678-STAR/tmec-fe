const PERSON_PORTRAITS = [3, 5, 7, 8];

export function resolvePersonAvatar(name: string, avatarUrl?: string | null): string {
  if (avatarUrl) return avatarUrl;
  const index = Array.from(name).reduce((sum, character) => sum + character.codePointAt(0)!, 0) % PERSON_PORTRAITS.length;
  return `/images/people/person-${String(PERSON_PORTRAITS[index]).padStart(2, '0')}.jpg`;
}
