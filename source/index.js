'use strict';
{ // <= Enclosing block to keep function definitions out of global namespace

  // Local modules
  const VBDockPanel = require('./lib/VBDockPanel')

  // UI handler for the main dock, to be set up in the 'load' event handler
  let vbDockPanel = null

  // Event-handler that gets executed when the DOM is fully loaded
  function onLoad() {
    console.log('Node.js version:', process.versions.node)
    console.log('Electron version:', process.versions.electron)
    console.log('Chrome version:', process.versions.chrome)
    console.log('Versions: %O', process.versions)

    // Create the dock panel that will hold the list panel and
    // docked connection panels, etc.
    vbDockPanel = new VBDockPanel()

    // Render the list panel and tab header in the Dock Panel
    vbDockPanel.init()
  }

  // Don't do anything until the document is fully loaded
  addEventListener('load', onLoad)
}
