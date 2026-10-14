export function createBrowserEventFailureFields(label, error) {
  return {
    listener: label,
    ...(typeof error?.reason === 'string' && error.reason.trim()
      ? { reason: error.reason.trim() }
      : {}),
    ...(typeof error?.phase === 'string' && error.phase.trim()
      ? { phase: error.phase.trim() }
      : {}),
    ...(Number.isSafeInteger(error?.tabId) && error.tabId >= 0
      ? { tabId: error.tabId }
      : {}),
    ...(Number.isSafeInteger(error?.invalidationTag) && error.invalidationTag > 0
      ? { invalidationTag: error.invalidationTag }
      : {}),
    ...(['loading', 'complete'].includes(error?.tabUpdateStatus)
      ? { tabUpdateStatus: error.tabUpdateStatus } : {}),
    ...(typeof error?.settlementReason === 'string'
      && /^[a-z_]{1,96}$/.test(error.settlementReason)
      ? { settlementReason: error.settlementReason } : {}),
    ...(['before_receipt', 'after_receipt'].includes(error?.historyIngressOrder)
      ? { historyIngressOrder: error.historyIngressOrder } : {}),
  };
}

export default createBrowserEventFailureFields;
