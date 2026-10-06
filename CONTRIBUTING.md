# Contributing to LUT Buddy

LUT Buddy is a local, single-user browser tool. The existing viewer is the base:
preserve its image-first layout, LUT strip, comparison behavior and themes.

Use Node.js 22+, run `npm ci`, then `npm test`. Run `npm start` to browse.
For experiments, use a disposable library instead of your real footage library:

```sh
LUT_EXPLORER_DATA=/absolute/path/to/disposable-library LUT_EXPLORER_PORT=53632 npm start
```

Tests create their own synthetic footage and temporary libraries. They need no
personal LUTs, paid AI account or camera card. AI test responses are mocked.
Changes to saved data, colour processing or file removal need meaningful tests.
Check visible interactions in a browser; passing backend checks alone is not UI
acceptance. Do not commit footage, LUT packs, libraries, credentials or previews.

Camera identity, recording curve/gamut, decoding matrix/range and a LUT's input
requirements are separate facts. Keep missing evidence marked `[Unverified]`.
Do not guess profiles from a camera model, filename or codec.

To report a problem, include the app version, Mac/browser version, steps and the
message shown. Share a small clip only if you have permission; redact private
filenames and personal material. Keep changes focused. Third-party notices must
stay accurate; the MIT licence covers this project's own code only.
