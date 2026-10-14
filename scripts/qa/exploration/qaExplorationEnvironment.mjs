import path from 'node:path';
import { DEFAULT_QA_LOCAL_CONFIG_RELATIVE_PATH, loadQaConfigForRoot } from '../runtime/QaRunCompiler.mjs';
import { resolveQaBrowserEnvironment } from '../environment/qaLocalConfig.mjs';

export async function readQaExplorationEnvironment({ rootDir }) {
  const config = await loadQaConfigForRoot({ rootDir,
    configPath: path.join(rootDir, DEFAULT_QA_LOCAL_CONFIG_RELATIVE_PATH), requireExisting: true });
  const environment = resolveQaBrowserEnvironment('authenticated', config, { required: true });
  if (environment.browserClass !== 'managed_persistent' || environment.processOwnership !== 'attach_only'
    || environment.lifecyclePolicy !== 'managed'
    || environment.profileSlot?.installation?.distribution !== 'chrome_for_testing') {
    throw new Error('QA_EXPLORATION_DECLARED_CFT_PROFILE_REQUIRED');
  }
  return environment;
}
