const URL_PATTERN = /\bhttps?:\/\/[^\s)]+/gi;

export function describeProtectionArtifactWorkflowError(error, fallbackCode) {
  const rawMessage = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : String(error || '').trim();
  const message = rawMessage || fallbackCode;
  return message.replace(URL_PATTERN, '[redacted-url]');
}
