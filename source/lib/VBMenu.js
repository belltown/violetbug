'use strict';

// Electron modules

const isRenderer = !!(process && process.type === 'renderer')

const electron = require('electron')

const {
  app,
  getGlobal,
  ipcMain,
  shell,
  Menu,
  MenuItem,
  BrowserWindow
} = isRenderer ? electron.remote : electron

// Node.js modules
const path = require('path')

// Local modules
const VBIcons = require('./VBIcons')

// Get a Main Process global variable depending on whether we are
// running in the Main Process or Renderer Process
function g(item) {
  return isRenderer ? getGlobal(item) : global[item]
}

class VBMenu {

  static platform() {
    // TODO: Debugging only ...
    //return 'darwin'

    return process.platform
  }

  // Executes in the main process to set up the application's main menu
  static createAppMenu() {
    // Reference the global config object in the Main process
    const config = g('vbConfig').config

    // Reference the main BrowserWindow object
    let mainWindow = g('mainWindow')

    // Reference the global floatList so we can send IPCs to all windows
    const floatList = g('floatList')

    // Some Linux distributions don't show the full menu, only the first item,
    // so show a menu that has all the other menus as submenus
    function linuxMenu() {
      return {
        label: app.getName(),
        submenu: [
          fileMenu(),
          settingsMenu(),
          windowMenu(),
          helpMenu()
        ]
      }
    }

    // macOS has some very specific menu items
    function darwinMenu() {
      const name = app.getName()
      return {
        label: name,
        submenu: [{
            label: 'About ' + name,
            role: 'about'
          },{
            type: 'separator'
          },{
            label: 'Services',
            role: 'services',
            submenu: []
          },{
            type: 'separator'
          },{
            label: 'Hide ' + name,
            accelerator: 'Command+H',
            role: 'hide'
          },{
            label: 'Hide Others',
            accelerator: 'Command+Alt+H',
            role: 'hideothers'
          },{
            label: 'Show All',
            role: 'unhide'
          },{
            type: 'separator'
          },{
            label: 'Quit ' + name,
            accelerator: 'Command+Q',
            click(menuItem, browserWindow, event) {
              app.quit()
            }
          }
        ]
      }
    }

    function fileMenu() {
      return {
        label: 'File',
        submenu: [{
            label: 'Exit',
            accelerator: 'CmdOrCtrl+Q',
            click(menuItem, browserWindow, event) {
              app.quit()
            }
          }
        ]
      }
    }

    function settingsMenu() {
      return {
        label: 'Settings',
        submenu: [{
            label: 'Auto scroll',
            type: 'checkbox',
            checked: config.autoScroll,
            click(menuItem, browserWindow, event) {
              const checked = menuItem.checked
              // Update main process config object
              config.autoScroll = checked
              // Flush config to disk
              g('saveConfigObject')()
              // Make sure VioletBug and Settings menus in sync
              VBMenu.setAppMenuSettings(checked, undefined)
              // Notify the renderer process of the change
              mainWindow.webContents.send('autoScrollChanged', checked)
              floatList.forEach(
                win => win.webContents.send('autoScrollChanged', checked)
              )
            }
          },{
            label: 'Auto wrap',
            type: 'checkbox',
            checked: config.autoWrap,
            click(menuItem, browserWindow, event) {
              const checked = menuItem.checked
              // Update main process config object
              config.autoWrap = checked
              // Flush config to disk
              g('saveConfigObject')()
              // Make sure VioletBug and Settings menus in sync
              VBMenu.setAppMenuSettings(undefined, checked)
              // Notify the renderer process of the change
              mainWindow.webContents.send('autoWrapChanged', checked)
              floatList.forEach(
                win => win.send('autoWrapChanged', checked)
              )
            }
          },{
            label: 'Fonts ...',
            click(menuItem, browserWindow, event) {
              // Flush the current config to disk, so font window can read it
              g('saveConfigObject')()

              // Display the fonts dialog window
              let fontsWindow = new BrowserWindow({
                //width: 480,
                //height: 600,
                title: 'Fonts',
                icon: VBIcons.icon,
                show: false,
                parent: browserWindow,
                modal: true,
                backgroundColor: '#FFF',
                webPreferences: {
                  defaultEncoding: 'UTF-8',
                  experimentalFeatures: true
                }
              })
              fontsWindow.setMenu(null)
              fontsWindow.loadURL('file://' +
                                  path.join(__dirname, '..', 'fonts.html'))
              fontsWindow.once('ready-to-show', () => {
                fontsWindow.show()
              })
              fontsWindow.on('closed', () => {
                fontsWindow = null
              })
            }
          },{
            label: 'Colors ...',
            click(menuItem, browserWindow, event) {
              // Flush the current config to disk, so color window can read it
              g('saveConfigObject')()

              // Display the colors dialog window
              let colorsWindow = new BrowserWindow({
                //width: 520,
                //height: 520,
                title: 'Colors',
                icon: VBIcons.icon,
                show: false,
                parent: browserWindow,
                modal: true,
                backgroundColor: '#FFF',
                webPreferences: {
                  defaultEncoding: 'UTF-8',
                  experimentalFeatures: true
                }
              })
              colorsWindow.setMenu(null)
              colorsWindow.loadURL('file://' +
                                    path.join(__dirname, '..', 'colors.html'))
              colorsWindow.once('ready-to-show', () => {
                colorsWindow.show()
              })
              colorsWindow.on('closed', () => {
                colorsWindow = null
              })
            }
          },{
            label: 'Shortcuts ...',
            click(menuItem, browserWindow, event) {
              // Flush the current config to disk, so font window can read it
              g('saveConfigObject')()

              // Display the fonts dialog window
              let shortcutsWindow = new BrowserWindow({
                //width: 640,
                //height: 575,
                title: 'Shortcuts',
                icon: VBIcons.icon,
                show: false,
                parent: browserWindow,
                modal: true,
                backgroundColor: '#FFF',
                webPreferences: {
                  defaultEncoding: 'UTF-8',
                  experimentalFeatures: true
                }
              })
              shortcutsWindow.setMenu(null)
              shortcutsWindow.loadURL('file://' +
                              path.join(__dirname, '..', 'shortcuts.html'))
              shortcutsWindow.once('ready-to-show', () => {
                shortcutsWindow.show()
              })
              shortcutsWindow.on('closed', () => {
                shortcutsWindow = null
              })
            }
          },{
            type: 'separator'
          },{
            label: "Right-click in a connection's window for more options",
            sublabel: "(log, float, re-connect, close, clear screen, etc)"
          }
        ]
      }
    }

    function windowMenu() {
      return {
        label: 'Window',
        role: 'window',
        submenu: [  {
            label: 'Zoom In',
            accelerator: 'CmdOrCtrl+=',
            click(menuItem, browserWindow, event) {
              browserWindow.webContents.getZoomLevel(zoom => {
                if (zoom < 7) {
                  config.zoomLevel = ++zoom
                  browserWindow.webContents.setZoomLevel(zoom)
                }
              })
            }
          },{
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            click(menuItem, browserWindow, event) {
              browserWindow.webContents.getZoomLevel(zoom => {
                if (zoom > -7) {
                  config.zoomLevel = --zoom
                  browserWindow.webContents.setZoomLevel(zoom)
                }
              })
            }
          },{
            label: 'Zoom Reset',
            click(menuItem, browserWindow, event) {
              config.zoomLevel = 0
              browserWindow.webContents.setZoomLevel(0)
            }
          },{
            type: 'separator'
          },{
            label: 'Minimize',
            accelerator: 'CmdOrCtrl+M',
            role: 'minimize'
          },{
            label: 'Bring All to Front',
            visible: VBMenu.platform() === 'darwin',
            role: 'front'
          },{
            role: 'togglefullscreen'
          },{
            label: 'Close All',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
          },
        ]
      }
    }

    function helpMenu() {
      return {
        label: 'Help',
        submenu: [{
            label: 'VioletBug Release Notes',
            click(menuItem, browserWindow, event) {
              shell.openExternal(
                'https://github.com/belltown/violetbug/releases')
            }
          },{
            label: 'VioletBug Web Page',
            click(menuItem, browserWindow, event) {
              shell.openExternal('http://belltown-roku.tk/VioletBug')
            }
          },{
            label: 'About VioletBug',
            click(menuItem, browserWindow, event) {
              const aboutWindow = new BrowserWindow({
                width: 320,
                height: 200,
                title: 'About VioletBug',
                icon: VBIcons.icon,
                show: true,
                webPreferences: {
                  defaultEncoding: 'UTF-8',
                }
              })
              aboutWindow.setMenu(null)
              aboutWindow.loadURL('file://' +
                                  path.join(__dirname, '..', 'about.html'))
            }
          },{
            type: 'separator'
          },{
            label: 'Toggle Developer Tools',
            accelerator: VBMenu.platform() === 'darwin' ? 'Alt+Command+I'
                                                        : 'Ctrl+Shift+I',
            click(menuItem, browserWindow, event) {
              if (browserWindow) {
                browserWindow.webContents.toggleDevTools()
              }
            }
          }
        ]
      }
    }

    // Keep this code in sync with the code below in settingsMenuIndex()
    const template = []
    // [0] ...
    if (VBMenu.platform() === 'darwin') {
      template.push(darwinMenu())
    }
    else if (VBMenu.platform() === 'linux') {
      template.push(linuxMenu())
    }

    // [1] ...
    template.push(fileMenu())

    // [2] ...
    template.push(settingsMenu())

    // [3] ...
    template.push(windowMenu())

    // [4] ...
    template.push(helpMenu())

    return Menu.buildFromTemplate(template)

  }

  // Keep in sync with the above code at the end of createAppMenu()
  static settingsMenuIndex() {
    if (VBMenu.platform() === 'darwin' || VBMenu.platform() === 'linux') {
      return 2
    }
    else {
      // win32 does not have the initial "VioletBug" menu
      return 1
    }
  }

  // Whenever the context menu is used to change the AutoScroll or AutoWrap
  // options, the application menu must be updated to reflect their
  // checked statuses
  static setAppMenuSettings(autoScroll, autoWrap) {
    const appMenu = Menu.getApplicationMenu()
    const SETTINGS_INDEX = VBMenu.settingsMenuIndex()

    if (typeof autoScroll !== 'undefined') {
      // Linux "VioletBug" menu
      if (VBMenu.platform() === 'linux') {
        appMenu.items[0].submenu.items[1].submenu.items[0].checked = autoScroll
      }
      // App Settings menu
      appMenu.items[SETTINGS_INDEX].submenu.items[0].checked = autoScroll
    }

    if (typeof autoWrap !== 'undefined') {
      // Linux "VioletBug" menu
      if (VBMenu.platform() === 'linux') {
        appMenu.items[0].submenu.items[1].submenu.items[1].checked = autoWrap
      }
      // App Settings menu
      appMenu.items[SETTINGS_INDEX].submenu.items[1].checked = autoWrap
    }
  }

  // Executes in the Renderer Process to set up an individual
  // connection's context menu
  // Note that the click event handlers execute in the Main Process context
  static createContextMenu(connId, ip, port) {
    // Reference the global config object in the Main Process
    const config = g('vbConfig').config

    // Reference to main window in the Main Process
    let mainWindow = g('mainWindow')

    // Reference the global webContentsList so we can send IPCs to all windows
    let floatList = g('floatList')

    // Create a Menu remote object
    const menu = new Menu()

    let index = 0

    menu.append(new MenuItem({
      label: 'Log file ...',
      click(menuItem, browserWindow, event) {
        browserWindow.webContents.send('logFile', connId)
      }
    }))
    index++

    menu.append(new MenuItem({
      label: 'Resume logging',
      enabled: false,
      click(menuItem, browserWindow, event) {
        browserWindow.webContents.send('logResume', connId)
      }
    }))
    VBMenu.RESUME_LOGGING = index++

    menu.append(new MenuItem({
      label: 'Pause logging',
      enabled: false,
      click(menuItem, browserWindow, event) {
        browserWindow.webContents.send('logPause', connId)
      }
    }))
    VBMenu.PAUSE_LOGGING = index++

    menu.append(new MenuItem({type: 'separator'}))
    index++

    menu.append(new MenuItem({
      label: 'Re-connect',
      click(menuItem, browserWindow, event) {
        browserWindow.webContents.send('reConnect', connId)
      }
    }))
    index++

    menu.append(new MenuItem({
      label: 'Close tab',
      click(menuItem, browserWindow, event) {
        browserWindow.webContents.send('closeTab', connId)
      }
    }))
    index++

    menu.append(new MenuItem({
      label: 'Float tab',
      // Set visible to false if floating tab
      visible: true,
      click(menuItem, browserWindow, event) {
        // Send IPC to renderer process (DockPanel), which will remove
        // the docked connection tab, and send an IPC to the Main Process
        // to create a new Floating connection window
        browserWindow.webContents.send('floatTab', connId)
      }
    }))
    VBMenu.FLOAT_TAB = index++

    menu.append(new MenuItem({
      label: 'Unfloat tab',
      // Set visible to true if docked tab
      visible: false,
      click(menuItem, browserWindow, event) {
        // Send IPC to DockPanel window so it can create new connection in dock
        // and remove the floating tab from its list
        mainWindow.webContents.send('unFloatTab', ip, port)

        // Send IPC to renderer of FloatPanel window so it can terminate
        browserWindow.webContents.send('unFloatTab', connId)
      }
    }))
    VBMenu.UNFLOAT_TAB = index++

    menu.append(new MenuItem({type: 'separator'}))
    index++

    menu.append(new MenuItem({
      label: 'Auto scroll',
      type: 'checkbox',
      checked: config.autoScroll,
      click(menuItem, browserWindow, event) {
        const checked = menuItem.checked
        // Update main process config object
        config.autoScroll = checked
        // Flush config to disk
        g('saveConfigObject')()
        // Update main menu auto scroll flags (in main process)
        VBMenu.setAppMenuSettings(checked, undefined)
        // Notify the renderer process of the change
        // Note: send IPC to main window NOT the window where the context
        // menu was invoked, otherwise if the context menu is invoked
        // from a floating window, the change will not get propagated
        // to the main dock
        mainWindow.webContents.send('autoScrollChanged', checked)
        floatList.forEach(
          win => win.webContents.send('autoScrollChanged', checked)
        )
      }
    }))
    VBMenu.AUTO_SCROLL = index++

    menu.append(new MenuItem({
      label: 'Auto wrap',
      type: 'checkbox',
      checked: config.autoWrap,
      click(menuItem, browserWindow, event) {
        const checked = menuItem.checked
        // Update main process config object
        config.autoWrap = checked
        // Flush config to disk
        g('saveConfigObject')()
        // Update main menu auto wrap flags (in main process)
        VBMenu.setAppMenuSettings(undefined, checked)
        // Notify the renderer process of the change
        // Note: send IPC to main window NOT the window where the context
        // menu was invoked, otherwise if the context menu is invoked
        // from a floating window, the change will not get propagated
        // to the main dock
        mainWindow.webContents.send('autoWrapChanged', checked)
        floatList.forEach(
          win => win.webContents.send('autoWrapChanged', checked)
        )
      }
    }))
    VBMenu.AUTO_WRAP = index++

    menu.append(new MenuItem({type: 'separator'}))
    index++

    menu.append(new MenuItem({
      label: 'Clear screen',
      accelerator: 'Alt+C',
      click(menuItem, browserWindow, event) {
        browserWindow.webContents.send('clearScreen', connId)
      }
    }))
    index++

    menu.append(new MenuItem({
      label: 'Clear line',
      accelerator: 'Esc',
      click(menuItem, browserWindow, event) {
        browserWindow.webContents.send('clearLine', connId)
      }
    }))
    index++

    menu.append(new MenuItem({type: 'separator'}))
    index++

    menu.append(new MenuItem({
      label: 'Cut',
      accelerator: 'CmdOrCtrl+X',
      role: 'cut'
    }))
    index++

    menu.append(new MenuItem({
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      role: 'copy'
    }))
    index++

    menu.append(new MenuItem({
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      role: 'paste'
    }))
    index++

    return menu

  }

  static clearApplicationMenu () {
    Menu.setApplicationMenu(null)
  }

}

module.exports = VBMenu
