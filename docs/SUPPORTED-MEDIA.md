# What is supported and what is verified

The first release is a **Mac-first, single-user local web tool**, using Node.js
22+, FFmpeg/FFprobe and the browser. Windows/Linux are not release claims yet.
Another-computer testing is deferred; local verification is recorded below.

## Import and metadata

Video containers accepted: MP4, MOV, MXF, MKV, MTS/M2TS, AVI and WebM. Acceptance
of a container is not proof every codec inside it is supported. Unsupported or
damaged footage must fail without publishing partial library records.

- Sony RTMD and matching user-selected camera XML provide supported camera,
  lens, recording-profile and per-frame exposure information. XML is matched
  against the selected video; selecting a video alone cannot expose a neighboring
  XML file to the browser.
- Matching HLG tags identify HLG. Matching SDR transfer, primaries and matrix tags identify Rec.709 across camera brands.
  Apple Log / Apple Log 2 are detected from the selected original QuickTime video
  track's Apple Log identifier when present and consistent. The parser skips
  compressed footage and bounds metadata reads; an iPhone model alone never
  establishes the profile. Absent proof, the user confirms the recording mode.
- Other camera profile labels are choices for explicit matching/conversion,
  not promises of automatic metadata detection for every model.
- Curve/gamut, YUV matrix and full/limited range are independent. Missing
  tags remain unverified; selecting a recording profile does not establish
  the decoding matrix.

## LUTs and colour

Standalone 3D `.cube` grids are validated, limited to 64 MB, preserved unchanged
and reused by content hash. 1D shapers and unsupported structures are rejected.
The viewer shows compatible input-profile/Rec.709-output LUTs per scene.

[Modern profile definitions](MODERN-CAMERA-PROFILES.md) list all 16 conversion
inputs and their exact restrictions. Converted copies are 33-point, linked to
the source look and marked with a copy icon. RAW, D-Log M and arbitrary HDR
rendering are excluded. AI suggests labels; numerical conversion stays in code.

Source exposure and relative colour balance support the 16 published Log/gamut
combinations, Rec.709 and HLG. The selected transfer curve is decoded before
exposure/balance and re-encoded before applying the original LUT. Balance is
relative, not a Kelvin calibration. Unknown modes keep these controls disabled.
Post-LUT contrast/saturation remain available for compatible LUTs. Browser previews are
look comparisons, not a calibrated grading monitor. Cross-camera matching,
including sensor/exposure/white-balance differences, remains `[Unverified]`
until tested on paired footage.

## Proof boundaries

Automated checks use independently decoded fractional/VFR frames, synthetic
video, independent vendor colour fixtures, project round trips, preference
conflicts, cancellation, file validation and library-protection fault tests.
Local real-browser checks cover a fresh library, imports, scenes, comparison,
conversion, project export/reopen and safe cache clearing. Those checks do not
establish physical camera calibration or broad codec support.

A real 1.32 GB, 4K ProRes HQ iPhone 17 Pro recording passed direct linking,
six distinct on-demand frame choices, back-and-forth browser scrubbing, and
full-resolution capture matching an independent frame-number decode. Its
embedded Apple Log identifier agreed with macOS Core Media. A connected Claude
Code automatically drafted scene details without saving them. The original and
personal library were unchanged. File selection was injected in this isolated
test; interactive native file-picker selection remains separately unverified.

Imports index original frame timestamps. Progressive H.264, HEVC and ProRes use
recorded packet timestamps only when declared frame counts and unique PTS agree;
other clips retain decoded indexing. Every selected capture checks decoded PTS.
Clips under 512 MB with up to 2,000 frames use a prepared scrub sequence; larger
clips generate cached previews on demand. Six evenly spaced candidate previews
provide a quick alternative to scrubbing; they are not automatic cut detection. Library > Storage
reports usage and clears generated previews after processing finishes. Footage,
saved scenes, LUTs, preferences and backups are retained. Automatic deletion of
personal media or backups is not part of this release.

## Large originals

Mac users can link original clips through the native file picker. Browser requests
cannot provide arbitrary paths. Originals are read in chunks and hashed once; they
are not copied into the library or loaded as one video-sized buffer. Timestamp
metadata still uses memory proportional to clip length. A sparse synthetic MP4
over 2 GB passed import, six-preview selection, scene capture, project roundtrip
and relinking with under 256 MB additional process memory. This does not establish
long-camera-clip performance. H.264, HEVC and ProRes synthetic VFR/nonzero-start
fixtures passed independent frame comparisons. ProRes tags absent from the probe
remain unverified rather than becoming an assumed profile.

Linked originals must remain available for further captures. Project exports and
backups contain saved scenes, LUTs and settings but exclude linked originals.
Relink the same original after moving it or opening an exported project. Native
chooser compilation/path handling is verified locally; picker selection in browser
workflow tests uses injected paths rather than an automated OS dialog click.

Per-frame metadata output is bounded. Oversized or unreadable metadata falls back
to clip-level metadata with a visible notice; frame settings remain unavailable.
A matching Sony XML may supersede generic transfer/gamut tags, but conflicting
recorded Sony RTMD or decoding matrices are rejected.
