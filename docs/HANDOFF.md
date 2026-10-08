# LUT Pal developer handoff

Updated 2026-10-07. This is a Mac-first, single-user local web project with an MIT
licence. Keep the existing viewer as the base experience; do not redesign it.

## Current delivery

The app is now **LUT Pal**, with the owner-supplied corner wordmark and favicon.
The launcher is `Start LUT Pal.command`; the source ZIP uses `LUT-Pal`. Existing
library paths, project identifiers and writer locks remain compatible.

Optional [inspection tools](INSPECTION.md) add expandable RGB-aware histograms,
clipping overlays, waveform, RGB parade, a Rec.709 vectorscope/skin hue guide,
Wipe/Side by side comparison, original-resolution 100% zoom/pan, full-resolution
adjusted 16-bit PNGs and a separate adjusted 33-point CUBE. The scopes measure
preview signals; the CUBE is an approximation. Normal browsing does not invoke
the new full-resolution worker. Preserve this boundary.

Local synthetic/browser checks cover these tools, independent colour swatches,
actual downloads, narrow-screen layout and cancellation during inspection.
The automated suite has 93 tests. Recheck the exact runtime/commit before claims.

The current source adds a subtle orange-black abbreviation band to converted
LUT thumbnails and a **Converted from** source LUT/profile readout below the
viewer. The existing copy indicator remains. Original LUT styling and files are
unchanged. Comparison mode describes the LUT actually being displayed; narrow
screens retain a single-line readout with full provenance available on hover.

All scenes now supports **Select → Remove from project**, including bulk removal
and Select all. Search and device filters limit Select all to the displayed
results. Project removal hides scenes from every collection without deleting
clips or saved assets; one persistent Undo restores the entire selection. The
picker reopens after removal with Undo available, including after clearing the
whole project. Removed scenes retain their adjustments across browser reloads
so Undo restores those settings too. Collection removal still changes only that
membership.

New, unordered footage appears first in All scenes, newest first. Existing
ordering within the footage/demo groups and collection orders remain intact.
All scenes always keeps demos below footage, even if older saved orders mix them. The selected preview is requested
before background thumbnails. Demo flags also cover imported Apple Log sample
clips. Existing thumbnails stay visible until the next row is ready, then swap
together. Only empty tiles have initial placeholders; no progress counter
is added beneath the rail. A delayed overlay appears only while entering a scene,
never while switching looks within it. Saved previews bypass the background
generation queue, so a ready look cannot be held up by an uncached one.
An open tab keeps its own scene/look during shared preference refreshes and
save conflicts. Shared refreshes render without writing preferences back, so
a tab with an older scene manifest cannot reset another tab to its old scene.
Favourites and adjustments still synchronize. Reload older viewer tabs to load
this fix; server restart alone cannot replace their already loaded JavaScript.

The coffee popover links to the owner's `https://ellisedwards.com/donate` page.
On 2026-10-07 that destination returned HTTP 404; configuring the link does not
establish that the external donation page is live.

The published source release is still **v0.2.1**. Later commits on `main` are
not automatically a new release. Check the exact commit's GitHub Checks run,
not a previous green run, before describing a build as verified.

## Start a continuation

1. Read any applicable `AGENTS.md` first. Check the checkout, branch, working
   changes, remote and latest commit before editing.
2. Read `README.md` and [supported-media boundaries](SUPPORTED-MEDIA.md).
   For local personal state, consult the owner's separate local handoff.
   Personal clips, LUTs, databases and evidence do not belong in Git.
3. If a service already runs, inspect `/api/health` and its library root before
   starting another copy. One service owns each library. Do not remove its
   writer lock or edit its database behind the service.
4. Verify the specific requested workflow in the browser. Use a disposable
   library for destructive, cancellation, project-import and fault checks.
5. Run `npm test` and `npm run build:source` before another source delivery.
   Follow [release instructions](RELEASING.md) for a tagged release.

## Relevant code

| Area | Files |
| --- | --- |
| Viewer, metadata strip and converted provenance | `ui/explorer-overlay.js`, `ui/viewer.css` |
| Collections, device filtering, selection and drag ordering | `ui/scene-picker.js` |
| Clip import, frame marking and Library | `ui/library.js`, `src/media.cjs`, `src/local-files.cjs` |
| Recorded camera/profile evidence | `src/camera.cjs`, `src/quicktime-log.cjs` |
| Published curves/gamuts and 33-point conversion | `src/camera-transforms.cjs`, `src/look-adapter.cjs`, `ui/porting.js` |
| AI transport and editable proposals | `src/ai-cli.cjs`, `ui/ai.js`, `ui/batch-review.js` |
| Persistence, recovery and portable projects | `src/store.cjs`, `src/history.cjs`, `src/project-files.cjs` |
| Server, build identity and source-release allowlist | `src/server.cjs`, `src/runtime.cjs`, `scripts/source-files.cjs` |

## Decisions to preserve

- A device can shoot several recording profiles. Device identity and recording
  profile are separate; codec/model names do not establish LUT compatibility.
- Apple Log and Apple Log 2 are distinct. Original-track identifiers establish
  the recorded profile where available. Missing/conflicting proof stays unknown.
- Converted looks are linked 33-point standard, non-RAW copies. AI suggests
  details from previews; published numerical colour transforms do the conversion.
  Reuse the original look for further conversions rather than repeatedly baking.
- A scene can belong to multiple collections. Filtering and collection removal
  do not delete the original scene or silently change its other memberships.
- Imports and scene captures automatically draft details when an AI tool is
  connected. Drafts stay editable until explicitly saved. Camera metadata and
  colour math are not inferred from AI suggestions.
- Favourite counts reflect compatible variants for the current scene. Preserve
  project favourites across browsers and scene/device changes.

## Remaining limits and next decisions

- Another-computer testing is deliberately deferred. Do not silently treat it
  as a completed acceptance gate or restart it without a request.
- Broad real camera/codec coverage and performance on long clips still need
  evidence. The profile catalogue is not an automatic-detection claim for every
  camera. Native picker selection was injected in prior automated browser proof;
  actual interactive picker selection remains separately unverified.
- Physical Sony/iPhone matching needs paired footage. Profile adaptation is
  useful, but sensor/exposure/white-balance equivalence is **[Unverified]**.
- Unknown profiles, unsupported RAW/D-Log M variants and arbitrary HDR display
  conversion remain outside the supported conversion workflow.
- The donation URL is configured; the owner still needs to publish that page
  and verify its payment workflow.
- Distribution is source-only. Do not bundle the current downloaded nonfree
  FFmpeg binary. A future installer needs its own licensing/distribution review.
- Any further release needs a fresh tagged source ZIP and exact-commit CI.
  Personal assets and local evidence remain separate from public source.

The next agent should validate current state, then follow the owner's next
specific request rather than inventing a larger product or redesign.
