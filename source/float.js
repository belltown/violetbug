'use strict';
{ // <= Enclosing block to keep function names out of global namespace

  // Electron modules
  const {remote} = require('electron')

  // Local modules
  const VBFloatPanel = require('./lib/VBFloatPanel')

  // UI handler for the main dock, to be set up in the 'load' event handler
  let vbFloatPanel = null

  // Event-handler that gets executed when the DOM is fully loaded
  function onLoad() {
    // Extract the ip address and port from the native window title
    const ipAndPort = remote.getCurrentWindow().getTitle()
    const ip = ipAndPort.substr(0, ipAndPort.indexOf(':'))
    const port = parseInt(ipAndPort.substring(ipAndPort.indexOf(':') + 1), 10)

    // Create the floating dock panel that will hold the list panel and
    // docked connection panels, etc.
    vbFloatPanel = new VBFloatPanel(ip, port)
    vbFloatPanel.init()
  }

  // Run onload() when the document is fully loaded
  addEventListener('load', onLoad)
}
