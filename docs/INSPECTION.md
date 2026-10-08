# Inspecting and exporting a look

LUT Pal keeps the existing viewer, strip and Compare button. The extra tools are
optional and do not change your original clips or LUT files.

## Scopes

Open the histogram button (**H**), then **Expand** for a larger plot. Choose:

- **Histogram**: original encoded RGB values against the displayed output.
- **RGB histogram**: separate red, green and blue traces on the same count scale.
- **Waveform**: brightness vertically, image position horizontally.
- **RGB parade**: the same view split into red, green and blue channels.
- **Vectorscope**: hue/saturation with 75% colour targets and an optional skin hue
  guide. This is available when the displayed output is confirmed Rec.709.

Shadows are marked blue when all three channels meet the black threshold.
Highlights are marked red when any channel meets the white threshold. The
expanded panel reports each channel separately. Thresholds are percentages of
encoded preview values, with 0% and 100% as the defaults.

Measurements cover the whole displayed image, sampled at 384 pixels wide,
even while zoomed in. The overlay checks the displayed image's pixels. The
original histogram reads the available 16-bit preview source; displayed-output
measurements read browser pixels at 8 bits. Histogram counts use a square-root
scale to keep small peaks visible. Waveform/parade density also uses a square-root
scale; their vertical signal axis stays linear from 0 to 100%.

These are preview checks, not RAW headroom or legal-range/broadcast certification.
A channel reaching an endpoint does not prove the original sensor lost detail.
For Log/HLG without a confirmed display conversion, signal values remain in that
recording space. Waveform weighting uses Rec.709 coefficients. No arbitrary HDR
conversion is added. The skin line indicates a useful hue direction; lighting,
makeup and creative intent matter, and every face need not land on the line.

The Y'/Cb/Cr coefficients follow [ITU-R BT.709-6, sections 3.2–3.3](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.709-6-201506-I%21%21PDF-E.pdf).
The approximate 123° skin direction follows the convention documented in
[VEGAS Pro's scope settings](https://cdn.borisfx.com/borisfx/Documentation/vegas/2026/en/content/topics/8-design/video_scope_settings.htm).
[Apple's vectorscope documentation](https://support.apple.com/en-gb/guide/final-cut-pro/ver761c9f95/mac)
explains the skin guide's position between the red and yellow targets.

## Compare and zoom

Open the magnifier button for **Inspect & export**. Choose Wipe or Side by side
against the existing Reference selection. Both sides use the same scene
adjustments. The original Compare/Space behaviour remains available in Toggle.

**100%** loads the saved original-resolution scene image, rather than enlarging
its 1280-pixel preview. One image pixel occupies one CSS pixel; Retina screens
have more physical display pixels. Drag to pan and choose **Fit** to return.
The first full-resolution view takes time, especially for large frames. Matching
images are cached; stale requests are cancelled when you change the view.
Normal browsing does not invoke this processing. Scopes describe the selected
side in Wipe/Side by side and the displayed side in Toggle.

## Export

**Save full-resolution PNG** (also **Save PNG** in Adjustments) processes the
saved full-resolution source and preserves a 16-bit RGB PNG. It includes enabled
exposure, relative warmth/tint, the source LUT and post-LUT contrast/saturation
in the same order as the preview. The export excludes clipping overlays, labels
and comparison graphics. In Wipe/Side by side it exports the selected look;
in Toggle it exports whichever look is displayed.

**Export adjusted CUBE** creates a separate 33-point CUBE. It includes the same
controls, the source-LUT hash, input/output profile labels and settings as comments.
Apply it to unadjusted footage in the stated input profile; do not apply the
original LUT or the same scene adjustments again. A sampled grid is an
approximation, especially around clipping and strong adjustments. Confirm its
profiles when importing it into another application. Unknown recording profiles
must be confirmed before portable export. No-LUT contrast/saturation remain
inactive, matching the viewer's existing behaviour.

Full-resolution processing runs in a cancellable worker and writes only generated
cache/export files. It does not alter scenes, favourites, adjustments, original
LUTs or the saved source image. The normal library writer remains available
during inspection; exports use its existing operation guard.

## Verification

Independent known-pixel tests check primary scope positions, per-channel clipping,
source-curve exposure and post-LUT adjustments, full-resolution RGB48 processing,
project/profile rejection, download consumption, cancellation and library writes
during inspection. Local browser checks cover all five scope modes, clipping,
Wipe/Side by side, quick navigation at 100%, actual full-resolution downloads and
narrow screens. Seven known colour swatches agree with an independent calculation:
PNG error ≤ 1/65535, browser screenshot error ≤ 2/255 after its embedded display
profile is accounted for, and portable CUBE error < 0.005 for those samples.
These checks do not establish calibrated monitor or physical camera matching.
