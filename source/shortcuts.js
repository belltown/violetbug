'use strict';
{ // <= Enclosing block to keep function names out of global namespace

  //
  // Main menu font selection settings dialog
  // Invoked from VBMenu.js
  //

  // Electron modules
  const {remote, ipcRenderer} = require('electron')

  // Local modules
  const VBConfig = require('./lib/VBConfig')

  // Read config data (to get current shortcuts)
  // The shortcuts module only READS the config data, never writing directly
  // When a shortcut is changed, an IPC message is sent to
  // the Main Process using ipcRenderer.send()
  // The Main Process will in turn send IPCs to the Renderer Processes
  // so they can update their shortcuts for any displayed connection tabs or
  // floating tabs
  const vbConfig = new VBConfig()
  const config = vbConfig.init()

  // Declare DOM shortcuts; assign in onLoad(), called when the DOM is loaded
  let shortcutList
  let okButton
  let cancelButton

  // Save the initial shortcuts in case the user clicks the Cancel button
  let shortcutListSave = JSON.stringify(config.shortcutList)

  // No need to release any resources - closing the window takes care of that
  function closeWindow() {
    remote.getCurrentWindow().close()
  }

  // Send the changed shortcuts to the Main Process when the
  // OK button is pressed so that any newly-created connection
  // tabs will get the up-to-date shortcuts when they read
  // the config file during their initialization
  function sendChangedShortcuts() {
    config.shortcutList = {}
    const nodeList = shortcutList.querySelectorAll('li')
    for (let i = 0; i < nodeList.length; i++) {
      const li = nodeList[i]
      const span = li.querySelector('span')
      const input = li.querySelector('input')
      config.shortcutList[span.textContent] = input.value
    }
    ipcRenderer.send('shortcutsChanged', JSON.stringify(config.shortcutList))
  }

  function sendSavedShortcuts() {
    ipcRenderer.send('shortcutsChanged', shortcutListSave)
  }

  // Initialize the shortcut list display from the config object
  // The shortcuts are stored in an associative array in config,
  // which is not guaranteed to be sorted, so sort then here
  function setShortcuts() {
    for (let key of Object.keys(config.shortcutList).sort()) {
      const li = document.createElement('LI')
      const span = document.createElement('SPAN')
      const input = document.createElement('INPUT')
      span.appendChild(document.createTextNode(key))
      input.value = config.shortcutList[key]
      input.spellcheck = false
      li.appendChild(span)
      li.appendChild(input)
      shortcutList.appendChild(li)
    }
  }

  // Event-handler for the OK button
  function onOKClick(e) {
    sendChangedShortcuts()
    closeWindow()
  }

  // Event-handler for Cancel button
  function onCancelClick(e) {
    sendSavedShortcuts()
    closeWindow()
  }

  // Document load event-handler
  function onLoad() {
    // Assign DOM element shortcuts
    shortcutList  = document.getElementById('shortcutList')
    okButton      = document.getElementById('okButton')
    cancelButton  = document.getElementById('cancelButton')

    // Register event-handlers
    okButton.addEventListener('click', onOKClick)
    cancelButton.addEventListener('click', onCancelClick)

    // Set shortcuts from the initial config object
    setShortcuts()
  }

  // Register the document load event-handler, fired when DOM is fully loaded
  addEventListener('load', onLoad)

}
