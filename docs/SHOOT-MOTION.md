# Shoot review and moving scenes

Starting checkpoint: 7dd440276875dc0e394500ad4bea6a0cf7a5d9da, clean and pushed,
with exact-commit GitHub checks passing on 2026-10-14.

## Product boundary

LUT Library helps choose, check and remember a look. The editor builds the
finished film. The existing viewer, full-resolution stills, favourites and
per-shot adjustments remain the base experience. Motion is optional and only
the main viewer moves; no editing timeline, sound, cuts, transitions or titles.

## Moving scenes

Space or Play creates a silent companion once for an old scene whose original
is available, then loops it. It covers up to six seconds around the pin, clamped
to the source edges. New captures offer to save it alongside each still. Escape
returns to the pinned still. Pause/scrub and save another full-resolution moment
from the original; the new still inherits the displayed look and shot corrections.
Scopes follow the current moving source/output together.

Saved companions survive disconnected sources and travel in project archives
and backups. New captures and first-time companion generation require the
original. No whole-video copy is made. Each companion is capped at 12 MiB,
1280 pixels wide and 24 fps; free disk space is checked. They are saved assets,
so generated-cache clearing preserves them. Storage reports their bytes under
saved stills, motion and style examples. A whole-library motion quota and
separate companion removal control are not implemented in this version.

## Shoot view and styles

The grid button beside All / Favourites opens Shoot view. Review current scenes,
a collection or the whole project. Try a linked look family across cameras,
select scenes, then Apply. An incompatible scene blocks the whole assignment;
it does not silently receive a mismatched LUT. Each shot keeps exposure, relative
white balance and bypass. Library Undo/Redo restores assignments and style edits.

Save current style stores the displayed LUT, creative contrast/saturation and an
approved example. Applying it does not copy the example's source corrections.
Styles are reusable across projects. The board can flag unknown profiles or
output endpoints. Compare selected pair reports whole-frame brightness/RGB
differences for exactly two selected frames. Composition and lighting affect
these averages; it is not a skin-tone match, calibration check or quality score.

## Handoff

Export saved looks produces full-resolution reference PNGs, per-shot adjusted
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
102 passing tests.

In an isolated library with real footage, a six-second Sony preview measured
513,776 bytes (about 0.5 MB), at 1280 × 720 / 24 fps. At one paused pinned frame,
the rendered mean absolute RGB difference from the still was about 0.8%; about
0.9% of channel samples differed by more than 5%. That is one compressed sample,
not a calibration guarantee. Saved playback worked with a task-owned source link
removed. New full-resolution capture correctly refused while offline.

A real Apple Log 2 scene also played, including a live LUT change; its short
source produced a 1.9-second loop. Scene changes and Escape during preparation
returned to stills. Mixed Sony / Apple Log 2 board assignment, saved styles,
new still capture and a downloaded handoff ZIP were exercised in the browser.

These checks do not establish broad camera/codec performance, native NLE parity,
HDR display correctness or physical camera matching. Some older personal-library
source paths are unavailable; their saved stills remain usable but cannot gain
motion until the original is available. No private footage, LUTs or proof images
are bundled into the source package.
