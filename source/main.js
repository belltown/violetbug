'use strict';
{ // <= Enclosing block to keep function names out of global namespace

  //
  // Electron Main Process (main.js)
  //

  // Electron modules
  const {
    app,
    ipcMain,
    BrowserWindow,
    dialog,
    Menu
  } = require('electron')

  // Node.js modules
  const path = require('path')

  // Local modules
  const VBMenu = require('./lib/VBMenu')
  const VBIcons = require('./lib/VBIcons')
  const VBConfig = require('./lib/VBConfig')

  // Keep a global reference to the main window object
  global.mainWindow = null

  // Store the reference for each window so we can send config changes
  // Add to this list when a new BrowserWindow is created for a floated tab
  // Remove from the list when the BrowserWindow no longer exists
  global.floatList = []

  // Config VBConfig object will be instantiated after 'ready' event received,
  // so that any error dialog it displays will be rendered correctly
  global.vbConfig = null

  // config data reference, points to VBConfig object's parsed JSON config data
  let config = null

  function readConfigFile() {
    global.vbConfig = new VBConfig()

    // Read the config data and store reference to it
    let config = global.vbConfig.init()

    if (!config) {
      fatalErrorDialog('Unable to read config file')
      return null
    }

    // If we're using the original version of the config file,
    // then reset the device table as the ip address entry format has changed,
    // ensure that maxHostsToScan is defined, and there is a valid port list
    if (config.version === '0.0.0' ||
        config.version === '0.0.1' ||
        config.version === '0.0.2' ||
        config.version === '0.0.3') {
      config.version = '0.0.4'
      config.snTable = '[]'
      config.portList = {
        '8085': 'Main Debug',
        '8080': 'Genkey',
        '8087': 'Screensaver'
      }
      config.maxHostsToScan = 256
      global.vbConfig.save()
    }

    // Turn the snTables and floaties arrays into Maps
    configArraysToMaps(config)

    return config
  }

  // Create Maps to store the device table and floaties table
  // Note that snTable and floaties are stored in config as JSON arrays,
  // since JSON cannot depict Maps, so convert them here from arrays to Maps
  function configArraysToMaps(configData) {
    try {
      configData.snTable = new Map(JSON.parse(configData.snTable))
    }
    catch (e) {
      configData.snTable = new Map()
    }

    try {
      configData.floaties = new Map(JSON.parse(configData.floaties))
    }
    catch (e) {
      configData.floaties = new Map()
    }
  }

  // Convert the Maps to arrays before storing in config file,
  // necessary because JSON cannot be used to serialize Maps directly
  function configMapsToArrays(configData) {
    configData.snTable = JSON.stringify([...configData.snTable])
    configData.floaties = JSON.stringify([...configData.floaties])
  }

  // The config object contains a couple of Map() objects
  // These cannot directly be converted to a JSON object,
  // so convert them to arrays first, using the spread operator,
  // then stringify and put the strings in the config object before saving
  // Make global so can be called from VBMenu
  global.saveConfigObject = function() {
    configMapsToArrays(config)
    global.vbConfig.save()
    configArraysToMaps(config)
  }

  function errorDialog(message, detail = ' ') {
    dialog.showMessageBox({
      type: "error",
      title: "VioletBug -- Error",
      message: message,
      detail: detail,
      buttons: ["OK"]
    })
  }

  function fatalErrorDialog(message, detail = ' ') {
    dialog.showErrorBox('Fatal Error -- ' + message, detail)
    app.quit()
  }

  // Create a browser window after Electron has finished initializing
  // ('ready' event)
  function createMainWindow() {
    // Create a new BrowserWindow ('renderer')
    global.mainWindow = new BrowserWindow({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      title: 'VioletBug',
      icon: VBIcons.icon,
      // Don't show the window until the menu bar and html have been loaded
      show: false,
      // Electron docs state: Note that even for apps that use ready-to-show
      // event, it is still recommended to set backgroundColor to make app
      // feel more native
      // Use the same color value in index.css and float.css for
      // #mainContainer background-color
      backgroundColor: '#1e2026',
      webPreferences: {
        // Override the default ISO-8859-1 encoding
        defaultEncoding: 'UTF-8',
        // Use Electron's default font size
        //defaultFontSize: 14,

        // Monospace font size set from config file
        //defaultMonospaceFontSize: 14,

        // Make sure that requestAnimationFrame still runs even when
        // window is minimized, as it is used to trigger updates
        // to device output panel
        backgroundThrottling: false,

        // Needed for CSS 'grid' support
        experimentalFeatures: true
      }
    })

    // Create the main application menu
    Menu.setApplicationMenu(VBMenu.createAppMenu())

    // Display the Developer Tools (not in production release)
    //global.mainWindow.webContents.openDevTools()

    // Load the app's index.html file from disk
    global.mainWindow.loadURL(`file://${__dirname}/index.html`)

    // The 'resize' event is emitted when the window's dimensions are changed
    global.mainWindow.on('resize', () => {
      if (!global.mainWindow.isMaximized()) {
        [config.width, config.height] = global.mainWindow.getSize()
      }
    })

    // The 'move' event is emitted when the window is repositioned
    global.mainWindow.on('move', () => {
      if (!global.mainWindow.isMaximized()) {
        [config.x, config.y] = global.mainWindow.getPosition()
      }
    })

    // Main window maximized
    global.mainWindow.on('maximize', () => {
      config.windowState = 'Maximized'
    })

    // Main window unmaximized
    global.mainWindow.on('unmaximize', () => {
      config.windowState = 'Normal'
    })

    // Main window minimized
    global.mainWindow.on('minimize', () => {
      config.windowState = 'Minimized'
    })

    // Main window un-minimized
    global.mainWindow.on('restore', () => {
      config.windowState = 'Normal'
    })

    // The 'closed' event is emitted when the main window is closed
    global.mainWindow.on('closed', () => {
      // Persist the global config object to disk
      global.saveConfigObject()

      // Make sure all child windows close
      // Don't quit the app until the app window-all-closed event fires,
      // which will cause the app to close (except on macOS)
      //app.quit()

      // Dereference any remaining floating windows
      // Close the floating windows
      // They will be dereferenced (on macOS) when their 'closed'
      // events are handled
      try {
        // We can't iterate through floatList directly when closing windows,
        // since the act of closing a floating tab removes the corresponding
        // window entry from floatList, so make a copy first.
        let closeList = []
        floatList.forEach(
          win => closeList.push(win)
        )
        closeList.forEach(
          win => win.close()
        )
      }
      catch (ex) {
        console.log('Exception closing floated window', ex)
      }

      // Remove the reference to the main window;
      // On macOS, 'activate' can be used to recreate the window
      global.mainWindow = null
    })

    // Show and give focus to the window when it's ready to show
    global.mainWindow.once('ready-to-show', () => {
      if (config.windowState === 'Maximized') {
        global.mainWindow.maximize()
      }
      else {
        config.windowState = 'Normal'
      }
      if (config.zoomLevel) {
        global.mainWindow.webContents.setZoomLevel(config.zoomLevel)
      }
      global.mainWindow.show()
    })

  }

  // A floating tab is created here in the Main Process in response to
  // an IPC from the Renderer Process handling the DockPanel
  function onFloatTab(e, ip, port) {

    // Default window bounds if no bounds found in config file
    let x = config.x + 20
    let y = config.y + 20
    let width = config.width - 20
    let height = config.height - 20

    // Bounds are stored in the config file as a Map keyed on ip:port string
    const key = ip + ':' + port
    const bounds = config.floaties.get(key)

    // Set the window bounds from the config file, if present
    if (bounds) {
      x = bounds.x
      y = bounds.y
      width = bounds.width
      height = bounds.height
    }

    // Create a Browser Window for the floated tab
    let floatWindow = new BrowserWindow({
      x: x,
      y: y,
      width: width,
      height: height,
      title: ip + ':' + port + ' [Not Connected]',
      icon: VBIcons.icon,
      // Don't show the window until the menu bar and html have been loaded
      show: false,
      // Electron docs state: Note that even for apps that use ready-to-show
      // event, it is still recommended to set backgroundColor to make app
      // feel more native
      backgroundColor: '#ffffff',
      webPreferences: {
        // Override the default ISO-8859-1 encoding
        defaultEncoding: 'UTF-8',

        // Font sizes used by the floating tab are determined from config file
        //defaultFontSize: 14,
        //defaultMonospaceFontSize: 14,

        // Make sure that requestAnimationFrame still runs even when
        // window is minimized, as it is used to trigger updates
        // to device output panel
        backgroundThrottling: false,

        // Needed for CSS 'grid' support
        experimentalFeatures: true
      }
    })

    // Disable the menu bar
    floatWindow.setMenu(null)

    // Display the Developer Tools
    // Remove for release version (not in production release)
    //floatWindow.webContents.openDevTools()

    // Load the app's index.html file from disk
    floatWindow.loadURL(`file://${__dirname}/float.html`)

    // Store the window reference for the floating tab
    global.floatList.push(floatWindow)

    // Show and give focus to the window on the ready-to-show event,
    // and register floated window handles
    floatWindow.once('ready-to-show', () => {
      const ipPort = ip + ':' + port

      // Wait until the window is ready to show before showing it

      // The 'resize' event is emitted when the window size is changed
      floatWindow.on('resize', () => {
        config.floaties.set(ipPort, floatWindow.getBounds())
      })

      // The 'move' event is emitted when the window is repositioned
      floatWindow.on('move', () => {
        config.floaties.set(ipPort, floatWindow.getBounds())
      })

      if (config.zoomLevel) {
        floatWindow.webContents.setZoomLevel(config.zoomLevel)
      }

      floatWindow.show()
    })

    floatWindow.once('closed', () => {
      // Remove the webContents for the floating tab from the
      // webContentList in the Main Process
      const index = global.floatList.indexOf(floatWindow)
      if (index >= 0) {
        global.floatList.splice(index, 1)
      }
    })

  }

  // ----------------------------
  // Main processing starts here
  // ----------------------------


  // Set the Application User Model ID (AUMID) to the appId of the application
  // (Windows only)
  app.setAppUserModelId('tk.belltown-roku.violetbug')

  // The 'ready' event is emitted when Electron has finished initialization
  app.on('ready', () => {
    if (global.mainWindow === null) {
      config = readConfigFile()
      if (config) {
        createMainWindow()
      }
    }
  })

  // The 'activate' event is emitted when the application is activated,
  // which usually happens when the user clicks on the applications’s dock icon
  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (global.mainWindow === null) {
      config = readConfigFile()
      if (config) {
        createMainWindow()
      }
    }
  })

  // Quit the application when the last window is closed
  app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      // Try to close all windows
      app.quit()
    }
  })

  // ------------------------------------------------------
  // Handle IPC communications from the renderer processes
  // ------------------------------------------------------

  // Error dialog IPC from the Renderer process
  ipcMain.on('error-dialog', (e, message, detail = ' ') => {
    errorDialog(message, detail)
  })

  // Fatal error dialog IPC from the Renderer process
  ipcMain.on('fatal-error-dialog', (e, message, detail = ' ') => {
    fatalErrorDialog(message, detail)
  })

  // Config update IPCs from the Renderer process
  ipcMain.on('update-last-connected-device', (e, ip, port) => {
    config.lastConnectedIp = ip
    config.lastConnectedPort = port
  })

  // Keep track of the last log file path used
  ipcMain.on('update-log-file', (e, pathname) => {
    config.logfilePath = pathname
  })

  // Every time there is a change to the device list (e.g. a device is
  // added or deleted), the ListPanel sends a JSON-stringified copy of
  // the whole SN table in an IPC, which will be persisted to disk just
  // before the Main Process shuts down
  ipcMain.on('device-list', (e, deviceListJSON) => {
    config.snTable = new Map(JSON.parse(deviceListJSON))  //~~~~
  })

  // Whenever a tab is floated from the DockPanel and IPC is sent
  // to the Main Process to create the floating tab's BrowserWindow
  ipcMain.on('float-tab', onFloatTab)

  // Remove a webContents from the webContentsList when a
  // BrowserWindow (e.g. a floating tab) is closed
  // There is no event for that, but we use an IPC from the Floated Dock
  // to the main process instead.
  ipcMain.on('unfloat-tab', (e, window, webContents) => {
    // Close the window
    window.close()
  })

  // ----------------------------------------------------------
  // UI configuration changes: ports, colors, fonts, shortcuts
  // ----------------------------------------------------------

  // If the port list has changed, store new port list in config,
  // and broadcast to ListPanel renderer process
  ipcMain.on('portListChanged', (e, portListJson) => {
    config.portList = JSON.parse(portListJson)
    global.saveConfigObject()
    global.mainWindow.webContents.send('portListChanged', portListJson)
  })

  // If the foreground color has changed, store new color in config,
  // and broadcast to renderer processes
  ipcMain.on('fgColorChanged', (e, color) => {
    config.foregroundColor = color
    global.mainWindow.webContents.send('fgColorChanged', color)
    floatList.forEach(
      win => win.webContents.send('fgColorChanged', color)
    )
  })

  // If the background color has changed, store new color in config,
  // and broadcast to renderer processes
  ipcMain.on('bgColorChanged', (e, color) => {
    config.backgroundColor = color
    global.mainWindow.webContents.send('bgColorChanged', color)
    floatList.forEach(
      win => win.webContents.send('bgColorChanged', color)
    )
  })

  // Save the config after committing changes to fg/bg colors
  ipcMain.on('commitColors', (e) => {
    // Persist the global config object to disk
    global.saveConfigObject()
  })

  // If the font family has changed, store the new font family in config,
  // and broadcast to renderer processes
  ipcMain.on('fontFamilyChanged', (e, family) => {
    config.fontFamily = family
    global.mainWindow.webContents.send('fontFamilyChanged', family)
    floatList.forEach(
      win => win.webContents.send('fontFamilyChanged', family)
    )
  })

  // If the font size has changed, store the new font size in config,
  // and broadcast to renderer processes
  ipcMain.on('fontSizeChanged', (e, size) => {
    config.fontSize = size
    global.mainWindow.webContents.send('fontSizeChanged', size)
    floatList.forEach(
      win => win.webContents.send('fontSizeChanged', size)
    )
  })

  // Save the config after committing changes to the font
  ipcMain.on('commitFonts', (e) => {
    global.saveConfigObject()
  })

  // If the shortcuts have been changed, store in config,
  // and broadcast to renderer processes
  ipcMain.on('shortcutsChanged', (e, shortcutsJson) => {
    config.shortcutList = JSON.parse(shortcutsJson)
    global.saveConfigObject()
    global.mainWindow.webContents.send('shortcutsChanged', shortcutsJson)
    floatList.forEach(
      win => win.webContents.send('shortcutsChanged', shortcutsJson)
    )
  })
}
