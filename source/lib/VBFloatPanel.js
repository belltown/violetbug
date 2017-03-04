'use strict';

/*
 * Handle the panel containing the tab header, list panel and conn panels
 *
 */

// Electron modules
const {ipcRenderer, remote} = require('electron')

// Node.js modules
const path = require('path')

// Local modules
const VBConnPanel = require('./VBConnPanel')

// Performs a similar function to the DockPanel, just with a single connection
class VBFloatPanel {

  constructor(ip, port) {

    this.ip = ip
    this.port = port
    this.connId = 1

    // Create a new connection panel
    this.conn = new VBConnPanel(true, // isFloated
                                ip, port,
                                this.connId,
                                this.onConnUp.bind(this),
                                this.onConnDown.bind(this))

  }

  init() {

    // Initialize the connection panel
    this.conn.init()

    // Connection-specific event-handlers [from context menu]

    ipcRenderer.on('closeTab',     (e, connId) => this.doConn('closeTab'))
    ipcRenderer.on('logFile',      (e, connId) => this.doConn('logFile'))
    ipcRenderer.on('logResume',    (e, connId) => this.doConn('logResume'))
    ipcRenderer.on('logPause',     (e, connId) => this.doConn('logPause'))
    ipcRenderer.on('reConnect',    (e, connId) => this.doConn('reConnect'))
    ipcRenderer.on('unFloatTab',   (e, connId) => this.doConn('unFloatTab'))
    ipcRenderer.on('clearScreen',  (e, connId) => this.doConn('clearScreen'))
    ipcRenderer.on('clearLine',    (e, connId) => this.doConn('clearLine'))
    ipcRenderer.on('focusInput',   (e, connId) => this.doConn('focusInput'))
    ipcRenderer.on('findInPage',   (e, connId) => this.doConn('findInPage'))

  }

  // When a menu item pertaining to a connection is clicked,
  // dispatch to the appropriate connection object
  doConn(eventName) {

    // Check that the connection id was assigned a connection object
    if (this.conn) {
      // If the connection no longer exists, event handlers will throw
      try {
        // Handle the close event here; route all others to the conn object
        switch (eventName) {
          case 'closeTab':    return this.onConnTabClose()
          case 'unFloatTab':  return this.onUnFloatTab()
          case 'logFile':     return this.conn.onLogFile()
          case 'logResume':   return this.conn.onLogResume()
          case 'logPause':    return this.conn.onLogPause()
          case 'reConnect':   return this.conn.onReConnect()
          case 'clearScreen': return this.conn.onClearScreen()
          case 'clearLine':   return this.conn.onClearLine()
          case 'focusInput':  return this.conn.onFocusInput()
          case 'findInPage':  return this.conn.onFindInPage()
        }
      }
      catch(e) {
        console.log('Exception in VBFloatPanel.doConn', e)
      }
    }
  }

  // The context menu will cause an unFloatTab IPC to be sent to
  // the Float Panel, in response to which the connection should
  // be terminated and the Float Panel should quit.
  // The Dock Panel will establish a new connection in the dock
  // in response to a separate IPC sent to the Dock Panel
  onUnFloatTab() {
    // Close the FloatPanel
    this.terminate()
  }

  // Context-menu 'close-handler'
  onConnTabClose() {
    this.terminate()
  }

  // Close the float panel
  terminate() {
    // Terminate the connection and dispose of the socket object
    this.conn.terminate()

    // Dereference the conn panel object
    this.conn = null

    // Close the window, freeing any remaining resources
    remote.getCurrentWindow().close()
  }

  // When the connection is up, the window title should be ip:port
  onConnUp() {
    const win = remote.getCurrentWindow()
    win.setTitle(this.ip + ':' + this.port)
  }

  // When the connection is down, append [Not Connected] to window title
  onConnDown() {
    const win = remote.getCurrentWindow()
    win.setTitle(this.ip + ':' + this.port + ' [Not Connected]')
  }

}

function ConnInfo(conn) {
  this.conn = conn
  this.tabIp = null
  this.headerPanel = null
}

module.exports  = VBFloatPanel
