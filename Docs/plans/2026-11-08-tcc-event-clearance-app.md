# TCC Event Clearance App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first, installable Progressive Web App (PWA) with offline-first ECDSA cryptographic QR check-in, dynamic activity card templating, on-device face verification, and a comprehensive web dashboard for Tagoloan Community College (TCC).

**Architecture:** The client is an offline-first React PWA storing keys and data locally in IndexedDB (Dexie). Rotating student QR tokens and scanner stamps are verified client-side using WebCrypto ECDSA P-256 key pairs without internet connectivity. The user interface strictly follows a minimalist utilitarian black-and-white editorial aesthetic and core HCI principles (Fitts's Law, Hick's Law, Nielsen's Status Visibility, WCAG AAA high-contrast sunlight readability). A Supabase backend provides Google OAuth, PostgreSQL with Row-Level Security (RLS) across 19 tables, and edge functions for batch sync and AI artwork generation.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, `@mediapipe/tasks-vision`, WebCrypto API (ECDSA P-256 + SHA-256), Dexie.js, `@zxing/library`, `qrcode`, `signature_pad`, `html-to-image`, `jspdf`, `exceljs`, Supabase.

---

### Phase 0: Project Scaffolding & Cryptographic Validation Spikes

#### Task 1: Repository & Toolchain Initialization
**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

**Step 1: Write configuration and bootstrap files**
Setup Vite with React, TypeScript, Tailwind CSS, Lucide icons, and path aliases.

**Step 2: Install dependencies**
Run: `npm install`
Expected: Clean package installation with zero conflicts.

**Step 3: Verify build and test runner**
Run: `npm run build`
Expected: `dist/` built successfully.

**Step 4: Commit**
Run: `git init && git add . && git commit -m "chore: scaffold project structure with React, Vite, TS, and Tailwind"`

---

#### Task 2: WebCrypto ECDSA P-256 Key Pair & Token Verification Spike (AC6, AC10)
**Files:**
- Create: `src/lib/crypto/webcrypto.ts`
- Create: `src/lib/crypto/tokens.ts`
- Create: `src/types/crypto.ts`
- Create: `tests/crypto.test.ts`

**Step 1: Write the failing unit tests for ECDSA key generation, token signing, and 30-second window verification**
```typescript
// Test that token signed by student private key verifies with public key
// Test that time window > 30s + tolerance fails
// Test that invalid payload or forged signature fails
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/crypto.test.ts`
Expected: FAIL (modules not implemented).

**Step 3: Implement WebCrypto ECDSA P-256 helper & token generator/verifier**
- `generateStudentKeyPair()`: creates non-extractable `CryptoKey` pair (P-256).
- `signAttendanceToken(payload, privateKey)`: compact ~100-byte payload with base64url encoding.
- `verifyAttendanceToken(tokenString, publicKey, currentTime)`: validates time window drift (±1 window tolerance), signature, and format version.

**Step 4: Run test to verify it passes**
Run: `npx vitest run tests/crypto.test.ts`
Expected: PASS all tests.

**Step 5: Commit**
Run: `git add src/lib/crypto tests/crypto.test.ts && git commit -m "feat(crypto): implement WebCrypto ECDSA P-256 token signing and offline verification"`

---

#### Task 3: PWA Standalone Detection & Install Gate Prototype (AC9)
**Files:**
- Create: `src/components/common/InstallGate.tsx`
- Create: `src/lib/utils/pwa.ts`
- Modify: `src/App.tsx`

**Step 1: Write utility to detect standalone mode, iOS Safari, and Android in-app browsers**
- Detect `display-mode: standalone` and `navigator.standalone`.
- Detect Messenger/Facebook in-app browser user agent and show "Open in Safari or Chrome".
- Android: intercept `beforeinstallprompt` and bind to "Install to Continue".
- iOS: display step-by-step visual instruction ("Tap Share -> Add to Home Screen").

**Step 2: Manual / component test**
Verify desktop bypasses install gate; mobile browsers display respective install prompts until standalone mode is active.

**Step 3: Commit**
Run: `git add src/components/common/InstallGate.tsx src/lib/utils/pwa.ts && git commit -m "feat(pwa): add standalone install gate and browser detection"`

---

### Phase 1: Accounts, Device Binding & Face Verification

#### Task 4: Local Database Schema with Dexie.js (Offline Storage)
**Files:**
- Create: `src/lib/db/dexie.ts`
- Create: `src/types/database.ts`

**Step 1: Define client Dexie database**
- Stores: `keys` (crypto keys & public keys), `profile` (student/officer session), `events` (event packs), `roster` (department students with public keys and thumbnails), `scanQueue` (unsynced scans with UUID), `attendance` (synced and cached attendance records).

**Step 2: Commit**
Run: `git add src/lib/db/ src/types/ && git commit -m "feat(db): setup Dexie IndexedDB schemas for offline storage"`

---

#### Task 5: Live Camera Photo Capture with MediaPipe Face Check (AC1)
**Files:**
- Create: `src/components/camera/LivePhotoCapture.tsx`
- Create: `src/lib/camera/faceDetector.ts`

**Step 1: Implement MediaPipe Face Detector integration**
- Front camera stream only (no file input or gallery picker).
- Oval guide overlay on camera preview.
- Frame check: exactly 1 centered face, brightness and sharpness threshold.
- Capture outputs: 480px JPEG (~40 KB) and 160px thumbnail (~12 KB).

**Step 2: Verify on test devices**
Ensure multiple faces, no faces, or off-center poses trigger actionable guidance ("Make sure your face is clearly visible").

**Step 3: Commit**
Run: `git add src/components/camera/ src/lib/camera/ && git commit -m "feat(camera): add live front-camera photo capture with on-device MediaPipe face check"`

---

#### Task 6: Student Registration, Profile & Device Key Binding Flow (AC4, AC5)
**Files:**
- Create: `src/components/student/RegistrationForm.tsx`
- Create: `src/components/student/WaitingApprovalView.tsx`
- Create: `src/components/student/ConsentModal.tsx`
- Create: `src/services/authService.ts`

**Step 1: Build registration workflow**
- Google sign-in integration (Supabase Auth).
- RA 10173 (Data Privacy Act) consent agreement.
- School ID, Full Name, Department (CBA, CIT, CED, CCJPS, CHM, CAS, COM, CLIS), Year Level, Section.
- Generation of non-extractable device key pair; sending public key + registration payload.
- State: "Waiting for approval from the [Department] SBO".

**Step 2: Commit**
Run: `git add src/components/student/ src/services/ && git commit -m "feat(student): implement registration, consent, and device key binding"`

---

#### Task 7: SBO Officer Approval & Device Reset Management (AC3, AC5)
**Files:**
- Create: `src/components/officer/PendingApprovalsView.tsx`
- Create: `src/components/officer/DeviceResetRequestsView.tsx`

**Step 1: Build officer approval views**
- Department SBO sees queue of pending students for their department.
- Photo comparison card with Accept / Reject (with required rejection reason).
- Device reset review: inspect original photo vs new photo with one-click re-binding or rejection.

**Step 2: Commit**
Run: `git add src/components/officer/ && git commit -m "feat(officer): add department registration and device reset approval views"`

---

### Phase 2: Event Builder & Card Template Engine

#### Task 8: Digital Signature Pad for Officers
**Files:**
- Create: `src/components/officer/SignaturePadView.tsx`
- Create: `src/lib/signature/signatureCanvas.ts`

**Step 1: Build full-screen signature capture**
- Full white screen using `signature_pad`.
- Vector stroke capture, export to transparent PNG/SVG.
- Save to officer's local Dexie store and sync to Supabase storage.

**Step 2: Commit**
Run: `git add src/components/officer/SignaturePadView.tsx src/lib/signature/ && git commit -m "feat(officer): add full-screen signature capture pad"`

---

#### Task 9: Event Builder & Multi-Venue Configurator
**Files:**
- Create: `src/components/officer/EventBuilderView.tsx`
- Create: `src/types/event.ts`

**Step 1: Implement event setup flow**
- General info: Name, School Year, Target Departments.
- Days & Slots: Multi-day config (e.g. Day 1–5), multi-slot per day (Morning In/Out, Afternoon In/Out).
- Assign signer name and official position per slot.
- Venues & Geofencing: Venue name, Latitude/Longitude pin, Radius (meters), Location Check mode (Off / Flag Only / Block).
- Instructor Approval entry ("Approved by", Date). Head Officer publish action.

**Step 2: Commit**
Run: `git add src/components/officer/EventBuilderView.tsx src/types/event.ts && git commit -m "feat(event): implement multi-day, multi-slot event builder with venue geofencing"`

---

#### Task 10: Dynamic Card Template Engine & CIT Intramurals 2026 Preset
**Files:**
- Create: `src/components/card/ActivityCardRenderer.tsx`
- Create: `src/lib/templates/layoutEngine.ts`
- Create: `src/lib/templates/citIntramurals2026.ts`
- Create: `src/types/template.ts`

**Step 1: Implement `layout_json` renderer**
- Supports: Text elements, student fields (Name, Year & Section, School ID), school logos, watermark art, day strip banners, signature slot boxes with signer designation, and card QR.
- Includes default CIT Intramurals 2026 preset (5 days, 4 slots/day, 20 signature boxes, mascot watermark).

**Step 2: Commit**
Run: `git add src/components/card/ src/lib/templates/ src/types/template.ts && git commit -m "feat(card): build dynamic layout_json card renderer and CIT Intramurals preset"`

---

### Phase 3: Offline Scanner & Attendance Check-in

#### Task 11: Department Roster & Event Pack Pre-Download Engine
**Files:**
- Create: `src/services/packDownloadService.ts`
- Create: `src/components/officer/ScannerPrepView.tsx`

**Step 1: Build offline event pack & roster downloader**
- Downloads event metadata, venues, officer signing public keys.
- Downloads department student roster: Student ID, Name, Section, Public Key, 160px thumbnail.
- Computes SHA-256 checksum to ensure pack integrity; displays green "Ready for Offline" badge.

**Step 2: Commit**
Run: `git add src/services/packDownloadService.ts src/components/officer/ScannerPrepView.tsx && git commit -m "feat(roster): add offline roster pack download and integrity verification"`

---

#### Task 12: Rotating Student QR Code Screen (AC6)
**Files:**
- Create: `src/components/student/StudentQRView.tsx`

**Step 1: Implement student dynamic QR display**
- Generates new signed token every 30 seconds with animated countdown ring.
- Gathers optional geolocation coordinates if required by event.
- High-contrast display with student name, department, and event header.

**Step 2: Commit**
Run: `git add src/components/student/StudentQRView.tsx && git commit -m "feat(student): build rotating 30s signed QR display"`

---

#### Task 13: Offline Scanner Interface (Sunlight-Optimized, One-Handed) (AC2, AC7, AC8)
**Files:**
- Create: `src/components/scanner/QRScannerView.tsx`
- Create: `src/components/scanner/ScanResultCard.tsx`
- Create: `src/components/scanner/ManualCheckInModal.tsx`

**Step 1: Build rapid scanner UI**
- Prominent persistent top banner: "Scanning at: [Venue] · [Day N Slot Name]" (tap to change).
- Camera viewfinder using `@zxing/library` or `jsqr`.
- Result card: Large student photo (≥40% width), full name, section, department.
- Status logic:
  - **Green (Accepted)**: Verified signature, valid window, correct department. Auto-commits after 1.5s (with short vibration) unless SBO taps Reject.
  - **Amber (Flagged)**: Location mismatch, already checked in, clock offset, or wrong department. SBO must tap Accept or Reject with reason chip.
  - **Red (Invalid)**: Expired token or forged signature.
- Manual check-in fallback: search roster by school ID or name, flag record as manual check-in.

**Step 2: Commit**
Run: `git add src/components/scanner/ && git commit -m "feat(scanner): implement sunlight-readable offline QR scanner with auto-commit and manual check-in"`

---

#### Task 14: Local Scan Queue & Sync Engine (AC11)
**Files:**
- Create: `src/services/syncService.ts`
- Create: `src/components/scanner/SyncStatusModal.tsx`

**Step 1: Build robust sync queue**
- Every scan generates client UUID, officer ECDSA signature over record, serial number.
- Stored immediately in Dexie `scanQueue`.
- Scanner shows persistent counter: "X scans waiting to sync".
- Online sync handler: batches 500 records per upload; idempotent deduplication.
- "Export backup" feature: downloads unsynced queue as encrypted/signed JSON file if offline for days.

**Step 2: Commit**
Run: `git add src/services/syncService.ts src/components/scanner/SyncStatusModal.tsx && git commit -m "feat(sync): add offline scan queue, batch sync, and emergency file export"`

---

### Phase 4: Activity Card Stamps & Verification

#### Task 15: Cryptographic Card Stamp Engine & Receipt QR (AC10)
**Files:**
- Create: `src/components/card/DigitalCardView.tsx`
- Create: `src/components/scanner/ReceiptQRModal.tsx`
- Create: `src/services/stampService.ts`

**Step 1: Implement stamp rendering and receipt QR handshake**
- Digital activity card loads slot attendance records.
- Completed slots display officer's stored signature image, printed officer title, timestamp, and unique serial number.
- Optional Receipt-QR handshake: after scanner accepts, scanner displays Receipt QR; student scans to receive signed stamp instantly offline without waiting for server sync.

**Step 2: Commit**
Run: `git add src/components/card/DigitalCardView.tsx src/components/scanner/ReceiptQRModal.tsx src/services/stampService.ts && git commit -m "feat(card): build cryptographic stamp renderer and instant receipt-QR handshake"`

---

#### Task 16: SBO "Check Card" Screen & Card Verification (AC10)
**Files:**
- Create: `src/components/officer/CheckCardView.tsx`

**Step 1: Build official clearance validation screen**
- Officer scans student's card QR or searches School ID.
- Displays full schedule matrix: green check for verified server/local record, bold red for missing slots.
- Forged cards (AI modified or photo-shopped) fail because lookup checks actual cryptographic database records, not image pixels.

**Step 2: Commit**
Run: `git add src/components/officer/CheckCardView.tsx && git commit -m "feat(officer): implement SBO Check Card record verification view"`

---

#### Task 17: Card Export to High-Res Image & PDF
**Files:**
- Create: `src/services/cardExportService.ts`

**Step 1: Export logic using `html-to-image` and `jspdf`**
- Export card to PNG or PDF formatted for standard paper sizes (Short Bond, A4, A5).
- Print stylesheet optimization for desktop officer dashboard printing.

**Step 2: Commit**
Run: `git add src/services/cardExportService.ts && git commit -m "feat(export): add activity card image and printable PDF export"`

---

### Phase 5: Web Dashboard & Reporting

#### Task 18: Officer Web Dashboard & Master Attendance Grid
**Files:**
- Create: `src/components/dashboard/AttendanceDashboardView.tsx`
- Create: `src/components/dashboard/AttendanceFilters.tsx`
- Create: `src/components/dashboard/DisputeResolutionModal.tsx`

**Step 1: Build dashboard table**
- Attendance grouped by department, year level, and section.
- Columns for Day 1–5 (Morning In/Out, Afternoon In/Out).
- Multi-filters: Event, Day, Slot, Department, Section, Venue, Check-in Method (QR vs Manual).
- Record editing: dispute resolution or voiding duplicate; all changes write to append-only `audit_logs`.

**Step 2: Commit**
Run: `git add src/components/dashboard/ && git commit -m "feat(dashboard): build officer attendance grid, filtering, and dispute management"`

---

#### Task 19: Excel Export (ExcelJS) & Print Sheets
**Files:**
- Create: `src/services/excelExportService.ts`

**Step 1: Build multi-sheet formatted Excel workbook**
- One worksheet per department.
- Grouped by Year Level and Section.
- Formatted headers, student metadata, timestamps, and signature status per slot.

**Step 2: Commit**
Run: `git add src/services/excelExportService.ts && git commit -m "feat(report): implement ExcelJS department workbook export and print layouts"`

---

### Phase 6: AI Artwork Generation & Polish

#### Task 20: AI Background Generation & Asset Optimization
**Files:**
- Create: `supabase/functions/generate-artwork/index.ts`
- Create: `src/components/officer/ArtworkPickerModal.tsx`

**Step 1: Implement AI artwork Edge Function**
- Accepts theme prompt and event details.
- Guarantees prompt enforcement (zero text generated on image; pure thematic background art).
- Generates 3–4 candidates, enforces max 5 regenerations per event.
- Compresses chosen image to WebP (≤150 KB) for fast offline roster download.

**Step 2: Commit**
Run: `git add supabase/functions/generate-artwork/ src/components/officer/ArtworkPickerModal.tsx && git commit -m "feat(ai): integrate AI artwork generator Edge Function with quota limits"`

---

### Phase Handoff & Execution Strategy

Plan complete and saved to `docs/plans/2026-11-08-tcc-event-clearance-app.md`. Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagents per task, review between tasks, and maintain fast, verifiable progress.
2. **Parallel Session (separate)** - Open a new session with executing-plans, batch execution with checkpoints.

