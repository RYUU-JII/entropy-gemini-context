import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getInteractionMotionStyle } from '@/themes/core/motion/index.js';
import { STORAGE_SUPPORT_TASKS } from '@/platform/storage/support/storageSupportTaskContract.js';

const ARTIFACT_STABLE_INTERACTION_STYLE = getInteractionMotionStyle('stable');

function resolveToneClasses(tone) {
  if (tone === 'success') return 'border-success/25 bg-surface text-success';
  if (tone === 'error') return 'border-danger/25 bg-surface text-danger';
  if (tone === 'warning') return 'border-warning/25 bg-surface text-warning';
  return 'border-border/35 bg-surface-elevated/35 text-on-surface-muted';
}
function formatTimestamp(value) {
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return '--';
  try {
    return new Date(ts).toLocaleString();
  } catch (_) {
    return '--';
  }
}
function formatApproxBytes(t, item) {
  const bytes = typeof item?.approxBytes === 'number' ? item.approxBytes : NaN;
  if (Number.isFinite(bytes) && bytes >= 0) {
    return String(Math.floor(bytes));
  }
  if (typeof item?.approxBytesError === 'string' && item.approxBytesError.trim()) {
    return t('support.size_unavailable', {});
  }
  return t('support.unknown', {});
}
function SupportList({
  items = [],
  renderItem
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className="rounded-[8px] border border-dashed border-border/35 bg-surface-elevated/35 px-4 py-3 text-xs font-semibold text-on-surface-muted/60">
        --
      </div>;
  }
  return <div className="space-y-2">
      {items.map((item, index) => <div key={`${item?.storageKey || item?.storeName || item?.label || index}`} className="rounded-[8px] border border-border/30 bg-surface px-4 py-3">
          {renderItem(item)}
        </div>)}
    </div>;
}
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function requirePanelArray(value, errorCode) {
  if (!Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value;
}
function requirePanelObject(value, errorCode) {
  if (!isPlainObject(value)) {
    throw new Error(errorCode);
  }
  return value;
}
function resolvePanelSnapshot(snapshot) {
  if (snapshot == null) return null;
  const resolvedSnapshot = requirePanelObject(snapshot, '[StorageSupportPanel] Invalid snapshot.');
  const local = requirePanelObject(resolvedSnapshot.local, '[StorageSupportPanel] Invalid local snapshot.');
  requirePanelArray(local.documents, '[StorageSupportPanel] Invalid local documents snapshot.');
  requirePanelArray(local.keyEntries, '[StorageSupportPanel] Invalid local key snapshot.');
  requirePanelObject(local.security, '[StorageSupportPanel] Invalid local security snapshot.');
  const session = requirePanelObject(resolvedSnapshot.session, '[StorageSupportPanel] Invalid session snapshot.');
  requirePanelArray(session.entries, '[StorageSupportPanel] Invalid session entries snapshot.');
  const indexedDb = requirePanelObject(resolvedSnapshot.indexedDb, '[StorageSupportPanel] Invalid IndexedDB snapshot.');
  requirePanelArray(indexedDb.stores, '[StorageSupportPanel] Invalid IndexedDB stores snapshot.');
  requirePanelObject(resolvedSnapshot.runtime, '[StorageSupportPanel] Invalid runtime snapshot.');
  return resolvedSnapshot;
}
function formatSnapshotCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? String(Math.floor(count)) : '--';
}
function requireStorageSupportPanelHandler(handler, propName) {
  if (typeof handler !== 'function') {
    throw new Error(`[StorageSupportPanel] Missing required handler "${propName}".`);
  }
  return handler;
}
export default function StorageSupportPanel({
  visible = false,
  snapshot = null,
  inspectorBusy = false,
  actionBusy = false,
  status = {
    text: '',
    tone: 'muted'
  },
  requirePasscode = false,
  passcodeInput = '',
  onPasscodeInputChange = null,
  onRefresh = null,
  onRunTask = null,
  onClose = null
}) {
  const {
    t
  } = useAppTranslation('tools');
  if (!visible) return null;
  const refreshHandler = requireStorageSupportPanelHandler(onRefresh, 'onRefresh');
  const runTaskHandler = requireStorageSupportPanelHandler(onRunTask, 'onRunTask');
  const closeHandler = requireStorageSupportPanelHandler(onClose, 'onClose');
  const passcodeInputChangeHandler = requirePasscode
    ? requireStorageSupportPanelHandler(onPasscodeInputChange, 'onPasscodeInputChange')
    : onPasscodeInputChange;
  const busy = inspectorBusy || actionBusy;
  const resolvedSnapshot = resolvePanelSnapshot(snapshot);
  const localDocuments = resolvedSnapshot?.local.documents || [];
  const localKeys = resolvedSnapshot?.local.keyEntries || [];
  const sessionEntries = resolvedSnapshot?.session.entries || [];
  const indexedDbStores = resolvedSnapshot?.indexedDb.stores || [];
  const actionButtons = [{
    task: STORAGE_SUPPORT_TASKS.ENSURE_DOMAIN_HASH_ARTIFACTS,
    label: t('support.actions.repair_hashes', {})
  }, {
    task: STORAGE_SUPPORT_TASKS.RUN_STATS_RETENTION,
    label: t('support.actions.run_retention', {})
  }, {
    task: STORAGE_SUPPORT_TASKS.CLEAR_RUNTIME_SESSION,
    label: t('support.actions.clear_runtime', {})
  }, {
    task: STORAGE_SUPPORT_TASKS.CLEAR_FAVICON_CACHE,
    label: t('support.actions.clear_favicons', {})
  }];
  return <section className="shrink-0 rounded-[10px] border border-border/35 bg-surface px-6 py-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]" style={ARTIFACT_STABLE_INTERACTION_STYLE}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-muted/55">
            {t('support.eyebrow', {})}
          </div>
          <h2 className="mt-2 text-lg font-black uppercase tracking-tight text-on-surface">
            {t('support.title', {})}
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-on-surface-muted">
            {t('support.desc', {})}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => refreshHandler()} disabled={busy} className="inline-flex items-center rounded-[8px] border border-accent/20 bg-surface px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-accent transition-colors hover:border-accent/35 hover:bg-surface-elevated disabled:opacity-50">
            {inspectorBusy ? t('support.refreshing', {}) : t('support.refresh', {})}
          </button>
          <button type="button" onClick={() => closeHandler()} className="inline-flex items-center rounded-[8px] border border-border/35 bg-surface px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted/75 transition-colors hover:border-accent/25 hover:bg-surface-elevated">
            {t('support.hide', {})}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-on-surface-muted/72">
        <span>{t('support.generated_at', {})} {formatTimestamp(resolvedSnapshot?.generatedAt)}</span>
        <span>{t('support.buffered_logs', {})} {formatSnapshotCount(resolvedSnapshot?.indexedDb?.bufferedLogCount)}</span>
        <span>{t('support.stats_cache', {})} {formatSnapshotCount(resolvedSnapshot?.runtime?.statsCachedDates)}</span>
      </div>

      {status?.text ? <div className={`mt-4 rounded-[8px] border px-4 py-3 text-sm font-semibold ${resolveToneClasses(status.tone)}`}>
          {status.text}
        </div> : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[8px] border border-border/30 bg-surface-elevated/35 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">
              {t('support.local_documents', {})}
            </div>
            <div className="mt-3">
              <SupportList items={localDocuments} renderItem={item => <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-black text-on-surface">{item.storageKey}</div>
                      <div className="mt-1 text-[11px] font-semibold text-on-surface-muted/65">
                        {t('support.fields', {})}: {item.fieldCount} · {t('support.bytes', {})}: {formatApproxBytes(t, item)}
                      </div>
                    </div>
                    <div className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${item.present ? 'border-accent/20 bg-surface text-accent' : 'border-border/30 bg-surface-elevated/35 text-on-surface-muted/65'}`}>
                      {item.present ? t('support.present', {}) : t('support.empty', {})}
                    </div>
                  </div>} />
            </div>
          </div>

          <div className="rounded-[8px] border border-border/30 bg-surface-elevated/35 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">
              {t('support.session', {})}
            </div>
            <div className="mt-3">
              <SupportList items={sessionEntries} renderItem={item => <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-black text-on-surface">{item.storageKey}</div>
                      <div className="mt-1 text-[11px] font-semibold text-on-surface-muted/65">
                        {item.summary} · {t('support.bytes', {})}: {formatApproxBytes(t, item)}
                      </div>
                    </div>
                    <div className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${item.present ? 'border-accent/20 bg-surface text-accent' : 'border-border/30 bg-surface-elevated/35 text-on-surface-muted/65'}`}>
                      {item.present ? t('support.present', {}) : t('support.empty', {})}
                    </div>
                  </div>} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[8px] border border-border/30 bg-surface-elevated/35 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">
              {t('support.indexed_db', {})}
            </div>
            <div className="mt-3">
              <SupportList items={indexedDbStores} renderItem={item => <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="font-black text-on-surface">{item.storeName}</div>
                    <div className="text-[11px] font-semibold text-on-surface-muted/70">
                      {t('support.rows', {})}: {item.count}
                    </div>
                  </div>} />
            </div>
          </div>

          <div className="rounded-[8px] border border-border/30 bg-surface-elevated/35 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">
              {t('support.security', {})}
            </div>
            <div className="mt-3 space-y-2">
              <SupportList items={localKeys} renderItem={item => <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="font-black text-on-surface">{item.storageKey}</div>
                    <div className="text-[11px] font-semibold text-on-surface-muted/65">
                      {item.present ? t('support.present', {}) : t('support.missing', {})} · {t('support.bytes', {})}: {formatApproxBytes(t, item)}
                    </div>
                  </div>} />
              <div className="rounded-[8px] border border-border/30 bg-surface px-4 py-3 text-sm">
                <div className="font-black text-on-surface">{t('support.reset_guard', {})}</div>
                <div className="mt-1 text-[11px] font-semibold text-on-surface-muted/65">
                  {resolvedSnapshot?.local.security.resetGuardEnabled ? t('support.guard_on', {}) : t('support.guard_off', {})} · {resolvedSnapshot?.local.security.passcodeConfigured ? t('support.passcode_set', {}) : t('support.passcode_missing', {})}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-border/30 bg-surface-elevated/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">
                {t('support.actions_title', {})}
              </div>
              <div className="text-[11px] font-semibold text-on-surface-muted/65">
                {t('support.shortcut_hint', {})}
              </div>
            </div>
            {requirePasscode ? <label className="mt-3 block">
                <div className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-muted/55">
                  {t('support.passcode_label', {})}
                </div>
                <input type="password" value={passcodeInput} onChange={event => passcodeInputChangeHandler(event.target.value)} placeholder={t('support.passcode_placeholder', {})} className="mt-2 w-full rounded-[8px] border border-border/35 bg-surface px-3 py-2 text-sm text-on-surface outline-hidden transition-colors focus:border-accent/35" />
              </label> : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {actionButtons.map(action => <button key={action.task} type="button" onClick={() => runTaskHandler(action.task)} disabled={busy} className="rounded-[8px] border border-accent/20 bg-surface px-4 py-3 text-left text-sm font-black uppercase tracking-[0.08em] text-accent transition-colors hover:border-accent/35 hover:bg-surface-elevated disabled:opacity-50">
                  {action.label}
                </button>)}
            </div>
          </div>
        </div>
      </div>
    </section>;
}
