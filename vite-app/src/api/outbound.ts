// src/api/outbound.ts
import { api } from './client';
import type { OutboundInput, OutboundResult } from '../types';

/** One atomic outbound; creates a shipment when the tag is OUTBOUND. */
export async function createOutbound(input: OutboundInput): Promise<OutboundResult> {
  const res = await api.post<OutboundResult>('/api/outbound', input);
  return res.data;
}
