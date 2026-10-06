# Linked camera looks

The viewer remains the original design. Device in the existing scene picker filters
both its list and up/down navigation. The filter intersects collections without
changing their memberships or saved order. All devices restores mixed-camera
browsing. Recorded camera model determines the group; missing identity stays
Unknown device. The current iPhone demo clips are iPhone 17 Pro Max, not recordings
from Ellis's iPhone 17 Pro. Their standard Apple Log 2 profile is also available on
iPhone 17 Pro; no ProRes RAW or Apple Log 1 assumption is made.

A look family uses the original LUT's SHA256. A camera variant may share its
abbreviation only with that family in a different input profile. Selected and
reference looks follow compatible versions when moving between cameras. An absent
version displays No LUT and remembers the family for a return to supported footage.
Choosing No LUT explicitly clears this memory. Favourites remain per variant and
per project; adding the nine adaptations copies each source's starred status.

## Apple Log 2 adaptations

Apple Log 2 / Apple Wide Gamut RGB -> inverse Apple Log curve -> linear Apple Wide
Gamut to linear S-Gamut3.Cine (D65 -> D65) -> Sony S-Log3 encoding -> the exact source
CUBE, with its declared domain and trilinear sampling. Bake a standalone red-fastest
33-point CUBE. Inputs/outputs are not clipped during conversion: only the original
CUBE domain is bounded as it is in the existing viewer. The final display clips to
0..1 as before. No extra tone mapping or camera-specific correction is added.

This reproduces the **existing Sony viewer pipeline**, including its treatment of
legacy LUTs whose individual input/output labels remain unverified. It is not a
claim that those files' publisher-intended input gamuts have been newly confirmed.
These are local derived copies, not official Apple versions from the LUT publishers.
Original LUT files, metadata and favourites remain unchanged.

Primary references, checked 2026-10-06:

- [OpenColorIO Apple camera transforms](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/src/OpenColorIO/transforms/builtins/AppleCameras.cpp): Apple Log curve and Apple Wide Gamut D65 chromaticities.
- [OpenColorIO Sony camera transforms](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/src/OpenColorIO/transforms/builtins/SonyCameras.cpp): S-Log3 curve and S-Gamut3.Cine D65 chromaticities.
- [Published independent transform test values](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/tests/cpu/transforms/BuiltinTransform_tests.cpp).
- [Apple capture documentation](https://developer.apple.com/documentation/avfoundation/avcapturecolorspace/applelog2).

The JavaScript implementation agrees with independently solved NumPy colour
matrices to less than 1e-12. Apple curve values agree with published OpenColorIO
fixtures. Neutral values, source preservation, actual grid sampling, duplicate
import protection, code collisions and portable project round trips are tested.

For the nine requested looks, ~30,000 pixels from three actual standard Apple Log 2
frames were compared with the unbaked chain: 99th-percentile absolute display RGB
channel error is 0.00246–0.01107 (about 0.6–2.8 levels on an 8-bit scale). Worst
sample error is 0.06249 (~16 levels) for CPH, so 33-point copies are approximations,
especially around saturated colours and clipping boundaries. No 65-point or RAW
versions were imported. See evidence/device-looks/colour-proof.json.

**Physical camera match remains [Unverified].** Sensors, exposure, white balance,
lenses, in-camera processing and gamut boundaries can produce different images
of the same subject. Compare paired Sony and iPhone footage before claiming a
calibrated camera match. No paired footage was available for this work.

Personal footage, original LUTs and derived look copies are excluded from the
source ZIP. The nine copies are separately exported under Matching Looks.
