const IMAGE_MARKDOWN = /!\[[^\]]*\]\(([^\s)]+)\)/g;

function safePhotoUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url) ||
      /^https?:\/\/[^\s]+$/i.test(url) || /^\/(?!\/)[^\s]+$/.test(url)) return url;
  return undefined;
}

export function incidentEvidence(incident: { evidencePhotoUrl?: string; description: string }) {
  let photoUrl = safePhotoUrl(incident.evidencePhotoUrl);
  const description = incident.description.replace(IMAGE_MARKDOWN, (match, url: string) => {
    const safe = safePhotoUrl(url);
    if (!safe) return match;
    photoUrl ||= safe;
    return '';
  }).trim();
  return { photoUrl, description };
}

export function withIncidentEvidence(description: string, photoUrl?: string): string {
  return photoUrl ? `${description.trim()}\n\n![Ảnh hiện trường](${photoUrl})` : description.trim();
}
