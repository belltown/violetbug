## Build Instructions

- These build instructions are only necessary if you wish to build your own version of VioletBug after changing the source code
- All builds are for 64-bit systems
- Building is controlled by the source/package.json file

#### Build setup

- Install node.js and npm by following the instructions on https://nodejs.org
- Change into the directory that will contain the violetbug project directory: `cd violetbug`
- Clone the GitHub repository: `git clone https://github.com/belltown/violetbug`
- Change into the `source` directory: `cd violetbug/source`
- Install the npm packages: `npm install` [Note that the development dependency versions listed in package.json are specified as fixed version numbers. Change these if you want more up-to-date versions]
- Run violetbug: `npm start`

#### Building from source (only required if generating binary zip files)

*All builds must be run from the `violetbug/source` directory.*

|||
|---|---
|`npm run build-mac`    | Run on **linux or macOS** to generate `/builds/mac`
| `npm run build-linux` | Run on **linux or macOS** to generate `/builds/linux`
| `npm run build-win`   | Run on **Windows** to generate `/builds/win`

#### Generating binary zip files (run on linux or macOS - not on Windows)

*All zips must be run from the `violetbug/source` directory, and require the corresponding build step above to have been run.*

|||
|---|---
| `npm run zip-mac`   | To generate `/dist/violetbug-mac.zip`
| `npm run zip-linux` | To generate `/dist/violetbug-linux.zip`
| `npm run zip-win`   | To generate `/dist/violetbug-win.zip`

#### Generating installers (does not require build from source or binary zip files)

*Ideally, generate the installer from the target system you are generating the installer for.*

There is no installer implemented for macOS. For macOS, use the build/zip mechanism above.

The following commands are available to generate installers in `/dist`:

||
|---
| `npm run dist-appimage`
| `npm run dist-deb`
| `npm run dist-rpm`
| `npm run dist-freebsd`
| `npm run dist-tarxz`
| `npm run dist-win`
