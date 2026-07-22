import { CarrierCode } from '@prisma/client';
import type { CarrierAdapter } from './types';

export const storePickupAdapter: CarrierAdapter = {
  code: CarrierCode.STORE_PICKUP,
  name: 'Levantamento na loja',
  method: 'PICKUP',
  quote() {
    return {
      method: 'PICKUP',
      carrierCode: CarrierCode.STORE_PICKUP,
      label: 'Levantamento na loja',
      amountCents: 0,
      etaDaysMin: 0,
      etaDaysMax: 1,
    };
  },
  resolveTrackingCode({ orderNumber }) {
    return `ISH-PICKUP-${orderNumber}`;
  },
};
