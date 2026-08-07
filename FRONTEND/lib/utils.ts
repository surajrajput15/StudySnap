export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function dateKey(date: Date | string = new Date()): string {
  const value = date instanceof Date ? date : new Date(date);
  return value.toISOString().split('T')[0];
}

export function formatShortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
