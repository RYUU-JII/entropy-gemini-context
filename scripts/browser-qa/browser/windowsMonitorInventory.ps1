$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class BrowserQaMonitorInventory {
    [StructLayout(LayoutKind.Sequential)] public struct Rect {
        public int Left, Top, Right, Bottom;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct MonitorInfo {
        public int Size;
        public Rect Bounds, WorkArea;
        public uint Flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Device;
    }
    public sealed class Monitor {
        public string deviceName;
        public bool primary;
        public int[] bounds;
        public int[] workArea;
        public double scaleFactor;
    }
    private delegate bool MonitorCallback(IntPtr monitor, IntPtr dc, ref Rect bounds, IntPtr data);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool EnumDisplayMonitors(IntPtr dc, IntPtr clip, MonitorCallback callback, IntPtr data);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("shcore.dll")] private static extern int GetProcessDpiAwareness(IntPtr process, out int awareness);
    [DllImport("shcore.dll")] private static extern int SetProcessDpiAwareness(int awareness);
    [DllImport("shcore.dll")] private static extern int GetDpiForMonitor(IntPtr monitor, int kind, out uint x, out uint y);
    private static int[] Rectangle(Rect r) { return new int[] { r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top }; }
    public static Monitor[] Read(double textScale) {
        int awareness;
        Marshal.ThrowExceptionForHR(GetProcessDpiAwareness(IntPtr.Zero, out awareness));
        if (awareness != 2) Marshal.ThrowExceptionForHR(SetProcessDpiAwareness(2));
        var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
        if (previous == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try {
            var monitors = new List<Monitor>();
            Exception failure = null;
            MonitorCallback callback = delegate(IntPtr monitor, IntPtr dc, ref Rect bounds, IntPtr data) {
                try {
                    var info = new MonitorInfo { Size = Marshal.SizeOf(typeof(MonitorInfo)) };
                    if (!GetMonitorInfo(monitor, ref info)) throw new Win32Exception(Marshal.GetLastWin32Error());
                    uint x, y;
                    int result = GetDpiForMonitor(monitor, 0, out x, out y);
                    if (result != 0) Marshal.ThrowExceptionForHR(result);
                    if (x == 0 || x != y) throw new InvalidOperationException("QA_WINDOWS_MONITOR_DPI_INVALID");
                    monitors.Add(new Monitor { deviceName = info.Device, primary = (info.Flags & 1) != 0,
                        bounds = Rectangle(info.Bounds), workArea = Rectangle(info.WorkArea), scaleFactor = x / 96.0 * textScale });
                    return true;
                } catch (Exception error) { failure = error; return false; }
            };
            bool success = EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, callback, IntPtr.Zero);
            if (failure != null) throw failure;
            if (!success) throw new Win32Exception(Marshal.GetLastWin32Error());
            return monitors.ToArray();
        } finally {
            if (SetThreadDpiAwarenessContext(previous) == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        }
    }
}
'@

# Chromium includes Windows accessibility text scaling in its display DIPs.
$textScale = 1.0
$accessibilityKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Microsoft\Accessibility')
if ($null -ne $accessibilityKey) {
    try {
        $configuredScale = $accessibilityKey.GetValue('TextScaleFactor', $null)
        if ($null -ne $configuredScale) { $textScale = [double]$configuredScale / 100.0 }
    } finally { $accessibilityKey.Dispose() }
}
if ($textScale -lt 1.0 -or $textScale -gt 3.0) { throw 'QA_WINDOWS_MONITOR_TEXT_SCALE_INVALID' }
$monitors = @([BrowserQaMonitorInventory]::Read($textScale))
ConvertTo-Json -InputObject $monitors -Depth 5 -Compress
