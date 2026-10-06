# LUT Buddy

A Mac-first, single-user local tool for browsing your footage through your LUTs. The large image, floating LUT strip, comparisons, adjustments and light/dark themes remain the base experience.

## Start on a Mac

1. Install [Node.js](https://nodejs.org/) 22 or newer once.
2. Download this project as a ZIP and unzip it, or clone its repository.
3. Double-click **Start LUT Buddy.command**. The first run installs its video tools and needs internet access. Keep the Terminal window open while using the viewer; Control+C stops it.

The browser opens `http://127.0.0.1:53631`. Later runs work offline for browsing and imports; optional AI suggestions need internet access. If macOS blocks a downloaded launcher, you can run `npm ci` then `npm start` from this folder in Terminal and open that address. This is a local web project: it does require Node, but doesn't require Python, Codex or a packaged Mac application.

## Your footage and LUTs

Open **Library → Clips → Import clips**. Recorded Sony camera settings and supported recording profiles are read automatically. Scrub the frame picker, mark several frames, name them and save the scenes. You can select the matching `M01.XML` files alongside your videos, or use **Import camera folder** to pair videos with their XML automatically. XML supplies camera/lens names when those are absent from the video. Unknown or unsupported profiles still need confirmation. **Library → LUTs → Import LUTs** imports standalone 3D CUBE files. New LUTs and saved scene frames open a batch review: edit names, descriptions, tags and LUT abbreviations together, or close to keep the imported defaults. Confirm LUT input/output profiles manually. Existing LUTs can be selected in Library and edited together with the pencil icon; the scene picker also has **Review details** for selected scenes.

For large clips, choose **Library → Clips → Link original clips…** on a Mac.
The native picker links files in place without copying or loading the whole video
into memory. The app still reads the file in chunks to check its identity.
Choose **Show a few frame choices** for six evenly spaced previews, then mark
a frame or refine it with the scrubber. These are timeline samples, not AI cut
detection. Keep linked originals available to capture more frames. Saved scenes
remain usable if the original moves or disconnects. Link the same original again
to restore access without duplicating its scenes.

A project can contain clips from multiple cameras. Profiles belong to individual clips, and every scene from that clip inherits the same profile. Your preserved Sony viewer library also remains available on newly imported Sony S-Log3 / S-Gamut3.Cine footage, using the same actual CUBE files and trilinear preview processing. This preserves the existing browsing behaviour without claiming that its still-unlabelled LUTs suit other cameras. Explicitly edited LUT profile labels take precedence. For other imported LUTs and camera profiles, the viewer shows only compatible LUTs in its thumbnail strip and reference picker for the selected scene; linked camera versions keep the same selected and reference look when switching cameras. If there is no compatible version, No LUT is shown and the look is remembered for a return to supported footage. Explicitly choosing No LUT clears that memory. Changing a clip's profile affects every scene from that clip. Unknown profiles stay marked **[Unverified]**. Camera brand alone is not enough to determine a recording profile.

The YUV decoding matrix is separate from recording gamma/gamut. Stream tags, supported Sony RTMD coding equations, and matching camera XML are used explicitly for original and scrub decoding. Missing or unsupported tags remain **[Unverified]**; choosing a profile alone does not establish the matrix. Frame settings are matched to the original frame timeline before showing ISO, aperture, shutter, focal length and white balance in the existing camera strip. Unsupported or absent settings stay unavailable; Kelvin is never inferred from a preset. Camera XML is checked against filename, frame count and embedded recording fields before use. Browser upload cannot read neighbouring files you have not selected, so select XML alongside the clip or choose the camera folder. The Mac native linking picker can pair matching XML beside an explicitly selected original. Generated caches include decoding settings, and arrow navigation follows the dropdown order.

The recording-profile choices include 16 published log/gamut combinations, plus Rec.709 and HLG labels. [Supported media and limits](docs/SUPPORTED-MEDIA.md) separates conversion support from automatic camera detection. These labels allow direct matching with your LUTs; they do not add automatic conversion between profiles. Matching HLG transfer, BT.2020 primaries and BT.2020 matrix tags automatically identify HLG. Clips with matching Rec.709 transfer, gamut and matrix tags identify SDR across camera brands; other unproven recording modes remain unverified. Apple Log, HDR and SDR are distinct recording modes. Confirm the actual mode rather than assigning Apple Log to every iPhone recording. Other supported profiles can be selected manually and used with LUTs that expect that exact input.

Hold a LUT tile for **three seconds** to enter jiggle mode, then drag tiles into your preferred order. Choose **Done** or press **Escape** to finish. The order saves across reloads and travels with saved projects. In the Favourites filter, rearranging favourites preserves the slots of hidden LUTs. You can also use Left/Right on a focused tile while arranging. Moving the pointer during a hold keeps the original sweep-to-browse behaviour.

Projects organize scenes, collections and tags. LUT contents and descriptions are shared; favourites and saved LUT ordering belong to each project. Viewer settings and per-scene adjustments save automatically. Library → Undo / Redo, or Command/Ctrl+Z and Shift+Command/Ctrl+Z, reverse scene/LUT details, clip profile changes, collection edits, ordering and scene removal. Edit history survives restarting and stays with the active project. Text fields retain their usual typing Undo. Imports, project creation, backups and adjustment sliders are outside this edit history.

Click **Scene** to open the scene picker. **All scenes** browses the entire project; select a collection to browse only its scenes. The preserved sample scenes are grouped in **Demos**. Search narrows the list by name or tags. Choose **Device** to browse a recorded camera model or **All devices**. This intersects the selected collection. Up/Down follows that device, collection and saved order. Missing camera identity stays Unknown device.

Drag a scene's small handle onto another row to rearrange it, or onto a collection to add it there. Dropping onto **New collection** lets you name a new collection containing that scene. A scene can belong to several collections: adding it never removes it from another. All scenes and each collection have independent saved orders. Rearranging search results keeps hidden scenes in their existing slots. You can also focus a handle and use **Alt+Up/Down** to reorder.

Hover or keyboard-focus a collection to show its reorder handle and rename pencil; scene handles also appear on hover/focus. Touch devices keep these controls available. Collections can be arranged and renamed without shifting the rows. All scenes stays pinned. Alt + Up/Down on a collection handle also rearranges it. Folder order persists across restarts and is reflected in the Library selectors.

Choose **Select** for checkboxes and select several scenes. **Select all** selects the current search results; the count includes any selections hidden by your search. Use **Add to…** to add the selection to an existing or new collection, or **Remove from collection** when browsing a folder. Dragging a selected scene carries the selection. On a Mac, Command-click also starts selection and Shift-click selects a range.

When dragging out of a collection, a small trash target appears outside the picker. Drop there to **remove from that collection**. Scenes remain in All scenes and their other collections; dropping elsewhere cancels. **Undo removal** restores the most recent removed group and its previous order during the current page session. There is no trash target in All scenes.

The camera button (C) groups information as camera → recording profile/gamut → dimensions, frame rate and bit depth/chroma sampling → shooting settings. Labels are gray, with subtle lines between related groups. Fields share one line when space allows and wrap when needed. This information changes with each scene, including mixed-camera projects. Profile and gamut describe the input a LUT needs; the file's codec remains in the Library clip details. Hover a field for its metadata source. Profiles not established by recorded metadata say “selected profile”; conflicting recorded and selected profiles show “Profile mismatch”. Missing information stays [Unverified]. Apple Log here means the original Apple Log/BT.2020 profile, not Apple Log 2.

When a scene has active adjustments, the end of that strip shows their values in gold, without a separate status label. Bypassed or inactive adjustments add nothing to the strip. Recorded camera settings retain their original values.

Scene changes retain the previous finished image until the next preview and its saved adjustments are ready. Images are decoded before display, and a newer navigation cancels publishing an older pending adjustment render. This prevents a temporary unadjusted look from flashing during the swap and uses the existing preview caches.

## Port a look to another device

In **Library → LUTs**, choose **Select** and select one or more LUTs.
The **Convert** arrows icon appears beside the edit pencil below Search LUTs when at least one LUT is selected. Choose a target device
and recording profile, then **Convert**. You can also open a LUT's details and
choose **Convert to device**.
Imported scenes populate devices from recorded camera identity. **Choose another
device** lets you name a target before importing footage; choose its actual
recording profile separately. A ported target is retained with its saved copy.

Porting creates a linked **33-point CUBE**, keeps the original, copies a starred
source's favourite status in the active project and reuses an existing matching
version. A small copy icon in the Library and thumbnail strip identifies a port.
Further ports use the original look when available, avoiding repeated sampling.
Selected and reference versions follow the same look between compatible scenes.

The supported set contains 16 published log/gamut definitions for Sony, Apple,
Canon, Panasonic, ARRI, RED, Blackmagic, DJI, Fujifilm and Nikon.
[Profiles, sources and exact limits](docs/MODERN-CAMERA-PROFILES.md) include ARRI
LogC3 at EI800 only, Blackmagic Gen5 only and the published DJI D-Log definition;
D-Log M, RAW and HDR display conversion are excluded. A camera/codec name alone
does not establish its recording profile. Unlabelled legacy Sony LUTs use the
original viewer's interpretation, with their individual profiles still unverified.

**Review the converted looks with AI** uses your connected Claude Code or Codex tool.
It sends original/graded previews from matching footage and proposes names,
descriptions and tags. Review and save selected suggestions; AI cannot change
conversion coefficients, profiles, family abbreviations or established creators.
Ported files stay usable if AI is unavailable or cancelled. Without matching
footage, edit details manually or import footage before asking AI to review.
These are profile adaptations; physical camera matching is **[Unverified]**.

The default project is **My Project**. Use the pencil beside its name to rename
it. Renaming is saved, travels with project exports, and supports Undo/Redo.

## Optional AI suggestions

LUT Buddy is an independent project. Its local AI connection code adapts the
technique from Ellis’s other projects; those apps are not required or connected.

Open **Library → AI tools** to check your installed **Claude Code** or **Codex**
tool. Sign in through the official tool once if needed, then choose **Check
connection**. Your existing login is used; LUT Buddy does not collect login
tokens. The status shows subscription or API billing where established. Calls
use the chosen tool’s normal account limits and may fail if its limits are used up.

After importing LUTs or saving scene frames, a connected AI tool automatically
drafts their details in the review window. The preferred connected tool is used;
if it is unavailable, another connected tool is chosen. Unknown LUT profiles
need confirmation first. Suggestions stay editable and are saved only when you
choose **Save reviewed details**. If AI is unavailable, imports still work.

For existing items, in **Scene details** or a LUT’s details, choose **Suggest details**, pick the AI
tool and run the request. A scene uses its selected original preview; a LUT uses
the selected scene’s original and actual graded previews. Saved preview
adjustments are excluded. Review/edit the suggestions, uncheck fields you want
to keep, choose **Use selected suggestions**, then **Save details**. Nothing is
saved just by generating or accepting a proposal. Cancel closes the running
request without applying it.

Names, descriptions and tags stay editable manually. LUT details also offer a
creator and a three-character abbreviation (linked versions of one look may share it across different profiles); **LOG** is reserved. Changing
an abbreviation preserves original gallery previews and CUBE contents. AI does
not establish camera metadata or LUT recording-profile compatibility. Choose a
scene with matching recording/LUT profiles before requesting a LUT description.

The reusable transport is `src/ai-cli.cjs`, with no package dependencies beyond
Node. [Source/adaptation notes](docs/AI-REUSE.md) explain what was carried over.
Official tools are installed separately. Before selling or hosting the project,
recheck provider integration terms and use the supported distribution/auth route.

## Local storage and backup

Imported clips are **copied** into `~/Documents/LUT Explorer Library`, alongside the original LUT contents, captured frames and `library.sqlite`. This consumes extra disk space. Original files stay unchanged. There is no LUT Buddy account or hosted library. Original videos, decoding and library storage stay local. If an AI tool is connected, automatic import drafts send selected preview images and details to that provider. Moving or deleting the source card does not break copied clips or captured scenes. Linked originals stay outside the library and are excluded from backups and project exports; captured scenes and their settings are still included. After reopening a project, link the originals again to capture more frames.

**Library → Save project** downloads a `.lutproject` file containing the current project's scenes, collections, original imported footage, LUT library, favourites, ordering and adjustments. Files stream to the archive; camera footage does not have to fit in memory. **Open project** opens a separate project copy. Matching LUT contents are reused, preserving the existing shared library's names and descriptions. Saved preferences are mapped to the new scene/LUT identifiers. The current project remains intact. Legacy scenes retain their images and gallery previews; migrated source card footage is not copied unless it was imported into the library.

**Library → Back up library** copies the entire library into a dated `backups/Library-…` folder. **Restore backup** lets you choose a backup and one of its projects, then opens a separate copy without Terminal. Generated preview caches are rebuilt as needed. Keep the backup until you have checked its restored copy.

For an isolated second library or a different local port:

```sh
LUT_EXPLORER_DATA="/absolute/path/to/my/library" LUT_EXPLORER_PORT=53632 npm start
```

The server listens only on this computer's loopback interface. Run one service per library; do not start two processes against the same library folder.

The current library format is version 7. Existing libraries receive a database backup before upgrading. Upgrades preserve scenes and settings, add collection ordering and persistent edit history, and group existing demo scenes once without duplicating them.

## What has been verified

- The original viewer stylesheet is copied verbatim. Its stage, LUT dock and controls are compared with the original in both themes.
- Mixed-profile clips in one project: multi-frame capture, profile-specific LUT matching and cleared incompatible selections.
- Captured fractional-rate and variable-rate frames match an independent RGB decode of the original frames. Scrub previews also match independent frame selection, including clips with a nonzero start timestamp.
- Original CUBE contents remain unchanged; malformed grids, unsupported shaper LUTs and mismatched declared profiles are rejected.
- SQLite save rollback, restart persistence, collections, Undo and a reopened backup with usable copied footage.
- Scene drag/reorder, membership in several collections, independent orders, search, collection keyboard navigation and persistence after restarting.
- Checkbox/range selection, bulk add/remove, actual drag out to the trash target, cancelled drags, removal Undo and empty collections.
- Conditional camera-strip adjustment summaries, bypass/reset, narrow-screen picker layout and the live Demos collection.

Run the backend checks with `npm test`. Browser proof records are retained separately in the development folder's `evidence/` directory; they are not bundled with the shared source ZIP.

## Current limits

This is an early local build, not a finished commercial release. Real iPhone 15 Pro and iPhone 17 Pro HLG clips passed metadata extraction and original-frame/reference comparisons; an iPhone 15 Pro clip also passed the HTTP import/capture workflow in a disposable library. Three full-resolution, ungraded Apple Log frames from Christian Maté Grab’s creator-provided iPhone 15 Pro test reel passed browser/project roundtrip checks. The Apple Log profile is documented by the creator; original camera tags are not present in that exported reel. Real delivered SDR footage passed explicit BT.709 decode and identity-LUT comparisons (maximum rounding error 1/65535); this is not a test of native SDR iPhone camera metadata. A broad camera/codec sample set, reference colour accuracy and performance on long clips still need further validation. Another-computer testing is deferred at the user's request. Matching user-supplied profile labels is not proof of a LUT creator's colour requirements. The original Sony library keeps its established browsing behaviour; its individual unconfirmed LUT requirements remain [Unverified]. Nine selected Sony looks have standalone standard Apple Log 2 33-point adaptations, using published log/gamut transforms before the original CUBE. [Adaptation notes](docs/LOOK-ADAPTATION.md) explain the math, limits and validation. This does not establish a calibrated physical camera match. General automatic conversion and HDR display output are not implemented. Source exposure and relative colour balance use the selected profile’s published transfer curve for all 16 Log combinations, Rec.709 and HLG. Colour balance is a relative slider adjustment, not a calibrated Kelvin setting. Unknown/unsupported profiles keep source controls disabled; post-LUT contrast/saturation remain available. The browser preview is a look comparison rather than a calibrated grading monitor. Clip indexing reads recorded presentation timestamps for progressive H.264, HEVC and ProRes when packet/frame counts agree; other clips use a decoded frame index. Indexing and a streamed identity check can take time. On first opening a clip of up to 2,000 frames and under 512 MB, the picker prepares small, timestamp-checked previews once for fast scrubbing. Larger clips use cached previews generated on demand. Full-resolution originals are decoded when saving scenes. Closing the picker cancels its pending display request; reopening starts a fresh session.

Apple Log and Apple Log 2 imports now read the original QuickTime video track's
Log identifier when present, rather than inferring the profile from an iPhone
model. A real 1.32 GB iPhone 17 Pro ProRes HQ recording passed linking, on-demand
scrubbing, independent original-frame capture comparison and automatic Claude
Code scene drafts in an isolated library. Its recorded profile was original
Apple Log / BT.2020. This test injected the file-picker result; it does not
establish interactive native-picker selection or performance on long clips.

The Mac launcher and Apple Silicon media tools were exercised locally. A clean Intel Mac setup and other operating systems remain **[Unverified]**. Launch through the supplied command after changing dependencies or restart an existing service after updating the project.

Batch review automatically checks for a connected AI tool after importing LUTs or saving scene frames. Unknown LUT profiles wait for **Save profiles & continue** before generating automatic drafts. Manual editing remains available without AI. **Suggest selected** reruns your chosen provider for each checked item in sequence; **Stop** cancels the active request and retains completed drafts for review. Suggestions do not save automatically. Uncheck a field to retain its current value. **Save reviewed details** saves all selected changes in one transaction; stale details or conflicting abbreviations reject the entire batch. Original files, camera evidence, collection memberships, order and favourites are preserved. Confirm unknown LUT profiles in the review window, then use Save profiles & continue or Suggest selected. Your naming drafts stay in place. A matching scene is selected for each LUT; you can choose a different matching reference. AI cannot establish a recording profile. Choosing a recording profile does not enable an automatic HDR display transform.

HLG transfer-tag interpretation follows [FFmpeg’s ARIB STD-B67 definition](https://ffmpeg.org/pipermail/ffmpeg-cvslog/2016-June/100209.html). This identifies the encoded recording profile; it does not add Dolby Vision metadata processing or HDR display output.

Ellis’s local library has three Apple Log 2 demo frames from [Nash Yang’s creator-provided iPhone 17 Pro Max clips](https://www.passionfuelsambition.com/ai-color-grading-plugin-kills-all-struggles/). Standard ProRes 422 HQ originals are retained, with 4K RGB48 scene captures through the normal import pipeline. Camera identity is embedded; Apple Log 2 recording mode is confirmed by creator documentation rather than inferred from generic stream colour tags. First-generation Apple Log demos were soft-removed, with their files retained for recovery. The two imported Apple Log 2 LUTs are 33-point standard non-RAW GLOAT and CineSauce; their source files are unchanged. These personal LUTs and demo assets are excluded from the source ZIP. Permission to redistribute demo assets remains [Unverified].


## Optional donations

The coffee icon beside the theme toggle opens a small support popover. To enable
its **Buy me a coffee** link, set `data-donation-url=""` on `#coffee-popover` in
`ui/index.html` to your donation page's full HTTPS URL (for example, your own
Buy Me a Coffee or Ko-fi page). Until configured it says **Donations coming soon**.
The link opens the donation service in a separate tab; LUT Buddy processes no
payments and the tool remains available without donating.

## Storage, restarting and updates

**Library → Storage** shows imported clips, saved frames, LUTs, generated
previews, backups and free disk space. **Clear generated previews** waits for
processing, clears only disposable cache and rebuilds previews as needed.
Saved work is retained. Clips and backups may be large; they are never
silently deleted to save space.

Only one service can write a library. Multiple browser tabs can use that same
service. If another copy owns the library, use it or stop it before restarting.
After a forced quit, wait one minute if its lock has not expired yet.

Before updating, **Back up library**, stop the running service with Control+C,
then update/unzip the source and open the launcher. Keep your existing
`~/Documents/LUT Explorer Library` data folder; the older folder name is retained
for compatibility. The launcher detects an older running source build.

## Licence and contributing

LUT Buddy’s own code is **MIT licensed**. Imported LUTs and footage retain their
owners’ rights. [Third-party notices](THIRD_PARTY.md) cover dependencies, including
the video tools; they are not bundled in the source release. Donations are
optional. No account is needed for ordinary importing and browsing.

See [Contributing](CONTRIBUTING.md) for local development, [Supported media](docs/SUPPORTED-MEDIA.md)
for honest capability limits, and [Source releases](docs/RELEASING.md) for releasing.
