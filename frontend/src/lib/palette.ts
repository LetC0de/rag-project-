// Each document gets a vibrant color identity, picked deterministically
// from its id so a document always wears the same hue.

export interface DocColor {
  main: string;   // vibrant body color
  soft: string;   // pale wash background
  ink: string;    // readable dark tone derived from main
}

const PALETTE: DocColor[] = [
  { main: '#ff6b3d', soft: '#ffe0d3', ink: '#b23a14' }, // tangerine
  { main: '#2fae6b', soft: '#d6f0e0', ink: '#16713f' }, // kiwi
  { main: '#4aa3e8', soft: '#d9edfd', ink: '#1f6da8' }, // sky
  { main: '#e34f8f', soft: '#fbd8e6', ink: '#a62c61' }, // berry
  { main: '#f4a62a', soft: '#fdeccb', ink: '#a86808' }, // marigold
  { main: '#9a6cf0', soft: '#e9dffb', ink: '#6a3fb8' }, // grape
  { main: '#12a5b0', soft: '#d2f0f2', ink: '#0b6e76' }, // lagoon
  { main: '#e85656', soft: '#fadada', ink: '#a82a2a' }, // poppy
];

export function docColor(id: number): DocColor {
  return PALETTE[((id % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

export function initialsFromFilename(filename: string): string {
  const base = filename.replace(/\.\w+$/, '').replace(/[_\-]+/g, ' ').trim();
  const parts = base.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'PDF';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Queued',
  processing: 'Indexing',
  processed: 'Ready',
  failed: 'Failed',
};
