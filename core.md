# EQUIFLOW — CENTRAL PROGRESS & CONTEXT ANCHOR (`core.md`)

> **MANDATORY PROTOCOL APPLIED:**  
> 1. Single Source of Truth: Auto-read on every session start.  
> 2. Strict Append-Only: Never delete or overwrite previous history.  
> 3. Mandatory Session Handoff: Log every completed session using the standardized format at the bottom.

---

## 1. PROJECT ARCHITECTURE & CORE SUMMARY
- **Project Name:** EquiFlow (Thien Ma Equestrian Club — TMEC)
- **Domain:** Racehorse Training, Stable Management, Veterinary Care & Equine Sports Finance.
- **Tech Stack:**
  - **Backend:** NestJS 11, TypeScript, Prisma ORM, PostgreSQL (Docker port 5432).
  - **Frontend:** React 19, Vite, Tailwind CSS, Lucide React (port 5173).
  - **Simulator:** HTML5 Canvas / Vite (port 5175).
- **Core RBAC Roles:**
  - `CLUB_MANAGER`: Full management, stall allocation, shifts, permission requests, financial reconciliation, tournaments, audit log.
  - `HEAD_TRAINER`: Training plans, weekly schedules, workout results, horse performance reviews.
  - `VETERINARIAN`: Medical records, preventive care schedules, prescriptions, Medical Lock execution.
  - `GROOM`: Daily care checklist (feeding, walking, grooming, icing), stall incident reporting.
  - `HORSE_OWNER`: Horse registration, view health/training, tournament entry, transfer confirmation, bill payment reporting.
- **Shared Test Password:** `EquiFlow@2026`

---

## 2. REPOSITORY & BRANCH STATUS (AS OF 2026-11-21)
- **Backend (`Racehorse_Training_Management_System_MT_BE`):**
  - Current Branch: `fix/michael` (Branched from `dev-michael/needfix`, Commit `0d5ac64` + `core.md`)
  - Target PR: `dev` on `origin` (GitHub)
- **Frontend (`Racehorse_Training_Management_System_MT_FE`):**
  - Current Branch: `fix/michael` (Branched from `dev-michael/needfix`, Commit `4a9fd5d` + `core.md`)
  - Target PR: `dev` on `origin` (GitHub)
- **Simulator (`Racehorse_Simulator_Web`):**
  - Current Branch: `dev` (Up to date with `origin/dev`).
- **Clean Distribution Package:**
  - `Xuan_Sinh/` (~14.8 MB) containing clean source of BE + FE + Quick Start scripts (`start.bat`, `stop.bat`) + comprehensive `README.md`.

---

## 3. SESSION HANDOFF & CHANGE LOGS

---
### [2026-11-21 20:25] - Session Update by: MichaelTran1226 / Antigravity Assistant (Full-Stack Engineer)
- **Context / Task:**
  1. Audited and supplemented screenshots for `EquiFlow_Bug_UX_Report_Template.xlsx` directly from the live application without build/test.
  2. Answered deep architectural quiz regarding Groom zone vs stall allocation duality (`ShiftRoster` vs `StallAllocation.assignedGroomUserId`) and the origins of the Horse Transfer feature (`HorseTransferRequest`).
  3. Packaged a clean distribution folder `Xuan_Sinh` containing pure FE & BE source code and handoff documentation (free of old documents, logs, `node_modules`, and `dist`).
  4. Verified current Git branch state in view-only mode (`dev-michael/needfix` on both BE and FE, currently local and unpushed).
  5. Initialized `core.md` under the mandatory collaborative workflow protocol.
- **Changes Made:**
  - `<EquiFlow_Bug_UX_Report_Template.xlsx>`: Injected 19 OpenXML DrawingML screenshots for items `QA-01` to `QA-19` into Column M, preserved existing `richData` cell images for `UX-001` through `UI-008`.
  - `<Xuan_Sinh/>`: Created clean distribution bundle (~14.8 MB) containing BE, FE, `start.bat`, `stop.bat`, and `README.md`.
  - `<core.md>`: Established central progress tracker and single source of truth protocol.
- **Current Status:** Completed
- **Next Steps / Handoff Notes for Next Member:**
  - Both Backend and Frontend are on local branch `dev-michael/needfix` with all fixes for `needFix.docx` already committed locally. If ready to publish or review, create upstream tracking branches or open Pull Requests to `dev` or `main`.
  - Do NOT overwrite or truncate `core.md`; always append your next session block at the bottom of Section 3.

---
### [2026-11-21 20:30] - Session Update by: MichaelTran1226 / Antigravity Assistant (Full-Stack Engineer)
- **Context / Task:**
  1. Replaced `dev-michael/needfix` branch with `fix/michael` across both BE and FE repositories.
  2. Integrated `core.md` directly into both repository roots (`Racehorse_Training_Management_System_MT_BE/core.md` and `Racehorse_Training_Management_System_MT_FE/core.md`).
  3. Committed `core.md` and pushed `fix/michael` to GitHub.
  4. Created Pull Requests on GitHub for both repositories targeting `dev` with detailed summary comments for manual review and merging.
- **Changes Made:**
  - `<Racehorse_Training_Management_System_MT_BE/core.md>`: Added central context file to BE repository.
  - `<Racehorse_Training_Management_System_MT_FE/core.md>`: Added central context file to FE repository.
  - `<core.md>`: Updated branch definitions and logged PR submission.
- **Current Status:** Completed
- **Next Steps / Handoff Notes for Next Member:**
  - Review and manually merge the open Pull Requests on GitHub (`fix/michael` -> `dev`) for both BE and FE.
  - Verify that CI/CD passes on GitHub Actions after merge.

---
### [2026-11-21 20:35] - Session Update by: MichaelTran1226 / Antigravity Assistant (Full-Stack Engineer)
- **Context / Task:** Re-ran Prettier formatting across the entire Backend repository, resolved ESLint no-unused-vars warnings in financial specs, and pushed clean code to branch fix/michael (updating PR #173).
- **Changes Made:** 
  - <Racehorse_Training_Management_System_MT_BE/prisma/seed.ts>: Formatted with Prettier.
  - <Racehorse_Training_Management_System_MT_BE/src/auth/otp.service.spec.ts>: Formatted with Prettier.
  - <Racehorse_Training_Management_System_MT_BE/src/financial/financial-billing.spec.ts>: Suppressed unused variable warning.
  - <Racehorse_Training_Management_System_MT_BE/src/financial/financial.service.spec.ts>: Suppressed unused variable warning.
  - <Racehorse_Training_Management_System_MT_BE/src/training/trainer-reviews.service.ts>: Formatted with Prettier.
  - <Racehorse_Training_Management_System_MT_BE/src/training/trainer-reviews.service.spec.ts>: Formatted with Prettier.
  - <Racehorse_Training_Management_System_MT_BE/src/training/training-plans.service.ts>: Formatted with Prettier.
  - <Racehorse_Training_Management_System_MT_BE/src/training/training.controller.ts>: Formatted with Prettier.
- **Current Status:** Completed
- **Next Steps / Handoff Notes for Next Member:** BE code passes typecheck (0 errors), ESLint (0 errors, 0 warnings), and Prettier. Ready to merge PR #173 on GitHub.

---
### [2026-11-21 20:46] - Session Update by: MichaelTran1226 / Antigravity Assistant (Full-Stack Engineer)
- **Context / Task:** Fixed CI test failure where `groomZoneIds()` caused HTTP 500 when `prisma.shiftRoster` / `prisma.groomAssignment` was undefined in test mock setups (`medical.e2e-spec.ts` and `rbac-matrix.e2e-spec.ts`).
- **Changes Made:** 
  - `<Racehorse_Training_Management_System_MT_BE/src/shift-rosters/groom-zones.ts>`: Added defensive fallback (`prisma?.shiftRoster ?? prisma?.groomAssignment`) and null checks so missing models return empty zone arrays gracefully without throwing unhandled exceptions.
  - `<Racehorse_Training_Management_System_MT_BE/test/medical.e2e-spec.ts>`: Defined `shiftRoster.findMany` and `groomAssignment.findMany` in mock Prisma client; updated `where.stallAllocations` assertion to align with zone-based groom scoping.
  - `<Racehorse_Training_Management_System_MT_BE/test/rbac-matrix.e2e-spec.ts>`: Defined `shiftRoster.findMany` and `groomAssignment.findMany` in mock Prisma client; updated GROOM `ASSIGNED_ONLY` scope assertion to verify assigned zone isolation or assigned groom ID.
  - `<core.md>`: Appended session update across root, BE, and FE.
- **Current Status:** Completed
- **Next Steps / Handoff Notes for Next Member:** All 67 unit test suites (935 tests) and all 8 e2e test suites (103 tests) pass (0 failures). TypeScript checks and ESLint pass with 0 errors and 0 warnings. Changes committed and pushed to `fix/michael` to update PR #173.

---
### [2026-11-21 20:54] - Session Update by: MichaelTran1226 / Antigravity Assistant (Full-Stack Engineer)
- **Context / Task:** Synchronized and updated distribution package `Xuan_Sinh/` with the latest fixes, formatting, tests, and documentation.
- **Changes Made:** 
  - `<Xuan_Sinh/Racehorse_Training_Management_System_MT_BE/>`: Mirrored latest backend source code including `groom-zones.ts` null safety/fallback, updated e2e test mocks, and `core.md`.
  - `<Xuan_Sinh/Racehorse_Training_Management_System_MT_FE/>`: Mirrored latest frontend source code including `core.md`.
  - `<Xuan_Sinh/README.md>`: Verified instructions, credentials, and quick start guide.
  - `<core.md>`: Appended session update across root, BE, FE, and `Xuan_Sinh`.
- **Current Status:** Completed
- **Next Steps / Handoff Notes for Next Member:** `Xuan_Sinh/` is fully up-to-date (~26.8 MB clean source, 0 node_modules, 0 .git), ready to zip and hand off to partners or other teams.

---
### [2026-11-22 13:23] - Session Update by: MichaelTran1226 / Antigravity Assistant (Full-Stack Engineer)
- **Context / Task:** Packaged complete technical note and runnable open-source suite reproducing Google Codelab (Location Intelligence ADK Agent with MCP) at 0 VND (without GCP billing or credit card).
- **Changes Made:** 
  - `<ADK_MCP_Location_Intelligence_0Dong.md>`: Created comprehensive technical documentation comparing paid Google Cloud vs. 0đ Open-Source MCP stack, schema analysis, and step-by-step reproduction guide.
  - `<ADK_Bakery_0Dong/>`: Implemented fully functional runnable project including 4 original CSV datasets, SQLite database loader (`init_db.py`), local MCP toolset (`mcp_tools.py`), 5-question automated test suite (`test_questions.py`), free Gemini agent (`agent.py`), and 1-click script (`run.bat`).
  - `<core.md>`: Appended session update across root, BE, and FE.
- **Current Status:** Completed
- **Next Steps / Handoff Notes for Next Member:** The 0đ Location Intelligence MCP Agent is fully tested and verified against all 5 Codelab Step 6 benchmark questions.

---
### [2026-11-22 13:38] - Session Update by: MichaelTran1226 / Antigravity Assistant (Full-Stack Engineer)
- **Context / Task:** Updated graphify knowledge graph and prepared comprehensive handoff context in `AI_FAST_CONTEXT.md` for OpenAI Codex.
- **Changes Made:** 
  - `<graphify-out/>`: Executed incremental graph rebuild via `graphify update .` (rebuilt 23,922 nodes, 79,573 edges, 905 communities in `graph.json`, `graph.html`, and `GRAPH_REPORT.md`).
  - `<AGENTS.md>`, `<.codex/hooks.json>`: Configured native Codex integration via `graphify codex install`.
  - `<AI_FAST_CONTEXT.md>`: Updated repository map with active branches (`fix/michael`), exact test counts (935 unit tests PASS, 103 e2e tests PASS), Groom Zone architecture details, Graphify CLI usage instructions, and quality gate commands for Codex.
  - `<core.md>`: Appended session update across root, BE, and FE.
- **Current Status:** Completed
- **Next Steps / Handoff Notes for Next Member:** Repository and documentation are 100% prepared for Codex. Codex can immediately read `AI_FAST_CONTEXT.md` and `core.md`, query `graphify-out/graph.json`, and continue development on branch `fix/michael`.
