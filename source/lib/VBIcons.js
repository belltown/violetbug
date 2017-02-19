'use strict';

// Node.js modules
const path = require('path')

// Electron modules
const {nativeImage} = require('electron')

class VBIcons {
}

VBIcons.icon = null

if (process.platform === 'win32') {
  VBIcons.icon = path.join(__dirname, '..', 'images', 'icon.ico')
}
else {
  VBIcons.icon = nativeImage.createFromPath(
                             path.join(__dirname, '..', 'images', 'icon.png'))
}

module.exports  = VBIcons
