'use strict';
/*
 * Handle the connection panel and socket for the connection.
 * Handles either a docked or a floated connection panel
 */

// Node.js modules
const os = require('os')
const StringDecoder = require('string_decoder').StringDecoder

// Electron modules
const {remote, ipcRenderer} = require('electron')

// Local modules
const VBLog = require('./VBLog')
const VBKeys = require('./VBKeys')
const VBMenu = require('./VBMenu')
const VBSocket = require('./VBSocket')
const VBConfig = require('./VBConfig')
const VBHistory = require('./VBHistory')

class VBConnPanel {

  constructor(isFloated,
              ip, port,
              connId, connUpCallback, connDownCallback) {

    // Instantiate a VBConfig object
    // Note that in each Renderer Process, the config data is read from
    // disk at startup, maintained locally while the program runs,
    // but NOT written to disk on shutdown
    // Only the VBConfig object maintained by the Main Process is
    // saved to disk upon shutdown
    // Therefore, any config changes made in a Renderer that need to be
    // persisted must be communicated to the Main process using IPCs
    this.vbConfig = new VBConfig()

    // Read the config data, getting a reference to the JSON config info
    this.config = this.vbConfig.init()

    if (!this.config) {
      ipcRenderer.send('fatal-error-dialog', 'Unable to read config file')
    }

    // true if a floated tab
    this.isFloated = isFloated

    // History object
    this.vbHistory = new VBHistory()

    // IP address (string)
    this.ip = ip

    // Port (integer)
    this.port = port

    // Connection identifier (used to match context menu IPCs)
    this.connId = connId

    // Callback used when a connection succeeds
    this.connUpCallback = connUpCallback

    // Callback used when a connection terminates
    this.connDownCallback = connDownCallback

    // Logging object
    this.vbLog = new VBLog(this)

    // VBSocket object for connection with the client device
    this.vbSocket = null

    // DOM element for connection panels' container
    this.connContainer = null

    // DOM element for output field
    this.deviceOutputPanel = null

    // DOM element for device output scroll panel
    this.deviceOutputPanelScroll = null

    // DOM element for input field
    this.deviceInputPanel = null

    // DOM element for the user's input field
    this.deviceInputText = null

    // DOM element for the input prompt
    this.promptText = null

    // DOM element for this connection's page
    // (the .connPage class within the #tabContentContainer div)
    this.connPage = null

    // Queue packets of socket Buffer data
    // Packets will be dequeud and processed when the animation timer expires
    this.packetList = new PacketList()

    // Use an animation timer to check the packet list for new data packets
    this.animationTimer = null

    // Count the number of \n-terminated output lines
    this.outputLineCount = 0

    // Array to keep track of the number of lines in each data packet
    this.linesPerPacket = []

    // Keep track of whether the previously output line was terminated
    this.lastOutputChar = ''

    // The last DOM element containing text (<pre> element)
    this.lastDOMTextNode = null
    this.lastDOMTextContent = ''

    // Set up event handlers, making sure their contexts are set to
    // the current instance of this VBConnPanel class
    this.onAutoScrollChanged = this._onAutoScrollChanged.bind(this)
    this.onAutoWrapChanged = this._onAutoWrapChanged.bind(this)
    this.onFontFamilyChanged = this._onFontFamilyChanged.bind(this)
    this.onFontSizeChanged = this._onFontSizeChanged.bind(this)
    this.onBgColorChanged = this._onBgColorChanged.bind(this)
    this.onFgColorChanged = this._onFgColorChanged.bind(this)
    this.onShortcutsChanged = this._onShortcutsChanged.bind(this)
  }

  init() {

    // Set up the connection's UI DOM elements
    this.setupConnectionUI()

    // Application-wide event-handlers [from app menu and/or context menu]
    // Each connection in the Renderer process handles each of these events

    ipcRenderer.on('autoScrollChanged', this.onAutoScrollChanged)
    ipcRenderer.on('autoWrapChanged',   this.onAutoWrapChanged)
    ipcRenderer.on('fontFamilyChanged', this.onFontFamilyChanged)
    ipcRenderer.on('fontSizeChanged',   this.onFontSizeChanged)
    ipcRenderer.on('bgColorChanged',    this.onBgColorChanged)
    ipcRenderer.on('fgColorChanged',    this.onFgColorChanged)
    ipcRenderer.on('shortcutsChanged',  this.onShortcutsChanged)

    // Set up a VBSocket object for the connection
    this.vbSocket = this.doCreateSocket()

  }

  // De-allocate resources to avoid memory leaks
  terminate() {
    // Destroy the socket
    this.doTerminateSocket()

    // Cancel the animation timer to stop checking the packet list
    if (this.animationTimer !== null) {
      try {
        this.cancelAnimationFrame(this.animationTimer)
      }
      catch (ex) {
        console.log('Exception in cancelAnimationFrame', ex)
      }
      this.animationTimer = null
    }

    // Clear the packet queue
    this.packetList = null

    // Terminate logging
    this.vbLog.close()
    this.vbLog = null

    // Remove IPC event listeners
    ipcRenderer.removeListener('autoScrollChanged', this.onAutoScrollChanged)
    ipcRenderer.removeListener('autoWrapChanged', this.onAutoWrapChanged)
    ipcRenderer.removeListener('fontFamilyChanged', this.onFontFamilyChanged)
    ipcRenderer.removeListener('fontSizeChanged', this.onFontSizeChanged)
    ipcRenderer.removeListener('bgColorChanged', this.onBgColorChanged)
    ipcRenderer.removeListener('fgColorChanged', this.onFgColorChanged)
    ipcRenderer.removeListener('shortcutsChanged', this.onShortcutsChanged)

    // Deallocate DOM resources
    while (this.connPage.firstChild) {
      this.connPage.removeChild(this.connPage.firstChild)
    }
    if (this.connPage.parentNode) {
      this.connPage.parentNode.removeChild(this.connPage)
    }
    this.connPage = null
  }

  doCreateSocket() {

    // Set up a VBSocket object for the connection
    const vbSocket = new VBSocket(this.ip, this.port)

    // Register socket callbacks
    vbSocket.registerDataCallback(this.socketDataCallback.bind(this))
    vbSocket.registerConnectCallback(this.socketConnectCallback.bind(this))
    vbSocket.registerCloseCallback(this.socketCloseCallback.bind(this))
    vbSocket.registerErrorCallback(this.socketErrorCallback.bind(this))
    vbSocket.registerTimeoutCallback(this.socketTimeoutCallback.bind(this))

    // Create the socket and connect to the ip and port
    vbSocket.setupConnectionSocket()

    return vbSocket

  }

  doTerminateSocket() {

    this.vbSocket.terminate()
    this.vbSocket = null

  }

  setupConnectionUI() {

    //-------------------------------------
    // Set up html for a new connection ...
    //-------------------------------------

    // Create html panel for a new connection by cloning the stub
    this.connPage = document.getElementById('conn-stub').cloneNode(true)

    // Make sure we don't have duplicate ids
    this.connPage.setAttribute('id', 'connPage-' + this.connId)

    // Add the context-menu (right-click) handler for the connection tab
    this.connPage.addEventListener('contextmenu', e => {
      // Disable the system right-click functionality (possibly not necessary)
      e.preventDefault()
      // Display the context menu
      this.doContextMenu()
    })

    // Save DOM references
    this.connContainer = document.getElementById('connContainer')
    this.deviceOutputPanelScroll = this.connPage
                                  .querySelector('.deviceOutputPanelScroll')
    this.deviceOutputPanel = this.connPage.querySelector('.deviceOutputPanel')
    this.deviceInputPanel = this.connPage.querySelector('.deviceInputPanel')
    this.deviceInputText = this.connPage.querySelector('.deviceInputText')
    this.promptText = this.connPage.querySelector('.promptText')

    // Add the new connection panel to the tab container
    connContainer.appendChild(this.connPage)

    // Set font from the config values
    this.setFontFamily(this.config.fontFamily)
    this.setFontSize(this.config.fontSize)

    // Set colors from the config values
    this.setFgColors(this.config.foregroundColor)
    this.setBgColors(this.config.backgroundColor)

    // Set wrapping from current config state
    this.deviceOutputPanel.style.whiteSpace = this.config.autoWrap ? 'pre-wrap'
                                                                   : 'pre';

    // Make the new connection html panel visible
    this.connPage.style.display = 'table'

    this.connContainer.style.display = 'block'

    this.deviceInputText.addEventListener('keydown', e => {
      this.onKeydown.call(this, e)
    })

    document.addEventListener('keydown', e => {
      this.onConnKeydown.call(this, e)
    })

    // DOM event-handler to scroll to end on window resize
    // Throttle the event-handling to half-second intervals
    let resizeTimeout = null
    addEventListener('resize', e => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = setTimeout(() => this.doScrollToEnd(), 500)
    })

    // Put the cursor in the input box
    this.deviceInputText.focus()
  }

  // Make the connection panel visible
  displayConnTab() {
    // Display this connection's tab
    this.connPage.style.display = 'table'

    // Set the keyboard focus to the tab's input field
    this.deviceInputText.focus()

    // Scroll to end, if required
    this.doScrollToEnd()
  }

  // Append a packet of output data to the deviceOutputPanel display area
  // A single packet may contain multiple lines (\n)
  // It appears that using tables rather than <div> or <pre>
  // elements for the output data is astonishingly faster
  appendPacket(packet) {
    // Log the data
    this.vbLog.write(packet)

    // Count number of \n characters in this data packet
    const ma = packet.match(/\n/g)
    const lineCount = ma ? ma.length : 0

    // Keep track of how many total lines we have
    this.outputLineCount += lineCount

    // Chrome renderng optimization - update display while hidden
    const disp = this.connPage.style.display
    this.connPage.style.display = 'none'

    // Remove packets until line count does not exceed our limit,
    // but only if autoScroll is set, otherwise if the user has turned off
    // autoScroll and paged back to look at a particular area, then the
    // display may jump around as earlier data is pruned
    if (this.config.autoScroll) {
      while (this.outputLineCount > this.config.maxOutputNodes) {
        let linesInPacket = this.linesPerPacket.shift()
        if (this.deviceOutputPanel.firstChild) {
          this.deviceOutputPanel.removeChild(this.deviceOutputPanel.firstChild)
        }
        this.outputLineCount -= linesInPacket
      }
    }

    // If the previously-written output line was not \n-terminated,
    // then append this packet to the previous <tr>,
    // otherwise create a new <tr> for the packet
    // Add the new packet to the output pane
    if (this.lastOutputChar !== '\n' && this.lastDOMTextNode) {
      this.lastDOMTextContent += packet
      this.lastDOMTextNode.nodeValue = this.lastDOMTextContent
      const prevPacketLines = this.linesPerPacket.pop()
      this.linesPerPacket.push(prevPacketLines + lineCount)
    }
    else {
      const tr = document.createElement('TR')
      const td = document.createElement('TD')
      const pre = document.createElement('PRE')
      this.lastDOMTextContent = packet.slice(0)
      this.lastDOMTextNode = document.createTextNode(packet)
      pre.appendChild(this.lastDOMTextNode)
      td.appendChild(pre)
      tr.appendChild(td)
      this.deviceOutputPanel.appendChild(tr)
      this.linesPerPacket.push(lineCount)
    }

    this.lastOutputChar = packet.slice(-1)

    this.connPage.style.display = disp

    this.doScrollToEnd()
  }

  // Called whenever any data is received from the socket
  // Because of how sockets work, transmissions from the device may be
  // split across packets
  // A StreamDecoder is used to ensure that when data is returned to
  // the caller, there are no split multi-byte UTF-8 characters
  // However lines ending in \r\n may be split across packets;
  // however, using <pre> elements for the data takes care of that
  packetDequeue() {
    const data = this.packetList.remove()
    if (data !== '') {
      this.appendPacket(data)
    }

    // Only re-start the animation timer if there is more data in the queue
    if (this.packetList.isEmpty()) {
      this.animationTimer = null
    }
    else {
      this.animationTimer = window.requestAnimationFrame(
                                  (timestamp) => this.packetDequeue())
    }
  }

  // Put the Buffer received from the socket onto a packet queue
  // If the animation frame timer is not running then start it
  // so that packet-handled is throttled to not exceed animation
  // frame limits
  socketDataCallback(buffer) {
    this.packetList.add(buffer)
    if (this.animationTimer === null) {
      this.animationTimer = window.requestAnimationFrame(
                                  (timestamp) => this.packetDequeue())
    }
  }

  socketConnectCallback() {
    this.connUpCallback(this.connId)
  }

  socketCloseCallback() {
    this.connDownCallback(this.connId)
  }

  socketErrorCallback() {
    this.connDownCallback(this.connId)
  }

  socketTimeoutCallback() {
    this.connDownCallback(this.connId)
  }

  // Clear screen context menu command or Alt/C key
  clearScreen() {
    while (this.deviceOutputPanel.firstChild) {
      this.deviceOutputPanel.removeChild(this.deviceOutputPanel.firstChild)
    }
    // Zero the output line totals
    this.outputLineCount = 0
    this.linesPerPacket = []
    this.lastDOMTextContent = ''
    this.lastDOMTextNode = null
  }

  // Clear line context menu commane or Esc key
  clearLine() {
    this.deviceInputText.value = ''
  }

  // connPage keydown handler
  // This handler is specifically to handle to clear line/clean screen keys
  // if the cursor is not positioned in the deviceInputText field
  // It is attached to the document therefore it is necessary to check
  // whether this is the currently displayed tab or not
  onConnKeydown(e) {
    if (this.connPage && this.connPage.style.display !== 'none') {
      const keyVal = VBKeys.keyVal(e)
      switch (keyVal) {
        case VBKeys.ALTC:
          this.clearScreen()
          break
        case VBKeys.ESCAPE:
          this.clearLine()
          break
      }
    }
  }

  // deviceInputText keydown event listener
  onKeydown(e) {
    // Get the user's input text
    const input = this.deviceInputText.value

    // Get the input key value
    const keyVal = VBKeys.keyVal(e)

    // Handle command history and tab completion
    const histNext = this.vbHistory.keydown(keyVal, input)

    switch (keyVal) {

      // Check if enter key pressed
      case VBKeys.ENTER:
        // Write the input data to the TCP socket
        if (this.vbSocket) {
          this.vbSocket.write(input + '\r\n')
        }

        // Echo user input to the output display
        this.appendPacket(input + '\r\n')

        // Clear the input field
        this.clearLine()
        break

      // Check if break key (ctrl-c) pressed
      case VBKeys.CTRLC:
        // Echo "Break!!!" to the output display
        this.appendPacket('Break!!!\r\n')

        // Write ETX character to TCP socket to signal a break
        if (this.vbSocket) {
          this.vbSocket.write('\x03')
        }
        break

      // Check if clear line key (esc) pressed
      case VBKeys.ESCAPE:
        this.clearLine()
        break

      // Check if clear screen (alt-c) pressed
      case VBKeys.ALTC:
        this.clearScreen()
        break

      // Check for shortcut keys
      case VBKeys.CTRL0:
        this.insertShortcutText(this.config.shortcutList['Ctrl-0'])
        break
      case VBKeys.CTRL1:
        this.insertShortcutText(this.config.shortcutList['Ctrl-1'])
        break
      case VBKeys.CTRL2:
        this.insertShortcutText(this.config.shortcutList['Ctrl-2'])
        break
      case VBKeys.CTRL3:
        this.insertShortcutText(this.config.shortcutList['Ctrl-3'])
        break
      case VBKeys.CTRL4:
        this.insertShortcutText(this.config.shortcutList['Ctrl-4'])
        break
      case VBKeys.CTRL5:
        this.insertShortcutText(this.config.shortcutList['Ctrl-5'])
        break
      case VBKeys.CTRL6:
        this.insertShortcutText(this.config.shortcutList['Ctrl-6'])
        break
      case VBKeys.CTRL7:
        this.insertShortcutText(this.config.shortcutList['Ctrl-7'])
        break
      case VBKeys.CTRL8:
        this.insertShortcutText(this.config.shortcutList['Ctrl-8'])
        break
      case VBKeys.CTRL9:
        this.insertShortcutText(this.config.shortcutList['Ctrl-9'])
        break

      }

    // Update the input field if navigating through the history buffer
    if (histNext !== null) {
      // The call to history.keydown() gave us the next history item
      this.deviceInputText.value = histNext
      // Make sure the caret stays at the end of the line
      e.preventDefault()
    }

  }

  // Insert shortcut text replace the current highlighted input text,
  // or inserting at the current caret position if no text highlighted
  insertShortcutText(shortcutText) {
    const oldText   = this.deviceInputText.value
    const selStart  = this.deviceInputText.selectionStart
    const selEnd    = this.deviceInputText.selectionEnd
    const preText   = oldText.substring(0, selStart)
    const postText  = oldText.substring(selEnd)
    this.deviceInputText.value          = preText + shortcutText + postText
    this.deviceInputText.selectionStart = selStart + shortcutText.length
    this.deviceInputText.selectionEnd   = this.deviceInputText.selectionStart
  }

  // Context (right-click) menu for a connection
  // This handler is attached the connection's input/output panel
  doContextMenu() {
    // Set up the connection's context menu handler
    const menu = VBMenu.createContextMenu(this.connId, this.ip, this.port)

    // Set the content menu items appropriately
    menu.items[VBMenu.RESUME_LOGGING].enabled = this.vbLog.canResume()
    menu.items[VBMenu.PAUSE_LOGGING].enabled  = this.vbLog.canPause()
    menu.items[VBMenu.FLOAT_TAB].visible      = !this.isFloated
    menu.items[VBMenu.UNFLOAT_TAB].visible    = this.isFloated
    menu.items[VBMenu.AUTO_SCROLL].checked    = this.config.autoScroll
    menu.items[VBMenu.AUTO_WRAP].checked      = this.config.autoWrap

    // Display the pop-up menu on the currenty-focused BrowserWindow
    menu.popup()
  }

  // Context menu event listener for 'Log file ...'
  onLogFile() {
    this.vbLog.logFile(this.config)
  }

  // Context menu event listener for 'Resume logging'
  onLogResume() {
    this.vbLog.resume()
  }

  // Context menu event listener for 'Pause logging'
  onLogPause() {
    this.vbLog.pause()
  }

  // Context menu event listener for re-connect
  onReConnect() {
    // To re-connect to a device, simply destroy the existing VBSocket
    // object, and thus the underlying Node.js socket object, then
    // create a new VBSocket
    // Assume that when the VBSocket object is destroyed, a
    // [FIN, ACK] packet will be sent to the device
    if (this.vbSocket) {
      this.vbSocket.terminate()
    }
    this.vbSocket = this.doCreateSocket()
  }

  // Close tab event listener (for app menu, context menu, and close button)
  onCloseTab() {
    this.terminate()
  }

  // Main menu/context menu event listener for Clear Screen
  onClearScreen() {
    this.clearScreen()
  }

  // Main menu/context menu event listener for Clear Line
  onClearLine() {
    this.clearLine()
  }

  // Event listener for Auto Scroll checkbox
  _onAutoScrollChanged(e, state) {
    this.config.autoScroll = state

    // Scroll to end if auto-scroll has been turned on
    if (state) {
      this.doScrollToEnd()
    }
  }

  // Event listener for Auto Wrap checkbox
  _onAutoWrapChanged(e, state) {
    this.config.autoWrap = state

    // Wrap or nowrap as appropriate
    this.doWrap(state)

    // Scroll to end if auto-scroll in effect, since turning on
    // wrapping may result in more output lines displayed
    if (this.config.autoScroll) {
      this.doScrollToEnd()
    }
  }

  setFgColors(color) {
    this.connContainer.style.color = color
  }

  setBgColors(color) {
    this.connContainer.style.backgroundColor = color
  }

  _onFgColorChanged(e, color) {
    this.setFgColors(color)
  }

  _onBgColorChanged(e, color) {
    this.setBgColors(color)
  }

  setFontFamily(family) {
    this.connContainer.style.fontFamily = family
  }

  setFontSize(size) {
    this.connContainer.style.fontSize = size
  }

  _onFontFamilyChanged(e, family) {
    this.setFontFamily(family)
  }

  _onFontSizeChanged(e, size) {
    this.setFontSize(size)
  }

  _onShortcutsChanged(e, shortcutsJson) {
    this.config.shortcutList = JSON.parse(shortcutsJson)
  }

  // Scroll to the end
  doScrollToEnd() {
    if (this.config.autoScroll) {
      this.deviceOutputPanelScroll.scrollTop =
                              this.deviceOutputPanelScroll.scrollHeight
    }
  }

  // Set each .deviceOutputPanel element to pre-wrap (wrap) if
  // autoWrap is true, else pre (nowrap) if autoWrap is false
  doWrap(state) {
    for (let item of document.getElementsByClassName('deviceOutputPanel')) {
      item.style.whiteSpace = this.config.autoWrap ? 'pre-wrap' : 'pre';
    }
  }

}

/****************************************************************************/

// Single linked-list of Buffer objects received by the socket
// Raw binary Buffer objects containing data received from the socket
// are stored, rather than UTF-8 character-encoded data
// The buffers are decoded as they are dequeued
class PacketList {
  constructor() {
    this.decoder = new StringDecoder('utf8')
    this.head = null
    this.tail = null
  }

  // Return true if there are no more Buffer objects queued
  isEmpty() {
    return this.head === null
  }

  // Add a new Buffer node (enqueue) to the head of the linked list
  add(packet) {
    const node = new PacketNode(packet)
    if (this.head === null) {
      this.head = node
    }
    else {  // this.tail !== null
      this.tail.next = node
    }
    this.tail = node
  }

  // Remove a Buffer node (dequeue) from the head of the linked list
  remove() {
    if (this.head !== null) {
      const node = this.head
      this.head = node.next
      if (this.head === null) {
        this.tail = null
      }
      return this.decoder.write(node.data)
    }
    else {
      return ''
    }

  }
}

// PacketList node
class PacketNode {
  constructor(packet) {
    this.data = packet
    this.next = null
  }
}

module.exports = VBConnPanel
