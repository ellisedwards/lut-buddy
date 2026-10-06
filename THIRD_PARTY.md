# Runtime dependencies

The downloadable source ZIP contains this project's source, not copied camera footage, LUT libraries, node_modules or FFmpeg binaries. `npm ci` installs these pinned third-party dependencies:

- `ffmpeg-static` 5.3.0: GPL-3.0-or-later package; downloads platform-specific FFmpeg binaries. [Project and binary sources](https://github.com/eugeneware/ffmpeg-static).
- `@ffprobe-installer/ffprobe` 2.1.2: LGPL-2.1 package; platform-specific probe packages have their own licences. Apple Silicon uses `@ffprobe-installer/darwin-arm64` 5.0.1, labelled LGPL-2.1. [Project](https://github.com/SavageCore/node-ffprobe-installer).
- `sql.js` 1.14.2: MIT package. [Project](https://github.com/sql-js/sql.js).

Dependency licence files and notices are installed in node_modules. Check the applicable terms and corresponding binary sources before redistributing bundled third-party binaries. Imported LUTs and footage remain subject to their owners' rights; they are excluded from the source download.

- `exiftool-vendored.pl` 13.59.3 supplies ExifTool 13.59 for read-only metadata extraction; the Mac launcher uses `/usr/bin/perl`. Package MIT; bundled ExifTool follows its included Perl licence terms. [Vendored source](https://github.com/photostructure/exiftool-vendored.pl), [ExifTool](https://exiftool.org/). Sony RTMD packed focal-length and profile decoding follows [telemetry-parser documentation/source](https://github.com/AdrianEddy/telemetry-parser/blob/master/src/sony/rtmd_tags.rs); no third-party source was copied into the renderer.
- `fast-xml-parser` 5.11.2: MIT. Used to validate and read user-selected camera XML; document entities are rejected. [Project](https://github.com/NaturalIntelligence/fast-xml-parser).

The optional local AI connection adapts Ellis's own Experience Cloud/Vacuum
transport code; it does not bundle either app or Claude Code/Codex executables.
Users install the official tools separately and retain their own authentication
and billing. See `docs/AI-REUSE.md` for exact source provenance.

- `yazl` 3.3.1 and `yauzl` 3.4.0: MIT. Stream portable project ZIP files without holding camera footage in memory. [yazl](https://github.com/thejoshwolfe/yazl), [yauzl](https://github.com/thejoshwolfe/yauzl).

- `proper-lockfile` 4.1.2: MIT. Atomic cross-process library ownership with a
  refreshed, expiring lock. [Source](https://github.com/moxystudio/node-proper-lockfile).

The project’s own code is MIT licensed (LICENSE); dependencies, camera/LUT
content, vendor references and trademarks retain their separate rights.
Camera equations and numerical fixtures reference the vendor publications and
ASWF OpenColorIO sources listed in docs/MODERN-CAMERA-PROFILES.md. No FFmpeg,
OpenColorIO library or vendor LUT binary is included in the source ZIP.

**Binary inspection, 2026-10-06:** the Apple Silicon FFmpeg 6.0 downloaded by
`ffmpeg-static` in the local development environment has `--enable-gpl`,
`--enable-version3` and `--enable-nonfree`; `ffmpeg -L` explicitly says it is
not legally redistributable. Do not copy that executable into releases.
The source ZIP and Git repository exclude all installed dependencies and video
binaries. Dependency installation downloads upstream tools separately; do not
claim a blanket right to redistribute them. Follow the actual binary terms and
[FFmpeg guidance](https://ffmpeg.org/legal.html) for any future binary package.
