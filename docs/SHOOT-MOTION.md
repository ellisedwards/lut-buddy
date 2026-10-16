# Split view, saved looks and moving scenes

Starting checkpoint: 7dd440276875dc0e394500ad4bea6a0cf7a5d9da, clean and pushed,
with exact-commit GitHub checks passing on 2026-10-14.

## Product boundary

LUT Library helps choose, check and remember a look. The editor builds the
finished film. The existing viewer, full-resolution stills, favourites and
per-shot adjustments remain the base experience. Motion is optional in the main
viewer and its split panes; no editing timeline, sound, cuts, transitions or titles.

## Moving scenes

Space or Play creates a silent companion once for an old scene whose original
is available, then loops it. It covers up to six seconds around the pin, clamped
to the source edges. New captures offer to save it alongside each still. Escape
returns to the pinned still. Space pauses/resumes the active frame. Shift+Space
plays/pauses all visible saved companions, each looping independently. Missing
companions remain still; they do not prevent other panes playing. Expanding a
frame releases hidden video decoders; returning recreates them when group
playback is enabled. Scopes follow the active frame only.

Saved companions survive disconnected sources and travel in project archives
and backups. New captures and first-time companion generation require the
original. No whole-video copy is made. Each companion is capped at 12 MiB,
1920 pixels wide and 24 fps; free disk space is checked. Version 2 uses H.264
CRF 14, medium preset and a 10 Mb/s rate target ceiling with a 20 Mb buffer.
Older companions refresh from available originals through prepareMotion.
They are saved assets,
so generated-cache clearing preserves them. Storage reports their bytes under
saved stills, motion and style examples. A whole-library motion quota and
separate companion removal control are not implemented in this version.

## Split view and styles

The split view replaces the old Shoot-view modal. The viewer's + opens the
existing scene picker in choose-only mode; collection/device browsing there does
not change the active scene. Add saved frames individually, click one to activate,
click its name to replace, and double-click or expand to focus. Escape or the
group icon returns without losing the group. Per-frame actions remove a pane or
keep only it, with a separate in-session view Undo. No saved media is removed.

Membership, active frame, focus and preview look family persist in this browser's
localStorage per project. They are not project data and do not travel in project
archives. Removed/unavailable scene IDs are pruned on reload. Duplicate additions
focus the existing pane. Geometry chooses columns to fit the viewer.

The existing stage, inspection surface, adjustments, scopes and motion remain
owned by the active frame. Other panes remain pinned stills until group playback
is requested. One shared auxiliary motion renderer processes the other visible
videos serially, copying results into their canvases; frame callbacks wait for
each render, avoiding an unbounded work queue. One auxiliary GPU renderer
supplies adjusted stills; full-detail snapshots have a 24 MiB cache budget. New
inactive-pane pictures swap together after rendering; new requests cancel stale
work and keep existing pictures visible while preparing replacements.

The LUT strip previews a linked family across cameras; Compare shows the
reference family (or original LOG) across the group. Apply is explicit in the
viewer menu. An incompatible scene blocks the whole assignment; it never silently
receives a mismatched LUT. Each shot keeps exposure, relative white balance and
bypass. Library Undo/Redo restores saved assignments and style edits; it is
separate from view Undo.

Save current style stores the displayed LUT, creative contrast/saturation and an
approved example. Applying it does not copy the example's source corrections.
Styles are reusable across projects. The compact menu also provides whole-frame
brightness/RGB differences for exactly two frames. Composition and lighting affect
these averages; it is not a skin-tone match, calibration check or quality score.

## Handoff

Export these frames produces full-resolution reference PNGs, per-shot adjusted
33-point CUBEs, a JSON recipe and instructions. Each CUBE includes source
corrections and the look; apply it once to the stated unadjusted input. Unknown
profiles get references/settings without a portable CUBE. Export uses a settings
snapshot and refuses changed settings/profiles rather than mixing approvals.
Editor reproduction remains **[Unverified]** until tested against those references.

## Evidence and limits

Automated checks cover timestamp bounds, compression/colour on a known patch,
byte-range playback, disconnected sources, capture refusal, capture inheritance,
project round trips, atomic/stale assignments, bypass preservation, Undo/Redo,
style references, handoff contents and cancellation cleanup. The full suite has
110 passing tests, including group pause/resume, active-only control, hidden
decoder release, focus changes, LUT/adjustment propagation and delayed starts.

On 2026-10-15, four 1920 × 1080 Sony companions with the selected LUT each
sustained about 24 rendered updates per second over a 46-second browser sample
on the current Mac. Pause-all, active-only pause, focus changes, expansion and
return, and a shared LUT change were also exercised. This does not establish
performance on other machines or larger groups.

Before the quality upgrade, in an isolated library with real footage, a six-second Sony preview measured
513,776 bytes (about 0.5 MB), at 1280 × 720 / 24 fps. At one paused pinned frame,
the rendered mean absolute RGB difference from the still was about 0.8%; about
0.9% of channel samples differed by more than 5%. That is one compressed sample,
not a calibration guarantee. Saved playback worked with a task-owned source link
removed. New full-resolution capture correctly refused while offline.

A real Apple Log 2 scene also played, including a live LUT change; its short
source produced a 1.9-second loop. Scene changes and Escape during preparation
returned to stills. Mixed Sony / Apple Log 2 look assignment, saved styles,
new still capture and a downloaded handoff ZIP were exercised in the browser.

These checks do not establish broad camera/codec performance, native NLE parity,
HDR display correctness or physical camera matching. Some older personal-library
source paths are unavailable; their saved stills remain usable but cannot gain
motion until the original is available. No private footage, LUTs or proof images
are bundled into the source package.

Split-view browser checks in a disposable real-footage library cover add, replace,
focus/return, keep-only, Undo, reload, mixed-camera look previews and reference
comparison. Playback remains armed when activating another pane, and scopes
follow the active frame. Per-shot source corrections remain independent.
