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
- Matching HLG tags identify HLG. Matching Apple SDR tags identify Rec.709.
  Apple Log / Apple Log 2 cannot be assigned to every iPhone recording: absent
  proof, the user confirms the actual recording mode.
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

Source exposure/white-balance adjustments currently support Sony S-Log3. Post-LUT
contrast/saturation remain available for other profiles. Browser previews are
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

Long imports index original frame timestamps. Up to 2,000 frames use a prepared
scrub sequence; longer clips generate cached previews on demand. Library > Storage
reports usage and clears generated previews after processing finishes. Footage,
saved scenes, LUTs, preferences and backups are retained. Automatic deletion of
personal media or backups is not part of this release.
