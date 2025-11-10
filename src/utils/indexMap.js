export function normalizeIndexSymbol(symbol) {
  if (symbol == null) return '';
  return String(symbol).trim().toUpperCase();
}

export function sanitizeIndexMap(map) {
  const next = {};
  Object.entries(map || {}).forEach(([key, value]) => {
    const members = Array.isArray(value) ? value : [];
    const normalizedMembers = Array.from(new Set(members.map((m) => normalizeIndexSymbol(m)).filter(Boolean)));
    next[key] = normalizedMembers;
  });
  return next;
}










