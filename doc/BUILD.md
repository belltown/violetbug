## Build Instructions

- These build instructions are only necessary if you wish to build your own version of VioletBug after changing the source code
- All builds are for 64-bit systems
- Building is controlled by the source/package.json file

#### NPM versus Yarn

These build instructions use Yarn rather than NPM (Node Package Manager) for building VioletBug and its distributables.

Yarn is newer, faster, and better than NPM. Yarn was chosen because NPM may generate warnings and/or errors as described in this issue: https://github.com/electron-userland/electron-builder/issues/1344. Read more about Yarn and how it addresses NPM's inadequacies here: https://code.facebook.com/posts/1840075619545360.

If you really want to use NPM rather than Yarn, then replace all references to "yarn" in these build instructions with "npm". Note that you may also need to include in the package.json devDependencies section, a dependency for "ajv" of ">=5.0.3-beta.0" (or whatever version is denoted in the NPM error message as a missing peer dependency for ajv-keywords).


#### Build setup

- Install node.js (and NPM) by following the instructions on https://nodejs.org
- Install Yarn by following the instructions on https://yarnpkg.com/en/docs/install
- Change into the directory that will contain the VioletBug project directory: `cd violetbug`
- Clone the GitHub repository: `git clone https://github.com/belltown/violetbug`
- Change into the `source` directory: `cd violetbug/source`
- Install the NPM packages: `yarn install` [Note that the development dependency versions listed in package.json are specified as fixed version numbers. Change these if you want more up-to-date versions]
- Run VioletBug: `yarn start`

#### Building from source (only required if generating binary zip files)

*All builds must be run from the `violetbug/source` directory.*

*If using Yarn, you can use `yarn xxxx` instead of `yarn run xxxx`*.

| | |
|---|---
| `yarn run build-mac`   | Run on **linux or macOS** to generate `/builds/mac`
| `yarn run build-linux` | Run on **linux or macOS** to generate `/builds/linux`
| `yarn run build-win`   | Run on **Windows** to generate `/builds/win`

#### Generating binary zip files (run on linux or macOS - not on Windows)

*All zips must be run from the `violetbug/source` directory, and require the corresponding build step above to have been run.*

| | |
|---|---
| `yarn run zip-mac`   | To generate `/dist/violetbug-mac.zip`
| `yarn run zip-linux` | To generate `/dist/violetbug-linux.zip`
| `yarn run zip-win`   | To generate `/dist/violetbug-win.zip`

#### Generating installers (does not require build from source or binary zip files)

*Ideally, generate the installer from the target system you are generating the installer for.*

There is no installer implemented for macOS. For macOS, use the build/zip mechanism above.

The following commands are available to generate installers in `/dist`:

| |
|---
| `yarn run dist-appimage`
| `yarn run dist-deb`
| `yarn run dist-rpm`
| `yarn run dist-win`
