# Source releases

1. Run `npm ci` and `npm test` from the intended source checkout.
2. Run a clean-library browser walkthrough on the supported Mac/browser.
3. Run `npm run build:source`. The allowlist in `scripts/source-files.cjs`
   controls the ZIP and the files intended for the public Git repository.
4. Check the ZIP contains source, tests, docs and licence notices, with no
   `node_modules`, binaries, personal clips, LUTs, saved libraries or credentials.
5. Tag the reviewed commit and attach the source ZIP to its GitHub release.
   Remote publishing needs the owner's repository and authorization.

Do not publish the current downloaded Apple Silicon FFmpeg binary: its own
`ffmpeg -L` output says it contains nonfree parts and is not redistributable.
This release intentionally supplies source only; dependency installation
obtains video tools separately from their upstream providers. Other binary
builds have different terms. The npm wrapper's licence is not proof of the
binary's licence. Any future bundled/offline installer needs a separate binary
licence and corresponding-source review. See THIRD_PARTY.md.

Updating: stop LUT Buddy with Control+C, keep the existing library folder,
replace/update the source, then launch again. The launcher refuses to silently
reuse a service from an older source build. Database migrations keep a backup;
a library written by a newer schema version must not open in an older build.
Downgrades are not a promise: use a preserved backup and an appropriate version.

One service owns a library. Browser tabs may share that service. Distinct
libraries may run on distinct ports. After SIGKILL or a crash, the writer lock
can remain for up to one minute before safely expiring. Do not manually remove
a lock while another copy might still be using that library.

GitHub automatic checks run on each push. Confirm the run for the exact release
commit before publishing; a previous passing run does not establish a new build.
Another-computer testing is separate and remains deferred.
