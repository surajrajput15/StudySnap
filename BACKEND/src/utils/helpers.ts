import { REVISION_INTERVAL_DAYS } from '../config/constants';

export function computeNextRevision(rating: keyof typeof REVISION_INTERVAL_DAYS): Date {
  const now = new Date();
  now.setDate(now.getDate() + REVISION_INTERVAL_DAYS[rating]);
  return now;
}

export function generateId(): string {
  return crypto.randomUUID();
}