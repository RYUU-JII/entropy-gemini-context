param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('inspect_process', 'inspect_foreground', 'minimize_window', 'focus_window', 'inspect', 'inspect_options', 'pin')]
  [string]$Operation,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int]$RemoteDebuggingPort,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ExpectedNameBase64,

  [Parameter(Mandatory = $false)]
  [ValidateRange(0, 2147483647)]
  [int]$ExpectedProcessId = 0,

  [Parameter(Mandatory = $false)]
  [AllowEmptyString()]
  [string]$ExpectedWindowBoundsBase64 = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class EntropyQaNativeWindow {
  [StructLayout(LayoutKind.Sequential)]
  private struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct WINDOWPLACEMENT {
    public int Length;
    public int Flags;
    public int ShowCmd;
    public POINT MinPosition;
    public POINT MaxPosition;
    public RECT NormalPosition;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct MONITORINFO {
    public int Size;
    public RECT Monitor;
    public RECT Work;
    public int Flags;
  }

  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  private delegate bool EnumMonitorsProc(IntPtr monitor, IntPtr hdc, ref RECT rect, IntPtr data);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, EnumMonitorsProc callback, IntPtr data);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool SetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT placement);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  private static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  private static extern bool IsZoomed(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT placement);

  [DllImport("user32.dll")]
  private static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);

  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);

  [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
  private static extern int GetWindowLong(IntPtr hWnd, int index);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool BringWindowToTop(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll")]
  public static extern void mouse_event(
    uint dwFlags,
    uint dx,
    uint dy,
    uint dwData,
    UIntPtr dwExtraInfo
  );

  [DllImport("user32.dll")]
  private static extern void keybd_event(
    byte bVk,
    byte bScan,
    uint dwFlags,
    UIntPtr dwExtraInfo
  );

  [DllImport("kernel32.dll")]
  private static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(
    IntPtr hWnd,
    out uint processId
  );

  [DllImport("user32.dll")]
  private static extern bool AttachThreadInput(
    uint idAttach,
    uint idAttachTo,
    bool attach
  );

  public static bool ForceForeground(IntPtr hWnd) {
    IntPtr foreground = GetForegroundWindow();
    uint ignored;
    uint currentThread = GetCurrentThreadId();
    uint foregroundThread = GetWindowThreadProcessId(foreground, out ignored);
    uint targetThread = GetWindowThreadProcessId(hWnd, out ignored);
    bool foregroundAttached = false;
    bool targetAttached = false;
    try {
      keybd_event(0x12, 0, 0, UIntPtr.Zero);
      keybd_event(0x12, 0, 0x0002, UIntPtr.Zero);
      if (foregroundThread != 0 && foregroundThread != currentThread) {
        foregroundAttached = AttachThreadInput(currentThread, foregroundThread, true);
      }
      if (
        targetThread != 0 &&
        targetThread != currentThread &&
        targetThread != foregroundThread
      ) {
        targetAttached = AttachThreadInput(currentThread, targetThread, true);
      }
      // SW_RESTORE also unmaximizes/repositions an already displayed window.
      // Leave normal, maximized and fullscreen placement untouched.
      if (IsIconic(hWnd)) ShowWindowAsync(hWnd, 9);
      BringWindowToTop(hWnd);
      SetForegroundWindow(hWnd);
      return GetForegroundWindow() == hWnd;
    } finally {
      if (targetAttached) {
        AttachThreadInput(currentThread, targetThread, false);
      }
      if (foregroundAttached) {
        AttachThreadInput(currentThread, foregroundThread, false);
      }
    }
  }

  public static IntPtr[] GetVisibleTopLevelWindowsForProcess(uint processId) {
    List<IntPtr> handles = new List<IntPtr>();
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      uint windowProcessId;
      GetWindowThreadProcessId(hWnd, out windowProcessId);
      if (windowProcessId == processId && IsWindowVisible(hWnd)) {
        handles.Add(hWnd);
      }
      return true;
    }, IntPtr.Zero);
    return handles.ToArray();
  }

  public static int[] ResolveWindowBoundsForCorrelation(
    bool minimized, int[] currentBounds, int[] restoredBounds,
    int workspaceOffsetX, int workspaceOffsetY
  ) {
    int[] bounds = minimized ? restoredBounds : currentBounds;
    if (bounds == null || bounds.Length != 4 || bounds[2] <= 0 || bounds[3] <= 0) {
      throw new InvalidOperationException("QA_WINDOWS_CHROME_WINDOW_BOUNDS_INVALID");
    }
    return new int[] {
      bounds[0] + (minimized ? workspaceOffsetX : 0),
      bounds[1] + (minimized ? workspaceOffsetY : 0),
      bounds[2], bounds[3]
    };
  }

  public static int[] GetTopLevelWindowBounds(IntPtr hWnd) {
    // CDP reports restored bounds for minimized windows, while GetWindowRect
    // reports the parked icon rectangle. Read placement without restoring or
    // focusing any candidate, and convert its workspace origin to the screen.
    if (IsIconic(hWnd)) {
      WINDOWPLACEMENT placement = new WINDOWPLACEMENT();
      placement.Length = Marshal.SizeOf(typeof(WINDOWPLACEMENT));
      if (!GetWindowPlacement(hWnd, ref placement)) {
        throw new InvalidOperationException("QA_WINDOWS_CHROME_WINDOW_PLACEMENT_UNAVAILABLE");
      }
      int offsetX = 0;
      int offsetY = 0;
      const int WS_EX_TOOLWINDOW = 0x00000080;
      if ((GetWindowLong(hWnd, -20) & WS_EX_TOOLWINDOW) == 0) {
        IntPtr monitor = MonitorFromWindow(hWnd, 2);
        MONITORINFO info = new MONITORINFO();
        info.Size = Marshal.SizeOf(typeof(MONITORINFO));
        if (monitor == IntPtr.Zero || !GetMonitorInfo(monitor, ref info)) {
          throw new InvalidOperationException("QA_WINDOWS_CHROME_WINDOW_MONITOR_UNAVAILABLE");
        }
        offsetX = info.Work.Left - info.Monitor.Left;
        offsetY = info.Work.Top - info.Monitor.Top;
      }
      RECT restored = placement.NormalPosition;
      return ResolveWindowBoundsForCorrelation(true, null, new int[] {
        restored.Left, restored.Top, restored.Right - restored.Left, restored.Bottom - restored.Top
      }, offsetX, offsetY);
    }
    RECT rect;
    if (!GetWindowRect(hWnd, out rect)) {
      throw new InvalidOperationException("QA_WINDOWS_CHROME_WINDOW_BOUNDS_UNAVAILABLE");
    }
    return ResolveWindowBoundsForCorrelation(false, new int[] {
      rect.Left,
      rect.Top,
      rect.Right - rect.Left,
      rect.Bottom - rect.Top
    }, null, 0, 0);
  }

  public static int[] ReadPresentation(IntPtr hWnd) {
    int[] bounds = GetTopLevelWindowBounds(hWnd);
    return new int[] { bounds[0], bounds[1], bounds[2], bounds[3],
      IsIconic(hWnd) ? 2 : IsZoomed(hWnd) ? 3 : 1 };
  }

  public class PresentationPlan {
    public int MonitorCount;
    public int[] SelectedMonitor;
    public int[] SelectedWorkArea;
    public bool SelectedPrimary;
    public bool MoveRequested;
    public int[] RestoreBounds;
    public int[] Expected;
    public int GeometryTolerance;
  }

  public static int[][] ReadMonitorInventory() {
    List<int[]> monitors = new List<int[]>();
    bool monitorInfoFailed = false;
    bool succeeded = EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero,
      delegate(IntPtr monitor, IntPtr hdc, ref RECT rect, IntPtr data) {
        MONITORINFO info = new MONITORINFO();
        info.Size = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(monitor, ref info)) {
          monitorInfoFailed = true;
          return false;
        }
        monitors.Add(new int[] { info.Monitor.Left, info.Monitor.Top,
          info.Monitor.Right - info.Monitor.Left, info.Monitor.Bottom - info.Monitor.Top,
          info.Work.Left, info.Work.Top, info.Work.Right - info.Work.Left,
          info.Work.Bottom - info.Work.Top, (info.Flags & 1) != 0 ? 1 : 0 });
        return true;
      }, IntPtr.Zero);
    if (monitorInfoFailed) {
      throw new InvalidOperationException("QA_WINDOWS_CHROME_MONITOR_INFO_UNAVAILABLE");
    }
    if (!succeeded || monitors.Count == 0) {
      throw new InvalidOperationException("QA_WINDOWS_CHROME_MONITOR_ENUMERATION_FAILED");
    }
    return monitors.ToArray();
  }

  // Pure geometry boundary: no window or focus API is called here.
  public static PresentationPlan PlanSecondaryPresentation(int[] before, int[] restored,
    bool restoreMaximized, int[][] monitors, int sourceIndex) {
    if (before == null || before.Length != 5 || before[2] <= 0 || before[3] <= 0
      || before[4] < 1 || before[4] > 3 || restored == null || restored.Length != 4
      || restored[2] <= 0 || restored[3] <= 0 || monitors == null || monitors.Length == 0
      || sourceIndex < 0 || sourceIndex >= monitors.Length) {
      throw new InvalidOperationException("QA_WINDOWS_CHROME_PRESENTATION_INVALID");
    }
    int primaryCount = 0;
    foreach (int[] monitor in monitors) {
      if (monitor == null || monitor.Length != 9 || monitor[2] <= 0 || monitor[3] <= 0
        || monitor[6] <= 0 || monitor[7] <= 0 || monitor[8] < 0 || monitor[8] > 1
        || monitor[4] < monitor[0] || monitor[5] < monitor[1]
        || (long)monitor[4] + monitor[6] > (long)monitor[0] + monitor[2]
        || (long)monitor[5] + monitor[7] > (long)monitor[1] + monitor[3]) {
        throw new InvalidOperationException("QA_WINDOWS_CHROME_MONITOR_INVENTORY_INVALID");
      }
      primaryCount += monitor[8];
    }
    if (primaryCount != 1) throw new InvalidOperationException("QA_WINDOWS_CHROME_MONITOR_PRIMARY_INVALID");
    int selected = sourceIndex;
    if (monitors[sourceIndex][8] == 1 && monitors.Length > 1) {
      selected = -1;
      for (int i = 0; i < monitors.Length; i++) {
        if (monitors[i][8] == 1) continue;
        if (selected == -1 || monitors[i][0] < monitors[selected][0]
          || (monitors[i][0] == monitors[selected][0] && monitors[i][1] < monitors[selected][1])) selected = i;
      }
    }
    int[] target = monitors[selected];
    bool move = selected != sourceIndex;
    int[] normal = before[4] == 1 ? new int[] { before[0], before[1], before[2], before[3] }
      : (int[])restored.Clone();
    if (move) {
      normal[2] = Math.Min(normal[2], target[6]);
      normal[3] = Math.Min(normal[3], target[7]);
      normal[0] = target[4] + (target[6] - normal[2]) / 2;
      normal[1] = target[5] + (target[7] - normal[3]) / 2;
    }
    bool maximized = before[4] == 3 || (before[4] == 2 && restoreMaximized);
    int[] expected = (int[])before.Clone();
    int tolerance = 0;
    if (move || before[4] == 2) {
      expected = maximized ? new int[] { target[4], target[5], target[6], target[7], 3 }
        : new int[] { normal[0], normal[1], normal[2], normal[3], 1 };
      // Native maximized borders may extend beyond the monitor work rectangle.
      tolerance = maximized ? 32 : 0;
    }
    return new PresentationPlan { MonitorCount = monitors.Length,
      SelectedMonitor = new int[] { target[0], target[1], target[2], target[3] },
      SelectedWorkArea = new int[] { target[4], target[5], target[6], target[7] },
      SelectedPrimary = target[8] == 1, MoveRequested = move,
      RestoreBounds = normal, Expected = expected, GeometryTolerance = tolerance };
  }

  public static PresentationPlan PrepareSecondaryPresentation(IntPtr hWnd, int[] before) {
    WINDOWPLACEMENT placement = new WINDOWPLACEMENT();
    placement.Length = Marshal.SizeOf(typeof(WINDOWPLACEMENT));
    if (!GetWindowPlacement(hWnd, ref placement)) {
      throw new InvalidOperationException("QA_WINDOWS_CHROME_WINDOW_PLACEMENT_UNAVAILABLE");
    }
    MONITORINFO source = new MONITORINFO();
    source.Size = Marshal.SizeOf(typeof(MONITORINFO));
    IntPtr sourceHandle = MonitorFromWindow(hWnd, 2);
    if (sourceHandle == IntPtr.Zero || !GetMonitorInfo(sourceHandle, ref source)) {
      throw new InvalidOperationException("QA_WINDOWS_CHROME_WINDOW_MONITOR_UNAVAILABLE");
    }
    int[][] monitors = ReadMonitorInventory();
    int sourceIndex = -1;
    for (int i = 0; i < monitors.Length; i++) {
      if (monitors[i][0] == source.Monitor.Left && monitors[i][1] == source.Monitor.Top
        && monitors[i][2] == source.Monitor.Right - source.Monitor.Left
        && monitors[i][3] == source.Monitor.Bottom - source.Monitor.Top) {
        if (sourceIndex != -1) throw new InvalidOperationException("QA_WINDOWS_CHROME_WINDOW_MONITOR_AMBIGUOUS");
        sourceIndex = i;
      }
    }
    int offsetX = 0, offsetY = 0;
    const int WS_EX_TOOLWINDOW = 0x00000080;
    bool workspaceCoordinates = (GetWindowLong(hWnd, -20) & WS_EX_TOOLWINDOW) == 0;
    if (workspaceCoordinates) {
      offsetX = source.Work.Left - source.Monitor.Left;
      offsetY = source.Work.Top - source.Monitor.Top;
    }
    int[] restored = new int[] { placement.NormalPosition.Left + offsetX,
      placement.NormalPosition.Top + offsetY,
      placement.NormalPosition.Right - placement.NormalPosition.Left,
      placement.NormalPosition.Bottom - placement.NormalPosition.Top };
    PresentationPlan plan = PlanSecondaryPresentation(before, restored,
      (placement.Flags & 2) != 0, monitors, sourceIndex);
    if (!plan.MoveRequested) return plan;
    if (before[4] == 1) {
      const uint SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010, SWP_NOOWNERZORDER = 0x0200;
      if (!SetWindowPos(hWnd, IntPtr.Zero, plan.Expected[0], plan.Expected[1],
        plan.Expected[2], plan.Expected[3], SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER)) {
        throw new InvalidOperationException("QA_WINDOWS_CHROME_SECONDARY_MONITOR_MOVE_FAILED");
      }
    } else {
      offsetX = workspaceCoordinates ? plan.SelectedWorkArea[0] - plan.SelectedMonitor[0] : 0;
      offsetY = workspaceCoordinates ? plan.SelectedWorkArea[1] - plan.SelectedMonitor[1] : 0;
      placement.NormalPosition.Left = plan.RestoreBounds[0] - offsetX;
      placement.NormalPosition.Top = plan.RestoreBounds[1] - offsetY;
      placement.NormalPosition.Right = placement.NormalPosition.Left + plan.RestoreBounds[2];
      placement.NormalPosition.Bottom = placement.NormalPosition.Top + plan.RestoreBounds[3];
      placement.MaxPosition.X = -1;
      placement.MaxPosition.Y = -1;
      if (!SetWindowPlacement(hWnd, ref placement)) {
        throw new InvalidOperationException("QA_WINDOWS_CHROME_SECONDARY_MONITOR_MOVE_FAILED");
      }
    }
    return plan;
  }

  public static void VerifyPresentedPlacement(int[] expected, int[] after, int geometryTolerance) {
    if (expected == null || after == null || expected.Length != 5 || after.Length != 5
      || expected[2] <= 0 || expected[3] <= 0 || after[2] <= 0 || after[3] <= 0
      || expected[4] < 1 || expected[4] > 3 || after[4] < 1 || after[4] > 3
      || (geometryTolerance != 0 && (geometryTolerance != 32 || expected[4] != 3))) {
      throw new InvalidOperationException("QA_WINDOWS_CHROME_PRESENTATION_INVALID");
    }
    for (int i = 0; i < 5; i++) {
      if (Math.Abs((long)expected[i] - after[i]) > (i == 4 ? 0 : geometryTolerance)) {
        throw new InvalidOperationException("QA_WINDOWS_CHROME_PRESENTATION_CHANGED");
      }
    }
  }
}
'@

function Throw-QaCode {
  param([Parameter(Mandatory = $true)][string]$Code)
  throw [System.InvalidOperationException]::new($Code)
}

function Encode-Utf8 {
  param([AllowEmptyString()][string]$Value)
  return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$Value))
}

function Get-ElementPatterns {
  param([Parameter(Mandatory = $true)]$Element)
  return @(
    $Element.GetSupportedPatterns() |
      ForEach-Object { $_.ProgrammaticName } |
      Sort-Object
  )
}

function Get-ElementRecord {
  param([Parameter(Mandatory = $true)]$Element)
  $bounds = $Element.Current.BoundingRectangle
  return [ordered]@{
    nameBase64 = Encode-Utf8 $Element.Current.Name
    automationId = [string]$Element.Current.AutomationId
    className = [string]$Element.Current.ClassName
    controlType = [string]$Element.Current.ControlType.ProgrammaticName
    enabled = [bool]$Element.Current.IsEnabled
    offscreen = [bool]$Element.Current.IsOffscreen
    bounds = [ordered]@{
      x = [Math]::Round($bounds.X, 2)
      y = [Math]::Round($bounds.Y, 2)
      width = [Math]::Round($bounds.Width, 2)
      height = [Math]::Round($bounds.Height, 2)
    }
    patterns = @(Get-ElementPatterns $Element)
  }
}

function Get-BrowserWindow {
  $portToken = "--remote-debugging-port=$RemoteDebuggingPort"
  $candidates = @(
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -ieq 'chrome.exe' -and
        $_.CommandLine -and
        $_.CommandLine.IndexOf(
          $portToken,
          [StringComparison]::OrdinalIgnoreCase
        ) -ge 0 -and
        $_.CommandLine -notmatch '(?:^|\s)--type='
      }
  )
  if ($candidates.Count -ne 1) {
    Throw-QaCode "QA_WINDOWS_CHROME_PROCESS_COUNT_INVALID:$($candidates.Count)"
  }
  if (
    $ExpectedProcessId -gt 0 -and
    [int]$candidates[0].ProcessId -ne $ExpectedProcessId
  ) {
    Throw-QaCode 'QA_WINDOWS_CHROME_PROCESS_ID_MISMATCH'
  }
  $script:browserCommandLine = [string]$candidates[0].CommandLine
  $process = Get-Process -Id $candidates[0].ProcessId -ErrorAction Stop
  if (
    $process.MainWindowHandle -eq [IntPtr]::Zero -and
    $Operation -eq 'focus_window'
  ) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds(4000)
    do {
      Start-Sleep -Milliseconds 100
      $process.Refresh()
    } while (
      $process.MainWindowHandle -eq [IntPtr]::Zero -and
      [DateTime]::UtcNow -lt $deadline
    )
  }
  if ($process.MainWindowHandle -eq [IntPtr]::Zero) {
    Throw-QaCode 'QA_WINDOWS_CHROME_MAIN_WINDOW_REQUIRED'
  }
  if ($Operation -ne 'focus_window') {
    return $process
  }
  $visibleWindows = @(
    [EntropyQaNativeWindow]::GetVisibleTopLevelWindowsForProcess(
      [uint32]$process.Id
    )
  )
  $matchedWindows = @()
  $windowCandidates = @()
  $targetWindowCorrelated = $null -ne $script:expectedWindowBounds
  if ($targetWindowCorrelated) {
    foreach ($handle in $visibleWindows) {
      $bounds = [EntropyQaNativeWindow]::GetTopLevelWindowBounds($handle)
      $nativeLeft = [int]$bounds[0]
      $nativeTop = [int]$bounds[1]
      $nativeWidth = [int]$bounds[2]
      $nativeHeight = [int]$bounds[3]
      $windowCandidates += [ordered]@{
        handle = $handle.ToInt64()
        left = $nativeLeft
        top = $nativeTop
        width = $nativeWidth
        height = $nativeHeight
      }
      $tolerance = 32
      if (
        [Math]::Abs($nativeLeft - $script:expectedWindowBounds.left) -le $tolerance -and
        [Math]::Abs($nativeTop - $script:expectedWindowBounds.top) -le $tolerance -and
        [Math]::Abs($nativeWidth - $script:expectedWindowBounds.width) -le $tolerance -and
        [Math]::Abs($nativeHeight - $script:expectedWindowBounds.height) -le $tolerance
      ) {
        $matchedWindows += $handle
      }
    }
  } else {
    $matchedWindows = @($visibleWindows)
  }
  if ($matchedWindows.Count -ne 1) {
    $script:windowCorrelation = [ordered]@{
      processId = $process.Id
      expected = $script:expectedWindowBounds
      candidates = @($windowCandidates)
    }
    Throw-QaCode "QA_WINDOWS_CHROME_TARGET_WINDOW_MATCH_COUNT_INVALID:$($matchedWindows.Count)"
  }
  return [pscustomobject]@{
    Id = $process.Id
    MainWindowHandle = [IntPtr]$matchedWindows[0]
    ProcessVisibleWindowCount = $visibleWindows.Count
    WindowMatchCount = $matchedWindows.Count
    TargetWindowCorrelated = $targetWindowCorrelated
  }
}

function Set-BrowserForeground {
  param([Parameter(Mandatory = $true)]$Process)
  $presentationBefore = [EntropyQaNativeWindow]::ReadPresentation($Process.MainWindowHandle)
  # Only the bounded focus_window preparation owns monitor placement. Toolbar
  # inspection/pinning retains its existing presentation and never moves it.
  $placement = if ($Operation -eq 'focus_window') {
    [EntropyQaNativeWindow]::PrepareSecondaryPresentation($Process.MainWindowHandle, $presentationBefore)
  } else { $null }
  [void][EntropyQaNativeWindow]::ForceForeground($Process.MainWindowHandle)
  Start-Sleep -Milliseconds 180
  if (
    [EntropyQaNativeWindow]::GetForegroundWindow() -ne
      $Process.MainWindowHandle
  ) {
    Throw-QaCode 'QA_WINDOWS_CHROME_FOREGROUND_FAILED'
  }
  $presentationAfter = [EntropyQaNativeWindow]::ReadPresentation($Process.MainWindowHandle)
  if ($null -eq $placement) {
    # Existing toolbar UI operations restore minimized windows but have no
    # authority to relocate an already displayed window.
    if ($presentationBefore[4] -ne 2) {
      [EntropyQaNativeWindow]::VerifyPresentedPlacement($presentationBefore, $presentationAfter, 0)
    }
    return [ordered]@{ before = $presentationBefore; after = $presentationAfter }
  }
  [EntropyQaNativeWindow]::VerifyPresentedPlacement($placement.Expected, $presentationAfter, $placement.GeometryTolerance)
  return [ordered]@{
    before = $presentationBefore
    expected = $placement.Expected
    after = $presentationAfter
    placement = [ordered]@{
      policy = 'secondary_preferred'
      status = if ($placement.MonitorCount -eq 1) { 'single_monitor_unchanged' } else { 'secondary_selected' }
      monitorCount = $placement.MonitorCount
      selectedMonitor = $placement.SelectedMonitor
      selectedWorkArea = $placement.SelectedWorkArea
      selectedPrimary = $placement.SelectedPrimary
      moveRequested = $placement.MoveRequested
      geometryTolerance = $placement.GeometryTolerance
    }
  }
}

function Find-All {
  param(
    [Parameter(Mandatory = $true)]$Root,
    [Parameter(Mandatory = $true)]$Condition
  )
  return @(
    $Root.FindAll(
      [System.Windows.Automation.TreeScope]::Subtree,
      $Condition
    )
  )
}

function Find-ByAutomationId {
  param(
    [Parameter(Mandatory = $true)]$Root,
    [Parameter(Mandatory = $true)][string]$AutomationId
  )
  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    $AutomationId
  )
  $matches = @(Find-All $Root $condition)
  if ($matches.Count -ne 1) {
    Throw-QaCode "QA_WINDOWS_UI_AUTOMATION_ID_COUNT_INVALID:${AutomationId}:$($matches.Count)"
  }
  return $matches[0]
}

function Close-ChromeTransientUi {
  [void](Set-BrowserForeground $browserProcess)
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
  Start-Sleep -Milliseconds 80
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
  Start-Sleep -Milliseconds 120
}

function Click-ElementCenter {
  param([Parameter(Mandatory = $true)]$Element)
  $bounds = $Element.Current.BoundingRectangle
  if (
    $bounds.IsEmpty -or
    $bounds.Width -le 0 -or
    $bounds.Height -le 0 -or
    $Element.Current.IsOffscreen
  ) {
    Throw-QaCode 'QA_WINDOWS_UI_CLICK_BOUNDS_INVALID'
  }
  $x = [int][Math]::Round($bounds.X + ($bounds.Width / 2))
  $y = [int][Math]::Round($bounds.Y + ($bounds.Height / 2))
  if (-not [EntropyQaNativeWindow]::SetCursorPos($x, $y)) {
    Throw-QaCode 'QA_WINDOWS_UI_CURSOR_POSITION_FAILED'
  }
  Start-Sleep -Milliseconds 50
  [EntropyQaNativeWindow]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [EntropyQaNativeWindow]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 120
}

function Open-ExtensionsMenu {
  Close-ChromeTransientUi
  $button = Find-ByAutomationId $browserRoot 'view_1006'
  Click-ElementCenter $button
  Start-Sleep -Milliseconds 250
}

function Get-ProcessElements {
  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
    $browserProcess.Id
  )
  return @(Find-All ([System.Windows.Automation.AutomationElement]::RootElement) $condition)
}

function Find-ExpectedNameElements {
  $deadline = [DateTime]::UtcNow.AddMilliseconds(2500)
  do {
    $matches = @(
      Get-ProcessElements |
        Where-Object {
          $_.Current.Name -and
          $_.Current.Name.IndexOf(
            $expectedName,
            [StringComparison]::OrdinalIgnoreCase
          ) -ge 0
        }
    )
    if ($matches.Count -gt 0) {
      return $matches
    }
    Start-Sleep -Milliseconds 80
  } while ([DateTime]::UtcNow -lt $deadline)
  Throw-QaCode 'QA_WINDOWS_ENTROPY_UI_ELEMENT_NOT_FOUND'
}

function Find-PinControl {
  $menuItems = @(
    Get-ProcessElements |
      Where-Object {
        $_.Current.ControlType.ProgrammaticName -eq 'ControlType.MenuItem' -and
        -not $_.Current.IsOffscreen
      }
  )
  $headers = @(
    $menuItems |
      Where-Object {
        $_.Current.Name -eq $expectedName -and
        -not $_.Current.IsEnabled
      }
  )
  if ($headers.Count -ne 1) {
    Throw-QaCode "QA_WINDOWS_ENTROPY_OPTIONS_HEADER_COUNT_INVALID:$($headers.Count)"
  }
  $headerBounds = $headers[0].Current.BoundingRectangle
  $rows = @(
    $menuItems |
      Where-Object {
        $bounds = $_.Current.BoundingRectangle
        [Math]::Abs($bounds.X - $headerBounds.X) -le 2 -and
        [Math]::Abs($bounds.Width - $headerBounds.Width) -le 2 -and
        $bounds.Y -ge $headerBounds.Y
      } |
      Sort-Object { $_.Current.BoundingRectangle.Y }
  )
  $pinCandidates = @()
  for ($index = 1; $index -lt $rows.Count; $index += 1) {
    $previous = $rows[$index - 1]
    $current = $rows[$index]
    $previousBounds = $previous.Current.BoundingRectangle
    $currentBounds = $current.Current.BoundingRectangle
    $rowHeight = [Math]::Max($previousBounds.Height, $currentBounds.Height)
    $gap = $currentBounds.Y - $previousBounds.Y
    if (
      $previous.Current.IsEnabled -and
      $current.Current.IsEnabled -and
      $gap -gt ($rowHeight * 1.35)
    ) {
      $pinCandidates += $current
      break
    }
  }
  if ($pinCandidates.Count -ne 1) {
    Throw-QaCode "QA_WINDOWS_ENTROPY_PIN_CONTROL_COUNT_INVALID:$($pinCandidates.Count)"
  }
  $patterns = @($pinCandidates[0].GetSupportedPatterns()).ProgrammaticName
  if ($patterns -notcontains 'InvokePatternIdentifiers.Pattern') {
    Throw-QaCode 'QA_WINDOWS_ENTROPY_PIN_INVOKE_PATTERN_REQUIRED'
  }
  return $pinCandidates[0]
}

function Open-ExpectedExtensionOptions {
  $namedElements = @(Find-ExpectedNameElements)
  $optionsCandidates = @(
    $namedElements |
      Where-Object {
        $_.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and
        $_.Current.IsEnabled -and
        -not $_.Current.IsOffscreen -and
        @($_.GetSupportedPatterns()).ProgrammaticName -contains
          'ExpandCollapsePatternIdentifiers.Pattern'
      }
  )
  if ($optionsCandidates.Count -ne 1) {
    Throw-QaCode "QA_WINDOWS_ENTROPY_OPTIONS_COUNT_INVALID:$($optionsCandidates.Count)"
  }
  Click-ElementCenter $optionsCandidates[0]
  Start-Sleep -Milliseconds 180
}

try {
  $expectedName = [Text.Encoding]::UTF8.GetString(
    [Convert]::FromBase64String($ExpectedNameBase64)
  )
  if ([string]::IsNullOrWhiteSpace($expectedName)) {
    Throw-QaCode 'QA_WINDOWS_EXPECTED_NAME_REQUIRED'
  }
  $script:expectedWindowBounds = $null
  if (-not [string]::IsNullOrEmpty($ExpectedWindowBoundsBase64)) {
    try {
      $decodedBounds = [Text.Encoding]::UTF8.GetString(
        [Convert]::FromBase64String($ExpectedWindowBoundsBase64)
      ) | ConvertFrom-Json
    } catch {
      Throw-QaCode 'QA_WINDOWS_CHROME_EXPECTED_WINDOW_BOUNDS_INVALID'
    }
    $propertyNames = @(
      $decodedBounds.PSObject.Properties.Name | Sort-Object
    )
    if (
      ($propertyNames -join ',') -cne 'height,left,top,width,windowState' -or
      $decodedBounds.left -isnot [int] -or
      $decodedBounds.top -isnot [int] -or
      $decodedBounds.width -isnot [int] -or
      $decodedBounds.width -le 0 -or
      $decodedBounds.height -isnot [int] -or
      $decodedBounds.height -le 0 -or
      @('normal', 'minimized', 'maximized', 'fullscreen') -cnotcontains
        [string]$decodedBounds.windowState
    ) {
      Throw-QaCode 'QA_WINDOWS_CHROME_EXPECTED_WINDOW_BOUNDS_INVALID'
    }
    $script:expectedWindowBounds = $decodedBounds
  }

  if ($Operation -eq 'focus_window' -and
    ($ExpectedProcessId -le 0 -or $null -eq $script:expectedWindowBounds)) {
    Throw-QaCode 'QA_WINDOWS_CHROME_TARGET_WINDOW_PROOF_REQUIRED'
  }

  $browserProcess = Get-BrowserWindow
  $browserRoot = [System.Windows.Automation.AutomationElement]::FromHandle(
    $browserProcess.MainWindowHandle
  )
  if (-not $browserRoot) {
    Throw-QaCode 'QA_WINDOWS_CHROME_AUTOMATION_ROOT_REQUIRED'
  }

  if ($Operation -eq 'inspect_process') {
    [ordered]@{
      ok = $true
      operation = 'inspect_process'
      processId = $browserProcess.Id
      muteAudioArgumentPresent = [bool](
        $browserCommandLine -match '(?:^|\s)--mute-audio(?:=|\s|$)'
      )
    } | ConvertTo-Json -Depth 4 -Compress
    exit 0
  }

  if ($Operation -eq 'inspect_foreground') {
    [ordered]@{
      ok = $true
      operation = 'inspect_foreground'
      processId = $browserProcess.Id
      browserIsForeground = [bool](
        [EntropyQaNativeWindow]::GetForegroundWindow() -eq
          $browserProcess.MainWindowHandle
      )
    } | ConvertTo-Json -Depth 4 -Compress
    exit 0
  }

  if ($Operation -eq 'minimize_window') {
    $minimizeRequestCount = 0
    $stableBackgroundSince = $null
    $deadline = [DateTime]::UtcNow.AddMilliseconds(3200)
    do {
      $browserIsForeground = [bool](
        [EntropyQaNativeWindow]::GetForegroundWindow() -eq
          $browserProcess.MainWindowHandle
      )
      if ($browserIsForeground -or $minimizeRequestCount -eq 0) {
        [void][EntropyQaNativeWindow]::ShowWindowAsync(
          $browserProcess.MainWindowHandle,
          6
        )
        $minimizeRequestCount += 1
        $stableBackgroundSince = $null
      } elseif ($null -eq $stableBackgroundSince) {
        $stableBackgroundSince = [DateTime]::UtcNow
      } elseif (
        ([DateTime]::UtcNow - $stableBackgroundSince).TotalMilliseconds -ge 700
      ) {
        break
      }
      Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    $browserIsForeground = [bool](
      [EntropyQaNativeWindow]::GetForegroundWindow() -eq
        $browserProcess.MainWindowHandle
    )
    if ($browserIsForeground) {
      Throw-QaCode 'QA_WINDOWS_CHROME_MINIMIZE_FOCUS_NOT_RELEASED'
    }
    [ordered]@{
      ok = $true
      operation = 'minimize_window'
      processId = $browserProcess.Id
      browserIsForeground = $browserIsForeground
      minimized = $true
      minimizeRequestCount = $minimizeRequestCount
      focusRequested = $false
    } | ConvertTo-Json -Depth 4 -Compress
    exit 0
  }

  if ($Operation -eq 'focus_window') {
    $presentation = Set-BrowserForeground $browserProcess
    [ordered]@{
      ok = $true
      operation = 'focus_window'
      processId = $browserProcess.Id
      browserIsForeground = [bool](
        [EntropyQaNativeWindow]::GetForegroundWindow() -eq
          $browserProcess.MainWindowHandle
      )
      windowVisible = $true
      processVisibleWindowCount = $browserProcess.ProcessVisibleWindowCount
      windowMatchCount = $browserProcess.WindowMatchCount
      targetWindowCorrelated = $browserProcess.TargetWindowCorrelated
      focusRequested = $true
      presentation = $presentation
    } | ConvertTo-Json -Depth 6 -Compress
    exit 0
  }

  if ($Operation -eq 'inspect' -or $Operation -eq 'inspect_options') {
    Open-ExtensionsMenu
    $namedElements = @(Find-ExpectedNameElements)
    if ($Operation -eq 'inspect_options') {
      Open-ExpectedExtensionOptions
    }
    $all = @(Get-ProcessElements)
    $interesting = @(
      $all |
        Where-Object {
          $patterns = @($_.GetSupportedPatterns()).ProgrammaticName
          ($_.Current.Name -and $_.Current.Name.IndexOf(
            $expectedName,
            [StringComparison]::OrdinalIgnoreCase
          ) -ge 0) -or
          $patterns -contains 'TogglePatternIdentifiers.Pattern' -or
          ($_.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and
            -not $_.Current.IsOffscreen) -or
          ($_.Current.ControlType.ProgrammaticName -eq 'ControlType.MenuItem' -and
            -not $_.Current.IsOffscreen)
        } |
        Select-Object -First 120 |
        ForEach-Object { Get-ElementRecord $_ }
    )
    [ordered]@{
      ok = $true
      operation = $Operation
      processId = $browserProcess.Id
      expectedMatchCount = $namedElements.Count
      elements = $interesting
    } | ConvertTo-Json -Depth 8 -Compress
    exit 0
  }

  if ($Operation -eq 'pin') {
    Open-ExtensionsMenu
    [void](Find-ExpectedNameElements)
    Open-ExpectedExtensionOptions
    $pinControl = Find-PinControl
    Click-ElementCenter $pinControl
    Start-Sleep -Milliseconds 250
    Close-ChromeTransientUi
    [ordered]@{
      ok = $true
      operation = 'pin'
      processId = $browserProcess.Id
      invoked = $true
      focusChanged = $true
    } | ConvertTo-Json -Depth 4 -Compress
    exit 0
  }
} catch {
  $codeException = $_.Exception
  while ($null -ne $codeException -and
    $codeException.Message -notmatch '^QA_[A-Z0-9_:.-]+$') {
    $codeException = $codeException.InnerException
  }
  $code = if ($null -ne $codeException) {
    $codeException.Message
  } else {
    'QA_WINDOWS_UI_AUTOMATION_UNEXPECTED'
  }
  [ordered]@{
    ok = $false
    operation = $Operation
    code = $code
    exceptionType = $_.Exception.GetType().FullName
    hresult = $_.Exception.HResult
    innerExceptionType = if ($_.Exception.InnerException) {
      $_.Exception.InnerException.GetType().FullName
    } else {
      $null
    }
    innerHresult = if ($_.Exception.InnerException) {
      $_.Exception.InnerException.HResult
    } else {
      $null
    }
    scriptLine = $_.InvocationInfo.ScriptLineNumber
    windowCorrelation = $script:windowCorrelation
  } | ConvertTo-Json -Depth 4 -Compress
  exit 1
}
