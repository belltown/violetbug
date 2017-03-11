'use strict';
{ // <= Enclosing block to keep function names out of global namespace

  //
  // Main menu ports settings dialog
  // Invoked from VBMenu.js
  //

  // Electron modules
  const {remote, ipcRenderer} = require('electron')

  // Local modules
  const VBConfig = require('./lib/VBConfig')

  // Read config data (to get current ports)
  // The ports module only READS the config data, never writing directly
  // When a port is changed, an IPC message is sent to
  // the Main Process using ipcRenderer.send()
  // The Main Process will in turn send IPCs to the Renderer Processes
  // so they can update their ports for any displayed connection tabs or
  // floating tabs
  const vbConfig = new VBConfig()
  const config = vbConfig.init()

  // Declare DOM shortcuts; assign in onLoad(), called when the DOM is loaded
  let portError
  let portList
  let addButton
  let okButton
  let cancelButton

  // No need to release any resources - closing the window takes care of that
  function closeWindow() {
    remote.getCurrentWindow().close()
  }

  // Send the changed ports to the Main Process when the
  // OK button is pressed so that any newly-created connection
  // tabs will get the up-to-date ports when they read
  // the config file during their initialization
  function sendChangedPorts() {
    config.portList = {}
    for (let i = 0; i < portList.children.length; i++) {
      const item = portList.children[i]
      if (item.tagName === 'LI') {
        const portInput = item.querySelector('.portNumber')
        const descriptionInput = item.querySelector('.portDescription')
        const port = (portInput && portInput.value) || ''
        const description = (descriptionInput && descriptionInput.value) || ''
        if (port) {
          config.portList[port] = description
        }
      }
    }
    ipcRenderer.send('portListChanged', JSON.stringify(config.portList))
  }

  // Event-handler for the OK button
  function onOKClick(e) {
    if (validatePorts()) {
      sendChangedPorts()
      closeWindow()
    }
  }

  // Event-handler for Cancel button
  function onCancelClick(e) {
    closeWindow()
  }

  // Event-handler for the Add button
  function onAddClick(e) {
    // Create a new, blank port entry for user input of a new port
    const portEntry = makePortEntry('', '')
    // Insert the new entry to the end of the port list
    portList.appendChild(portEntry, portList.firstChild)
    // Focus on the Port input field in the entry that was just added
    portEntry.firstChild.focus()
  }

  // Check that the supplied DOM element is a valid port
  function validPortInput(portInput) {
    let errorMessage = ''
    const portValue = portInput.value.trim()

    // Get the port's description
    let descriptionValue = ''
    const li = portInput.closest('LI')
    if (li) {
      const descriptionInput = li.querySelector('.portDescription')
      descriptionValue = (descriptionInput && descriptionInput.value) || ''
    }

    // A port is considered valid if both the port and description are blank
    if (portValue !== '' || descriptionValue !== '') {
      if (!portValue.match(/^\d+$/)) {
        errorMessage = 'Port may only contain digits'
      }
      else {
        const portNumber = parseInt(portValue, 10)
        if (Number.isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
          errorMessage = 'Port must be between 1 and 65535'
        }
      }
    }

    return errorMessage
  }

  // Validate all entered ports, either when a port value has been modified,
  // or the OK button is pressed to commit any changes
  function validatePorts() {
    let valid = true
    let portErrorDisplayed = ''

    // Validate each port entry
    const queryList = portList.querySelectorAll('.portNumber')
    for (let i = 0; i < queryList.length; i++) {
      const portInput = queryList[i]
      const errorMessage = validPortInput(portInput)
      if (errorMessage !== '') {
        valid = false
        // Highlight the erroneous port
        portInput.classList.add('invalidPort')
        // Only display the first error message
        if (portErrorDisplayed === '') {
          portErrorDisplayed = errorMessage
        }
      }
      else {
        portInput.classList.remove('invalidPort')
      }
    }

    // Remove any existing error message
    while (portError.firstChild) {
      portError.removeChild(portError.firstChild)
    }

    // If we have an error, display it
    if (portErrorDisplayed !== '') {
      portError.appendChild(document.createTextNode(portErrorDisplayed))
    }

    return valid
  }

  // When a value in one port has been changed, validate all entered ports
  // This allows us to check for blank ports, whch are invalid if they
  // have a description associated with them
  function onInput(e) {
    validatePorts()
  }

  // Delete button click event handler
  function onDeleteClick(e) {
    const deleteButton = e.target
    if (deleteButton) {
      const li = deleteButton.closest('LI')
      if (li) {
        portList.removeChild(li)
      }
    }
    // Need to revalidate ports to remove any error message that may
    // apply to the deleted port
    validatePorts()
  }

  // Create a port entry consisting of port (inout text field),
  // description (input text field) and a delete button for that entry
  function makePortEntry(portValue, descriptionValue) {
    const li = document.createElement('LI')

    const portInput = document.createElement('INPUT')
    portInput.className = 'portNumber'
    portInput.value = portValue
    portInput.addEventListener('input', onInput)
    li.appendChild(portInput)

    const descriptionInput = document.createElement('INPUT')
    descriptionInput.className = 'portDescription'
    descriptionInput.value = descriptionValue
    descriptionInput.addEventListener('input', onInput)
    li.appendChild(descriptionInput)

    const deleteIcon = document.createElement('DIV')
    deleteIcon.className = 'deleteIcon'
    deleteIcon.title = 'Delete port'
    deleteIcon.addEventListener('click', onDeleteClick)
    li.appendChild(deleteIcon)

    return li
  }

  // Initialize the port list display from the config object
  // The ports are stored in an associative array in config,
  // which is not guaranteed to be sorted, so sort them here
  function setPortList() {
    // Fill in the port entries from the config object
    for (let port of Object.keys(config.portList).sort()) {
      portList.appendChild(makePortEntry(port, config.portList[port]))
    }

    // Add a blank port entry in the last row
    const blankPortEntry = makePortEntry('', '')
    portList.appendChild(blankPortEntry)

    // Focus on the port input field in the blank entry
    blankPortEntry.firstChild.focus()
  }

  // Document load event-handler
  function onLoad() {
    // Assign DOM element shortcuts
    portError     = document.getElementById('portError')
    portList      = document.getElementById('portList')
    addButton     = document.getElementById('addButton')
    okButton      = document.getElementById('okButton')
    cancelButton  = document.getElementById('cancelButton')

    // Register event-handlers
    addButton   .addEventListener('click', onAddClick)
    okButton    .addEventListener('click', onOKClick)
    cancelButton.addEventListener('click', onCancelClick)

    // Set ports from the initial config object
    setPortList()

    // Just in case there's an invalid port number already in the config file
    validatePorts()
  }

  // Register the document load event-handler, fired when DOM is fully loaded
  addEventListener('load', onLoad)

}
