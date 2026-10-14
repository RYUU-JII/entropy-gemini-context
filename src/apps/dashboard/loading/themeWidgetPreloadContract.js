function createThemeWidgetPreloadContractError(code, details) {
  const error = new Error(`${code}:${details.themeId}:${details.widgetType}`);
  error.name = 'DashboardThemeWidgetPreloadError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

export function assertThemeWidgetPreloadAck({
  ack,
  chunkState,
  themeId,
  widgetType,
} = {}) {
  const details = {
    themeId: typeof themeId === 'string' ? themeId : '',
    widgetType: typeof widgetType === 'string' ? widgetType : '',
  };
  if (
    ack?.loaded !== true
    || typeof ack?.key !== 'string'
    || !ack.key.trim()
  ) {
    throw createThemeWidgetPreloadContractError(
      'DASHBOARD_THEME_WIDGET_PRELOAD_ACK_INVALID',
      details,
    );
  }
  if (
    chunkState?.status !== 'ready'
    || typeof chunkState?.key !== 'string'
    || chunkState.key !== ack.key
  ) {
    throw createThemeWidgetPreloadContractError(
      'DASHBOARD_THEME_WIDGET_PRELOAD_STATE_NOT_READY',
      {
        ...details,
        ackKey: ack.key,
        chunkKey: typeof chunkState?.key === 'string' ? chunkState.key : '',
        chunkStatus: typeof chunkState?.status === 'string' ? chunkState.status : '',
      },
    );
  }
  return Object.freeze({
    loaded: true,
    key: ack.key,
  });
}

