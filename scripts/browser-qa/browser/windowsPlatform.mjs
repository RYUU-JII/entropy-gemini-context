import path from 'node:path';

export function isWindowsQaPlatform(platform) {
  return platform === 'windows' || platform === 'windows_via_wsl';
}

export function inferBrowserQaPlatform(executable) {
  if (typeof executable !== 'string' || !executable) {
    throw new Error('BROWSER_QA_EXECUTABLE_REQUIRED');
  }
  if (/^\/mnt\/[a-z]\/.+\.exe$/iu.test(executable)) return 'windows_via_wsl';
  if (path.win32.isAbsolute(executable) && /\.exe$/iu.test(executable)) return 'windows';
  if (path.posix.isAbsolute(executable) && !/\.exe$/iu.test(executable)) return 'linux';
  throw new Error('BROWSER_QA_EXECUTABLE_PLATFORM_UNRESOLVED');
}

export function resolveWindowsPowerShellPath({
  platform = process.platform,
  systemRoot = process.env.SystemRoot,
  wslDriveMount = '/mnt/c',
} = {}) {
  if (platform === 'win32') {
    if (typeof systemRoot !== 'string' || !/^[a-z]:[\\/]/iu.test(systemRoot)) {
      throw new Error('BROWSER_QA_WINDOWS_SYSTEM_ROOT_REQUIRED');
    }
    return path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  }
  if (platform !== 'linux' || !/^\/mnt\/[a-z]$/iu.test(wslDriveMount)) {
    throw new Error('BROWSER_QA_WINDOWS_EXECUTION_HOST_INVALID');
  }
  return path.posix.join(wslDriveMount, 'Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}
