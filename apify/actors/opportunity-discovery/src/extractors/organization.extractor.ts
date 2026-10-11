export function extractOrganization(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const trailingSegment = normalized
    .split(/\s*[:|–—]\s*/)
    .at(-1)
    ?.trim();

  if (
    trailingSegment &&
    trailingSegment.length <= 120 &&
    /\b(?:Ltd|Limited|LLC|Plc|Foundation|Agency|Authority|Ministry|Commission|University|Bank|Institute|Council|Association|Organization|Organisation|Trust|Government)\b/i.test(
      trailingSegment,
    )
  ) {
    return trailingSegment;
  }

  if (
    trailingSegment &&
    /^(?:ALX(?: Africa)?|AfDB|Chevening|Google)$/i.test(trailingSegment)
  ) {
    return trailingSegment;
  }

  const match = normalized.match(/([A-Z][A-Za-z&.\-]+(?:\s+[A-Z][A-Za-z&.\-]+){0,6})\s+(?:Ltd|Limited|LLC|Plc|Foundation|Agency|Authority|Ministry|Commission|University|Bank|Institute|Council|Association|Organization|Organisation|Trust|Government)/);
  return match ? match[0].trim() : null;
}