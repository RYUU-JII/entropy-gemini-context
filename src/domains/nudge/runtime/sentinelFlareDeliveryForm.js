export const SENTINEL_FLARE_DELIVERY_FORMS = Object.freeze({ FULL: 'full', BRIEF: 'brief' });

export function requireSentinelFlareDeliveryForm(value) {
  if (value !== SENTINEL_FLARE_DELIVERY_FORMS.FULL && value !== SENTINEL_FLARE_DELIVERY_FORMS.BRIEF) {
    throw new Error(`sentinel_flare_delivery_form_invalid:${String(value)}`);
  }
  return value;
}

// Omission is accepted only at the config/QA input boundary. Durable receipts
// and automatic message construction use the strict validator above.
export function normalizeSentinelFlareDeliveryForm(value = SENTINEL_FLARE_DELIVERY_FORMS.FULL) {
  return requireSentinelFlareDeliveryForm(value);
}
