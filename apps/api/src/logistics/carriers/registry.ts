import { CarrierCode } from '@prisma/client';
import type { CarrierAdapter } from './types';
import { flatRateAdapter } from './flat-rate.adapter';
import { freeThresholdAdapter } from './free-threshold.adapter';
import { manualAdapter } from './manual.adapter';
import { storePickupAdapter } from './store-pickup.adapter';

const ADAPTERS: CarrierAdapter[] = [
  freeThresholdAdapter,
  flatRateAdapter,
  storePickupAdapter,
  manualAdapter,
];

const BY_CODE = new Map<CarrierCode, CarrierAdapter>(
  ADAPTERS.map((a) => [a.code as CarrierCode, a]),
);

export function listCarrierAdapters(): CarrierAdapter[] {
  return ADAPTERS;
}

export function getCarrierAdapter(code: CarrierCode): CarrierAdapter {
  const adapter = BY_CODE.get(code);
  if (!adapter) {
    throw new Error(`Carrier adapter em falta: ${code}`);
  }
  return adapter;
}
