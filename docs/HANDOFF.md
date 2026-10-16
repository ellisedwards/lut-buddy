# LUT Library developer handoff

Updated 2026-10-16. This is a Mac-first, single-user local web project with an MIT
licence. Keep the existing viewer as the base experience; do not redesign it.

## Current delivery

[Shoot review and motion](SHOOT-MOTION.md) adds an in-viewer split layout, explicit
look-family assignment, creative-only saved styles with approved examples, and
reference/CUBE/recipe handoff ZIPs. Shot exposure, balance and bypass are kept.
Assignments and styles participate in existing persistent Undo. Schema 8 adds
styles, backing up older databases before migration. Project archives remain
backward-compatible with the existing version 1 format.

The old Shoot-view modal is replaced by panes inside the established viewer.
Use + to add, a frame name to replace, expand/double-click to focus and Escape to
return. Pane removal and keep-only change only the view and have in-session Undo.
Browser-local layout, link state and per-pane looks persist per project, outside
archives. Pane identity is separate from scene identity: copies share saved
media and never create duplicate library scenes. Three frames use a 2 x 2 layout
with the fourth slot empty. Frames touch and extend underneath both viewer
toolbars and the LUT strip; pane controls overlay images on hover or focus.
The duplicate icon copies a scene into a new pane without opening the picker.
Copies start with the same look and automatically unlink. The chain icon switches
between one look across the group and a separate look per pane. Linking adopts
the active pane's look; unlinking preserves the displayed looks. Compare affects
the linked group or only the active pane when unlinked. Exposure and balance
remain scene-based, including across copies; scopes follow the active pane.
The compact viewer menu retains explicit look assignment, styles and
handoff. Unlinked assignment saves only the active scene; linked assignment
saves the shared look to distinct scenes. Export supports separate looks on
multiple copies of the same scene. Preserve that distinction between previewing
and saving a look.

Space or Play uses a saved six-second maximum silent H.264 companion; Shift +
Space plays all visible scenes. Copies of a scene share a decoder/playback clock
and render their own LUTs. Other scenes loop independently. There is no visible
scrub strip in the main viewer. Playback stays armed across scenes without
companions, so returning to an available companion resumes it. Escape
restores the pinned still. The same GPU look math renders stills and video.
Scopes sample the current moving source/output together. Moving companions live
under frames, survive disconnected originals and travel with projects/backups.
The v2 encoder uses up to 1920-wide H.264, CRF 14, maxrate 10M, 24 fps and
12 MiB/six-second bounds. It is still 8-bit yuv420p; higher bitrate is not a
10-bit precision guarantee. Old companion assets are retained for history.
Full-resolution captures still decode the original. New captures from motion
inherit their parent shot's corrections and the displayed look. Normal still
navigation does not prepare motion or start full-resolution processing.


The Reference look selector is in **Library → LUTs**; the main Compare button
and **V** shortcut toggle reference comparison; **Space** now plays/pauses motion. The floating Selected LUT badge is
removed. Searches/dropdowns inherit their surrounding surface in both themes, and
light-mode thumbnail captions use white bands (slightly warm for converted copies). Scene,
scope titles and active filters use weight 700; buttons and other labels use 500.

The scene picker adds a **+** beside its list heading for linked clip intake,
with the selection icon beside it. Adding from a collection preselects that
collection in the frame-saving dialog. Coffee precedes the theme icon. The compact histogram keeps
its inline **Orig. / Output** legend below the graph when both signals are available.
Other scopes and output-only histograms omit both keys while keeping the box size fixed; an expand icon reveals the
advanced controls. Previous/next arrows and **Shift + Left/Right** switch all five
scope types in both sizes. The shortcut opens a hidden panel; text fields and
modal dialogs retain their normal keyboard behavior.
Expanding preserves the selected type and translucent background. Each size keeps
a constant panel height when switching types. Measurement notes and counts are tooltips. If the original
signal is unavailable, the output still plots and a small warning identifies
the missing original rather than leaving a blank graph. Focus outlines are shown
for keyboard use and clear when mouse/touch input resumes; focus itself is retained.

New footage intake is **link-only** through the Mac native picker. The copying
clip/folder buttons and browser video inputs are removed, and the old video-upload
endpoint refuses requests before writing files. LUT uploads remain available.
Saved scene previews and full-resolution exports work after a linked source goes
missing. Existing video copies, backups and older project archives are preserved;
this change does not delete or migrate them. Library labels these as stored copies.

The app is now **LUT Library**, with the owner's original square colour icon
beside the name and as the favicon, restored at its previous 21.6px size.
The name uses white text in dark mode and dark
text in light mode. Light mode uses a white outer background and a
72% white glass layer for floating panels and viewer buttons. The light-mode LUT
bar uses a lighter 28% white fill with the same 22px glass blur. Theme changes
redraw the cached scope with the matching line colours, without reloading media.
The launcher is `Start LUT Library.command`; the source ZIP uses `LUT-Library`. Existing
library paths, project identifiers and writer locks remain compatible.

Optional [inspection tools](INSPECTION.md) add expandable RGB-aware histograms,
clipping overlays, waveform, RGB parade, a Rec.709 vectorscope/skin hue guide,
Wipe/Side by side comparison, original-resolution 100% zoom/pan, full-resolution
adjusted 16-bit PNGs and a separate adjusted 33-point CUBE. The scopes measure
preview signals; the CUBE is an approximation. Normal browsing does not invoke
the new full-resolution worker. Preserve this boundary.

Local synthetic/browser checks cover these tools, independent colour swatches,
actual downloads, narrow-screen layout and cancellation during inspection.
The automated suite passed 123 tests at implementation commit `8ead1b0` on
2026-10-16. Focused checks cover duplication, independent looks, link/unlink,
No LUT, Undo/reload/keep-only, shared video sources and per-pane export. These
checks do not establish visual acceptance or NLE colour agreement. Current
browser visual validation is blocked; see the continuation notes below.

Converted LUT thumbnails use a subtle orange-black abbreviation band in dark
mode and a warm white band in light mode. The **Converted from** readout below
the viewer names the source LUT/profile. The existing copy indicator remains.
LUT files are unchanged; caption styling follows the selected theme. Comparison mode describes the LUT actually being displayed; narrow
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
is added beneath the rail. A last-resort overlay appears only after a scene has remained unfinished for
1.5 seconds, never while switching looks within it. Recently viewed main previews
have a separate 64 MiB decoded-image budget so revisiting a scene does not depend
on retaining its entire LUT row. Visible thumbnails start after the main preview
(including adjustments) finishes; hidden non-favourites are loaded only when shown. Saved previews bypass the background
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
| Split panes and local comparison state | `ui/shoot.js`, `ui/split-state.js`, `ui/shoot.css`, `tests/split-intake.test.cjs`, `tests/split-view.test.cjs` |
| Active/peer motion and shared decoders | `ui/motion.js`, `src/motion.cjs`, `tests/motion-playback.test.cjs` |
| Saved styles and per-pane handoff ZIPs | `src/shoot.cjs`, `tests/shoot-motion.test.cjs` |
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

## Agreed next workflow and latest product discussion

The next build discussed with the owner is bulk linked intake with conservative
representative-frame selection. It has NOT been implemented.

- Choose clips from a folder; keep originals linked, never copy whole videos.
- Generate **one representative saved frame per clip by default**. A second or
  third requires a **very substantial, sustained visual difference**. Three is
  a hard automatic ceiling, not a target; one or occasionally two is expected.
- Ignore brief camera swings, passing objects, flashes and short transitions.
  The owner means visibly very different sections, not semantic scene naming
  or exhaustive edit/cut detection. Do not reinterpret this as a cut detector.
- Allow replacing an automatic choice, scrubbing to another frame, adding any
  number manually, and removing unwanted suggestions.
- Reuse saved stills, short motion companions, collections and the existing
  viewer. Avoid returning to the rejected separate Shoot-view modal.
- Validate suggestion quality and sustained-change thresholds on real footage;
  thresholds and detector accuracy are **[Unverified]**, not already decided.
- Cover cancellation, retries/reopening without duplicate scenes, unavailable
  originals, profile confirmation and mixed-profile LUT compatibility.

Current intake already accepts multiple clips via the native picker. It links
all selected files, then opens manual frame marking for the FIRST clip only.
`frameCandidates` returns evenly spaced samples, not scene/change detection.
There is no folder browser, bulk frame-generation pipeline or quick-preview mode.

The owner's latest thought is a **lightweight preview space for a folder of Log
footage**, optionally continuing into the full LUT Library workspace. Proposed
experience: browse without project setup or permanent library intake, see a
neutral display conversion, play/scrub/try LUTs, then keep selected scenes/looks
without repeating import. This is **product exploration, not a settled UI or an
implemented feature**. Resolve the browse-versus-save boundary with the owner
before turning this into a larger media-management application. A supported
recording profile must be established before claiming a neutral correct preview;
unknown profiles need confirmation, not a guessed transform. Do not hold the
first preview behind a whole-folder scan or pre-generate every LUT thumbnail.

The owner uses **Resolve Studio** and wants a native-feeling connection. A
one-shot round trip (select footage, explore here, send the chosen look back and
verify colour) is the proposed first integration experiment. No Resolve bridge
exists yet; API/version support, colour-managed pipeline handling, reproduction
and whether an embedded/docked interface is possible remain unverified. Ordinary
LUT browsing/hover previews/Selected LUTs comparison also exist in free Resolve;
Studio's workflow integration mechanism is a separate capability. Do not present
our comparison feature as unprecedented. Do not promise exact camera matching.

The owner explicitly said they were NOT asking for conversational AI. The
existing AI connection drafts editable names/descriptions/tags; published
numerical transforms perform camera-profile adaptation without AI. Do not
rebrand the conversion as AI-generated colour math.

## Browser validation restriction

A previous local-preview browser action was explicitly blocked by its URL
security policy. Do not bypass that decision with another browser, raw CDP,
Playwright from a shell, indirect execution or another route. Visual verification
of the newest pane/picker/duplicate controls remains outstanding. Code tests and
HTTP checks passed; those are not screenshots or human acceptance. Retry UI
verification only after the access/policy situation materially changes. The
owner accepted the earlier touching-frame layout via their own screenshot.

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
