# Updating the Gemini reference

Run in PowerShell after pushing the original repository:

```powershell
& "$HOME\.codex\tools\entropy-gemini-sync.ps1"
```

Read-only preflight:

```powershell
& "$HOME\.codex\tools\entropy-gemini-sync.ps1" -Check
```

Only the latest pushed main commit of RYUU-JII/Entropy is exported. Local working files, staging, commits, remotes, hooks and settings are never changed. A local commit alone does not update this repository. Pushing the original alone also does not trigger this command. No automatic hook, background monitor or schedule is installed.

Repeated runs for the same exported commit and policy do nothing. A pushed source commit older than the current reference baseline is rejected. Missing local Git objects require the user to fetch them separately; this tool never fetches into the original. Export is validated before the public reference repository is changed. Reference push failures remain visible; running again can retry an already-created local reference commit.

The script lives outside both original and reference repositories. GitHub Actions workflows and tests are omitted from the export. This repository is for code review context. Refresh the Gemini import after an update.
