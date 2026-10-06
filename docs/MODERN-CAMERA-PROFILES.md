# Camera profiles supported for porting

Porting converts a target camera's encoded colours into the source LUT's expected encoding, then applies the source look. It preserves the original file and bakes a separate 33-point CUBE. The calculations use published encoding definitions; AI does not invent the conversion coefficients.

These are recording profiles, not a list of camera models. One camera can record multiple profiles. An imported scene's camera identity can populate the device picker, but its recording profile must be known separately. A model name or codec alone does not establish the profile.

## Supported definitions

| Family | Recording profiles |
| --- | --- |
| Sony | S-Log3 / S-Gamut3.Cine; S-Log3 / S-Gamut3 |
| Apple | Standard Apple Log / BT.2020; standard Apple Log 2 / Apple Wide Gamut |
| Canon | C-Log2 / Cinema Gamut; C-Log3 / Cinema Gamut |
| Panasonic | V-Log / V-Gamut |
| ARRI | LogC3 / Wide Gamut 3 **at EI 800**; LogC4 / Wide Gamut 4 |
| RED | Log3G10 / REDWideGamutRGB |
| Blackmagic | Film Gen 5 / Wide Gamut Gen 5 |
| DJI | Published 2017 D-Log / D-Gamut definition |
| Fujifilm | F-Log / F-Gamut; F-Log2 / F-Gamut; F-Log2 C / F-Gamut C |
| Nikon | N-Log / BT.2020 |

The profiles cover common modern workflows without pretending every camera-brand mode is interchangeable. Sony VENICE-specific gamut variants, other ARRI LogC3 exposure indices, old camera-specific Blackmagic Film generations, and DJI D-Log M are excluded. DJI's Zenmuse X9 has exposure-index-dependent curve handling and is not silently assigned to the 2017 profile. RAW, HLG, PQ, Rec.709 display inputs and arbitrary HDR display rendering are outside this porting module.

## Colour and fidelity boundaries

- The common intermediate is scene-linear XYZ with D65 white, with neutral linear RGB=1 corresponding to Y=1. There is no automatic exposure compensation or display tone map.
- Signed linear values pass through the colour matrix. Each log encoding uses its published low-end segment; Apple's defined floor below linear −0.05641088 is retained. The source LUT's declared domain controls any eventual lookup clamping.
- Canon's published 0.9 reflection scaling is included. It is easy to miss and would otherwise create a systematic brightness mismatch.
- Blackmagic uses the vendor-reviewed ASWF CLF matrix, including its white-point handling, rather than substituting rounded gamut coordinates.
- DJI uses ASWF's continuous camera-log implementation of the published D-Log formula. The white paper has rounded splice constants; ASWF uses an optimized linear/log transition.
- Fuji's published rounded splice constants and Nikon's published 10-bit branch thresholds are retained. These contain tiny definition-level discontinuities around their branch points. They are not replaced with AI guesses.
- A 33-point CUBE is a sampled approximation of the composed chain. It can lose accuracy near sharp highlight or saturation clipping. Profile correctness is separate from interpolation accuracy.
- **[Unverified] physical camera match:** sensor response, exposure, lens/filter effects and white balance can differ even when encodings agree. Compare the same subject filmed with both devices before claiming a calibrated match.

## Implementation interface

`src/camera-transforms.cjs` exports a frozen `profiles` array and `byId(id)`. A profile has `id`, `label`, `shortLabel`, `note`, `decode(encodedRGB)` and `encode(XYZ_D65)`; unknown IDs return `undefined`. Inputs must contain exactly three finite values.

To bake a source LUT for a target recording profile, each target lattice point is processed as:

```js
const sourceInput = byId(sourceProfile).encode(byId(targetProfile).decode(targetRGB));
const output = sampleOriginalLut(sourceInput);
```

The direction matters: the new CUBE consumes the **target** profile while the original LUT still consumes its **source** profile. Repeated conversions should use the original family source where available; baking an already baked copy compounds interpolation loss.

## Validation

`tests/camera-transforms.test.cjs` verifies ten independently published OpenColorIO camera fixtures against encoded RGB `[0.5, 0.4, 0.3]`, two reviewed ASWF CLF fixtures, and two official Fujifilm CLF fixtures. Separate published Fuji/Nikon/Blackmagic code-value and BT.2020 matrix landmarks verify additional profiles. Further checks cover signed values, nominal-domain finite conversions across all 16 profiles, and inverse round trips.

Tests do not simply compare one implementation with its own inverse. XYZ-to-ACES reference matrices are independent constants; camera expected values come from the external fixtures. All calculations run in native Node; no Python runtime is required by the product.

## Primary sources

Definitions checked 2026-10-06:

- ASWF OpenColorIO [Apple camera definitions](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/src/OpenColorIO/transforms/builtins/AppleCameras.cpp), [Sony](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/src/OpenColorIO/transforms/builtins/SonyCameras.cpp), [Canon](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/src/OpenColorIO/transforms/builtins/CanonCameras.cpp), [Panasonic](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/src/OpenColorIO/transforms/builtins/PanasonicCameras.cpp), [ARRI](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/src/OpenColorIO/transforms/builtins/ArriCameras.cpp), [RED](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/src/OpenColorIO/transforms/builtins/RedCameras.cpp), and [published numerical fixtures](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/tests/cpu/transforms/BuiltinTransform_tests.cpp).
- ASWF [Blackmagic reviewed CLF generation](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/blob/main/opencolorio_config_aces/clf/transforms/blackmagic/generate.py) and [complete Gen 5 CLF](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/blob/main/opencolorio_config_aces/clf/transforms/blackmagic/input/BlackmagicDesign.Input.BMDFilm_WideGamut_Gen5_to_ACES2065-1.clf).
- ASWF [DJI definitions](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/blob/main/opencolorio_config_aces/clf/transforms/dji/generate.py) and [complete D-Log CLF](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/blob/main/opencolorio_config_aces/clf/transforms/dji/input/DJI.Input.DLog_DGamut_to_ACES2065-1.clf). DJI's [X9 white paper](https://dl.djicdn.com/downloads/DJI_Ronin_4D/X9_D_Log_D_Gamut_Whitepaper_I.pdf) establishes why EI-specific X9 profiles must not be assumed equivalent.
- Fujifilm [F-Log v1.2](https://dl.fujifilm-x.com/technical-data/F-Log_DataSheet_E_Ver.1.2.pdf), [F-Log2 v1.1](https://dl.fujifilm-x.com/technical-data/F-Log2_DataSheet_E_Ver.1.1.pdf), [F-Log2 C v1.0](https://dl.fujifilm-x.com/technical-data/F-Log2C_DataSheet_E_Ver.1.0.pdf), and [official CLF downloads](https://www.fujifilm-x.com/global/support/download/technical-data/) v1.10, 2026-04-16.
- Nikon [N-Log specification](https://download.nikonimglib.com/archive3/deHU500g8zYS03Crat379bMLUc33/N-Log_Specification_%28En%2901.pdf).

Numerical definitions and equations are re-expressed in JavaScript. OpenColorIO sources are BSD-3-Clause; no camera vendor creative LUT files are bundled by this module.
