using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

// The native handle is the authority. No PID enumeration or PID-based kill.
public sealed class QaChildJob : IDisposable {
    delegate bool ConsoleControl(uint kind);
    static readonly ConsoleControl IgnoreInterrupt = kind => kind==0 || kind==1;
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetConsoleCtrlHandler(ConsoleControl handler,bool add);
    public static void ProtectCleanupFromConsoleInterrupts() { Check(SetConsoleCtrlHandler(IgnoreInterrupt,true),"CONSOLE_HANDLER"); }
    [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong a,b,c,d,e,f; }
    [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT {
        public long a,b; public uint Flags; public UIntPtr c,d; public uint e;
        public UIntPtr f; public uint g,h;
    }
    [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMIT {
        public BASIC_LIMIT Basic; public IO_COUNTERS Io; public UIntPtr a,b,c,d;
    }
    [StructLayout(LayoutKind.Sequential)] struct ACCOUNTING {
        public long a,b,c,d; public uint e,Total,Active,Terminated;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct STARTUPINFO {
        public int cb; public string reserved,desktop,title;
        public uint x,y,xs,ys,xc,yc,fill,flags; public ushort show,reserved2;
        public IntPtr reservedPtr,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX {
        public STARTUPINFO Startup; public IntPtr Attributes;
    }
    [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION {
        public IntPtr process,thread; public uint pid,tid;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs,string name);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr OpenJobObject(uint access,bool inherit,string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref EXTENDED_LIMIT value,int size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out ACCOUNTING value,int size,IntPtr returned);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder args,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref STARTUPINFOEX startup,out PROCESS_INFORMATION pi);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long creation,out long exit,out long kernel,out long user);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr process,uint flags,StringBuilder name,ref uint size);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int id);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool DuplicateHandle(IntPtr sourceProcess,IntPtr source,IntPtr targetProcess,out IntPtr target,uint access,bool inherit,uint options);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

    IntPtr job,process,thread;
    public uint Pid { get; private set; }
    public string StartToken { get; private set; }
    public string Executable { get; private set; }
    static void Check(bool ok,string stage) { if(!ok) throw new Win32Exception(Marshal.GetLastWin32Error(), "QA_WINDOWS_CHILD_JOB_"+stage); }
    public QaChildJob(string name) {
        job=CreateJobObject(IntPtr.Zero,name);
        Check(job!=IntPtr.Zero,"CREATE");
        if(Marshal.GetLastWin32Error()==183) { Dispose(); throw new Exception("QA_WINDOWS_CHILD_JOB_ALREADY_EXISTS"); }
        try {
            var limits=new EXTENDED_LIMIT(); limits.Basic.Flags=0x2000; // KILL_ON_JOB_CLOSE; no breakaway.
            Check(SetInformationJobObject(job,9,ref limits,Marshal.SizeOf(limits)),"LIMITS");
        } catch { Dispose(); throw; }
    }
    public static string Quote(string arg) {
        var b=new StringBuilder("\""); int slashes=0;
        foreach(char c in arg) {
            if(c=='\\') { slashes++; continue; }
            if(c=='"') { b.Append('\\',slashes*2+1); b.Append(c); }
            else { b.Append('\\',slashes); b.Append(c); }
            slashes=0;
        }
        b.Append('\\',slashes*2); return b.Append('"').ToString();
    }
    public void Launch(string executable,string[] args,string cwd) {
        IntPtr size=IntPtr.Zero,list=IntPtr.Zero,jobs=IntPtr.Zero,handles=IntPtr.Zero;
        var streams=new IntPtr[3]; bool initialized=false;
        try {
            InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
            list=Marshal.AllocHGlobal(size);
            Check(InitializeProcThreadAttributeList(list,2,0,ref size),"ATTRIBUTES"); initialized=true;
            jobs=Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobs,job);
            // Atomic job assignment at CreateProcess: no suspended, unowned orphan window.
            Check(UpdateProcThreadAttribute(list,0,(IntPtr)0x2000D,jobs,(IntPtr)IntPtr.Size,IntPtr.Zero,IntPtr.Zero),"JOB_LIST");
            for(int i=0;i<3;i++) Check(DuplicateHandle(GetCurrentProcess(),GetStdHandle(-10-i),GetCurrentProcess(),out streams[i],0,true,2),"STDIO");
            handles=Marshal.AllocHGlobal(IntPtr.Size*3);
            for(int i=0;i<3;i++) Marshal.WriteIntPtr(handles,i*IntPtr.Size,streams[i]);
            Check(UpdateProcThreadAttribute(list,0,(IntPtr)0x20002,handles,(IntPtr)(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero),"HANDLE_LIST");
            var startup=new STARTUPINFOEX(); startup.Startup.cb=Marshal.SizeOf(startup);
            startup.Startup.flags=0x100; startup.Startup.input=streams[0]; startup.Startup.output=streams[1]; startup.Startup.error=streams[2]; startup.Attributes=list;
            var command=new StringBuilder(Quote(executable)); foreach(string arg in args) command.Append(' ').Append(Quote(arg));
            PROCESS_INFORMATION pi;
            Check(CreateProcess(executable,command,IntPtr.Zero,IntPtr.Zero,true,0x08080004,IntPtr.Zero,cwd,ref startup,out pi),"LAUNCH");
            process=pi.process; thread=pi.thread; Pid=pi.pid;
            long creation,exit,kernel,user; Check(GetProcessTimes(process,out creation,out exit,out kernel,out user),"START_TOKEN");
            StartToken="windows-filetime:"+creation;
            var name=new StringBuilder(32768); uint length=32768; Check(QueryFullProcessImageName(process,0,name,ref length),"IMAGE"); Executable=name.ToString();
        } finally {
            foreach(var handle in streams) if(handle!=IntPtr.Zero) CloseHandle(handle);
            if(initialized) DeleteProcThreadAttributeList(list);
            if(list!=IntPtr.Zero) Marshal.FreeHGlobal(list);
            if(jobs!=IntPtr.Zero) Marshal.FreeHGlobal(jobs);
            if(handles!=IntPtr.Zero) Marshal.FreeHGlobal(handles);
        }
    }
    public void Start() { Check(ResumeThread(thread)!=0xFFFFFFFF,"RESUME"); CloseHandle(thread); thread=IntPtr.Zero; }
    public bool RootExited { get { return WaitForSingleObject(process,0)==0; } }
    public uint ExitCode { get { uint code; Check(GetExitCodeProcess(process,out code),"EXIT_CODE"); return code; } }
    public uint ActiveCount { get { ACCOUNTING a; Check(QueryInformationJobObject(job,1,out a,Marshal.SizeOf(typeof(ACCOUNTING)),IntPtr.Zero),"ACCOUNTING"); return a.Active; } }
    public void Terminate() { Check(TerminateJobObject(job,130),"TERMINATE"); }
    // Recovery observes only. Never reopen an observation-file job name to kill it.
    public static bool IsAbsent(string name) {
        var handle=OpenJobObject(4,false,name);
        if(handle==IntPtr.Zero) { if(Marshal.GetLastWin32Error()==2) return true; Check(false,"OPEN"); }
        try { ACCOUNTING a; Check(QueryInformationJobObject(handle,1,out a,Marshal.SizeOf(typeof(ACCOUNTING)),IntPtr.Zero),"INSPECT"); return a.Active==0; }
        finally { CloseHandle(handle); }
    }
    public void Dispose() {
        if(job!=IntPtr.Zero) { CloseHandle(job); job=IntPtr.Zero; }
        if(thread!=IntPtr.Zero) { CloseHandle(thread); thread=IntPtr.Zero; }
        if(process!=IntPtr.Zero) { CloseHandle(process); process=IntPtr.Zero; }
    }
}
