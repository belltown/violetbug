'use strict';

/*
 * Handle the panel containing the tab header, list panel and conn panels
 *
 */

// Electron modules
const {ipcRenderer} = require('electron')

// Local modules
const VBConfig = require('./VBConfig')
const VBListPanel = require('./VBListPanel')
const VBConnPanel = require('./VBConnPanel')

class VBDockPanel {

  constructor() {

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

    console.log('Using config file:', this.config.configPath)

    // The List Panel allows the user to choose a device to connect to
    // The onConnect callback is called whenever there is a new
    // connection to be made
    this.listPanel = new VBListPanel(this.onConnect.bind(this))

    // Keep track of the next connId to be assigned
    this.nextConnId = 0

    // Keep track of all connections
    // The connection map is indexed on connId,
    // with values of type ConnInfo
    this.connInfoList = new Map()

    // Keep track of the currently displayed connection object
    this.selectedConn = null

    // DOM shortcuts
    this.deviceListPage = null
    this.tabAdd = null
    this.tabStub = null
    this.tabHeader = null
    this.tabContentContainer = null
    this.connectButton = null
    this.connContainer = null
  }

  // Initialize the List Panel
  // When the List Panel detects that a new connection should be made,
  // it invokes the connect callback
  init() {

    this.listPanel.init()

    // Assign DOM shortcuts
    this.deviceListPage       = document.getElementById('deviceListPage')
    this.tabAdd               = document.getElementById('tabAdd')
    this.tabStub              = document.getElementById('tabStub')
    this.tabHeader            = document.getElementById('tabHeader')
    this.tabContentContainer  = document.getElementById('tabContentContainer')
    this.connectButton        = document.getElementById('connectButton')
    this.connContainer        = document.getElementById('connContainer')

    // Initially, the only tab header button will be the one for the List Panel
    this.createAddTabHeader()

    // An unFloatTab IPC will be received from a floated tab connection
    // to instruct the Dock Panel to create a new connection to that
    // ip and port in the dock
    ipcRenderer.on('unFloatTab',  (e, ip, port) => this.unFloat(ip, port))

    // Connection-specific event-handlers [from app menu or context menu]

    ipcRenderer.on('closeTab',    (e, connId) =>
                                        this.doConn(connId, 'closeTab'))
    ipcRenderer.on('floatTab',    (e, connId) =>
                                        this.doConn(connId, 'floatTab'))
    ipcRenderer.on('logFile',     (e, connId) =>
                                        this.doConn(connId, 'logFile'))
    ipcRenderer.on('logResume',   (e, connId) =>
                                        this.doConn(connId, 'logResume'))
    ipcRenderer.on('logPause',    (e, connId) =>
                                        this.doConn(connId, 'logPause'))
    ipcRenderer.on('reConnect',   (e, connId) =>
                                        this.doConn(connId, 'reConnect'))
    ipcRenderer.on('clearScreen', (e, connId) =>
                                        this.doConn(connId, 'clearScreen'))
    ipcRenderer.on('clearLine',   (e, connId) =>
                                        this.doConn(connId, 'clearLine'))
    ipcRenderer.on('focusInput',  (e, connId) =>
                                        this.doConn(connId, 'focusInput'))
    ipcRenderer.on('findInPage',  (e, connId) =>
                                        this.doConn(connId, 'findInPage'))
  }

  // When a menu item pertaining to a connection is clicked,
  // dispatch to the appropriate connection object
  doConn(connId, eventName) {
    let conn = null

    // A connId of -1 is used when an application menu item is selected,
    // in which case the currently-selected connection is used
    if (connId < 0 && this.selectedConn) {
      conn = this.selectedConn
    }
    else {
      // Get the connection object reference from the connId
      const connInfo = this.connInfoList.get(connId)
      if (connInfo) {
        conn = connInfo.conn
      }
    }

    // Check that the connection id was assigned a connection object
    if (conn) {
      // If the connection no longer exists, event handlers will throw
      try {
        // Handle the close event and float event here
        // Route all other events to the conn object
        switch (eventName) {
          case 'closeTab':    return this.onConnTabClose(conn)
          case 'floatTab':    return this.onFloatTab(connId)
          case 'logFile':     return conn.onLogFile()
          case 'logResume':   return conn.onLogResume()
          case 'logPause':    return conn.onLogPause()
          case 'reConnect':   return conn.onReConnect()
          case 'clearScreen': return conn.onClearScreen()
          case 'clearLine':   return conn.onClearLine()
          case 'focusInput':  return conn.onFocusInput()
          case 'findInPage':  return conn.onFindInPage()
        }
      }
      catch(e) {
        console.log('Exception in doConn', e)
      }
    }
  }

  // Callback function passed to the VBListPanel constructor
  // When the list panel detects that a new connection is to be made,
  // it will invoke this callback to create the Conn Panel
  onConnect(ip, port) {
    // Assign a connection id
    const connId = this.nextConnId

    // Create a new connection panel
    const conn = new VBConnPanel(false, // isFloated=false
                                 ip, port,
                                 connId,
                                 this.onConnUp.bind(this),
                                 this.onConnDown.bind(this))

    // Keep track of the new connection
    this.connInfoList.set(connId, new ConnInfo(conn))
    this.nextConnId = this.nextConnId + 1

    const mapEntry = this.connInfoList.get(connId)

    // Create a tab header button for the connection
    this.createConnHeader(ip, port, conn, connId)

    // Initiate a new connection, creating the connection UI elements
    conn.init()

    // Display the connection's tab, and hide all other tabs,
    // including the device list tab
    this.selectTab(mapEntry.headerPanel, conn)
  }

  // Called when an IPC is received from a floated tab that is being unfloated
  // (re-docked) so that the Dock Panel can create a new connection tab
  // in the dock
  unFloat(ip, port) {
    this.onConnect(ip, port)
  }

  // Create the tab header for the list screen, clicked for a new connection
  createAddTabHeader() {
    this.tabAdd.addEventListener('click', e => {
      this.onAddTabClick(e)
    })
  }

  // Create the tab header for a connection, clicked to select that tab
  createConnHeader(ip, port, conn, connId) {
    // Clone the tab stub (class="tab")
    const headerClone = this.tabStub.cloneNode(true)

    // Set the id attribute to the connId
    headerClone.setAttribute('id', 'conn-' + connId)

    // Find the <span> tag that will contain the ip:port
    const tabIp = headerClone.querySelector('.tabIp')

    this.connInfoList.get(connId).tabIp = tabIp

    // Remove any data from the <span> tag used to contain ip:port
    while (tabIp.firstChild) {
      tabIp.removeChild(tabIp.firstChild)
    }

    // Fill in the clone's ip address
    tabIp.appendChild(document.createTextNode(ip + ':' + port))

    // Add onClick event listener for the tab header,
    // referencing the connection page that is being added.
    headerClone.addEventListener('click', (e) => {
      this.onConnTabClick(e, conn)
    })

    const closeButton = headerClone.querySelector('.tabClose')

    this.connInfoList.get(connId).closeButton = closeButton

    // Add onClick event listener for the tab close ("X") button,
    // referencing the connection page that is being added.
    // To make sure a click event on the close button does not
    // also cause the click event for the tab header to fire,
    // call stopPropagation()
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation()
      this.onConnTabClose(conn)
    })

    // Add the context-menu (right-click) handler for the tab header
    headerClone.addEventListener('contextmenu', (e) => {
      // Disable the system right-click functionality (possibly not necessary)
      e.preventDefault()
      // Display the context menu
      conn.doContextMenu()
    })

    // Add the tab either before the first existing tab, or after the last
    let headerPanel
    if (this.config.insertTabsAtEnd) {
      headerPanel = this.tabHeader.appendChild(headerClone)
      // Scroll to the end of the tab item list
      this.tabHeader.scrollLeft = this.tabHeader.scrollWidth
    }
    else {
      headerPanel = this.tabHeader.insertBefore(headerClone,
                                                    this.tabAdd.nextSibling)
      // Scroll to the start of the tab item list
      this.tabHeader.scrollLeft = 0
    }
    this.connInfoList.get(connId).headerPanel = headerPanel

    // Make the connection header visible
    headerClone.style.display = 'flex'

    // Update selectedConn with the new connection object
    this.selectedConn = conn
  }

  // Click event handler for a connection's tab item header
  onConnTabClick(e, conn) {
    // Remove "selected" from all other tabs' classes
    // Select this tab's class to include "selected"
    // Set all other (or current) tabs' display to 'none'
    // Set this tab's display to 'block'.
    if (e.target) {
      this.selectTab(e.target, conn)
    }
  }

  // Click event handler invoked when the tab close ("X") button is clicked
  onConnTabClose(conn) {
    // Reset selectedConn
    this.selectedConn = null

    // Remove the conn's tab header from the UI
    const headerPanel = this.connInfoList.get(conn.connId).headerPanel
    //tabHeader.removeChild(headerPanel)
    headerPanel.remove()

    // Set the Add tab header to selected and display the Add tab
    this.tabAdd.click()

    // Scroll to the start of the tab item list
    this.tabHeader.scrollLeft = 0

    // Terminate the connection, which will in turn destroy the socket
    conn.terminate()

    // Remove the reference to the connection from the connection list
    this.connInfoList.delete(conn.connId)
  }

  onConnUp(connId) {
    // Remove the tabConnDown class from the tab's header
    const connInfo = this.connInfoList.get(connId)
    if (connInfo) {
      connInfo.tabIp.classList.remove('tabConnDown')
    }
  }

  onConnDown(connId) {
    // Add the tabConnDown class from the tab's header
    const connInfo = this.connInfoList.get(connId)
    if (connInfo) {
      connInfo.tabIp.classList.add('tabConnDown')
    }
  }

  selectTab(target, conn) {
    // De-select all tabs
    for (let tab of this.tabHeader.getElementsByClassName('selected')) {
      tab.classList.remove('selected')
    }

    // Select this tab
    target.closest('.tab').classList.add('selected')

    // Hide all tab pages (including list page) except this connection tab
    for (let page of this.tabContentContainer.getElementsByClassName('page')) {
      page.style.display = 'none'
    }

    // Make sure the connContainer is visible
    this.connContainer.style.display = 'block'

    // Update selectedConn
    this.selectedConn = conn

    // Make sure the connection panel for this particular connection is visible
    conn.displayConnTab()
  }

  // Click event handler for the new-connection tab item header
  onAddTabClick(e) {
    // Remove "selected" from all other tabs' classes
    // Select this tab's class to include "selected"
    // Set all other (or current) tabs' display to 'none'
    // Set this tab's display to 'block'
    if (e.target) {
      // Reset selectedConn
      this.selectedConn = null

      // Remove 'selected' class from any currently-selected tab
      for (let tab of this.tabHeader.getElementsByClassName('selected')) {
        tab.classList.remove('selected')
      }

      // Add 'selected' class to the Add tab
      this.tabAdd.classList.add('selected')

      // Hide the connection tabs
      for (let page of this.tabContentContainer.
                            getElementsByClassName('page')) {
        page.style.display = 'none'
      }

      // Hide the connection tabs' container
      this.connContainer.style.display = 'none'

      // Display the Add tab
      this.deviceListPage.style.display = 'block'

      // Set the keyboard focus to the Connect button
      this.connectButton.focus()
    }
  }

  // Context menu event handler for float tab
  onFloatTab(connId) {
    const connInfo = this.connInfoList.get(connId)

    // Get the Main Process to create the new floating tab BrowserWindow
    ipcRenderer.send('float-tab', connInfo.conn.ip, connInfo.conn.port)

    // Close the docked connection tab
    connInfo.closeButton.click()
  }

}

function ConnInfo(conn) {
  this.conn = conn
  this.tabIp = null
  this.headerPanel = null
  this.closeButton = null
}

module.exports  = VBDockPanel
