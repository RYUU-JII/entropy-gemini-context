# Entropy Gemini / Argon Reference

This is a private, read-only reference snapshot for Gemini Import Code. It is separate from the working Entropy repository.

## Start here

Snapshot: entropy-2026-10-14-130557-86054c5923fa
Original source commit: 86054c5923fa0cfa7e315e4549e672fee643e3fd
Captured working-copy changes are included. Consult SNAPSHOT_STATUS.txt for capture caveats.

1. Read this file and AGENTS.md.
2. Read docs/governance/agent-start-here.md and docs/governance/agent-routing-index.md only as needed for the task.
3. Inspect only the specific files, functions and original line ranges provided in the task request.

## GPT / Argon collaboration

The user chooses goals and final decisions. GPT explores the local working repository, identifies owners, plans changes, supplies minimal evidence, implements approved direction and verifies results. Argon reviews the supplied evidence, challenges design decisions and advises on details. Argon must not claim to have implemented or tested changes.

GPT supplies task purpose, observed behavior, proposed change, relevant Active contracts, file paths, symbols, original line ranges, minimal excerpts and snapshot identity. Argon distinguishes facts, inferences and proposals. If evidence is insufficient, request specific additional files/functions/line ranges rather than asking to read the entire repository.

Sources retain their original repository-relative paths and exact captured bytes. Line references refer to these original files, not a combined text pack. SOURCE_MANIFEST.json records SHA256, size and line counts.

## Scope

Includes selected product source, public assets, current documents, non-research development/CI scripts, tools and root configuration. Excludes research output, reports, installed dependencies, builds, captures, archived docs, temporary output, local orchestration state and Git history. Original tests remain in the Drive backup; they are omitted here to keep this import under 5,000 files. Ask GPT for the exact relevant tests when needed. GitHub Actions workflows and hooks are omitted. This is a reference package, not a verified complete build environment.

This repository and imported Gemini chats do not automatically synchronize with the working checkout. Refresh the reference repository deliberately, then import again for the latest snapshot. A file changed in another task during capture; see context/07-CAPTURE-NOTE.txt.

## Gemini import

On desktop Gemini: + / Add files → More uploads → Import code → paste this repository URL → Import. Connect the GitHub account with access when prompted. A private repository does not need to be made public. Use the same repository URL in each new chat.
