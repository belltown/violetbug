'use strict';
{ // <= Enclosing block to keep function names out of global namespace

  //
  // Main menu font selection settings dialog
  // Invoked from VBMenu.js
  //

  // Electron modules
  const {remote, ipcRenderer} = require('electron')

  // Local modules
  const VBKeys = require('./lib/VBKeys')
  const VBConfig = require('./lib/VBConfig')

  // Read config data (to get current font family and size)
  // The fonts module only READS the config data, never writing directly
  // When the font is changed, an IPC message is sent to
  // the Main Process using ipcRenderer.send()
  // The Main Process will in turn send IPCs to the Renderer Processes
  // so they can update the fonts for any displayed connection tabs or
  // floating tabs
  const vbConfig = new VBConfig()
  const config = vbConfig.init()

  // Declare DOM shortcuts; assign in onLoad(), called when the DOM is loaded
  let familyList
  let sizeList
  let fontPreview
  let okButton
  let defaultsButton
  let cancelButton

  // Save the initial fonts in case the user clicks the Cancel button
  let fontFamilySave = config.fontFamily
  let fontSizeSave = config.fontSize

  // No need to release any resources - closing the window takes care of that
  function closeWindow() {
    remote.getCurrentWindow().close()
  }

  // Send an IPC to the main process for any change in font family
  function sendFontFamilyChange() {
    ipcRenderer.send('fontFamilyChanged', config.fontFamily)
  }

  // Send an IPC to the main process for any change in font size
  function sendFontSizeChange() {
    ipcRenderer.send('fontSizeChanged', config.fontSize)
  }

  // Instruct the Main Process to flush its config data to disk
  // Do this when the OK button is pressed so that any newly-created
  // connection tabs will get the up-to-date fonts when they read
  // the config file during their initialization
  function sendCommitFonts() {
    ipcRenderer.send('commitFonts')
  }

  // Remove ',' monospace from font family
  function fontFamilyToDisplay(fontFamily) {
    return fontFamily.split(',')[0]
  }

  // Add monospace as a default if chosen font cannot be used
  function fontDisplayToFamily(fontFamilyDisplay) {
    if (fontFamilyDisplay !== 'serif') {
      return fontFamilyDisplay + ', serif'
    }
    else {
      return fontFamilyDisplay
    }
  }

  // Convert an internal format font size ("10pt") to display format ("10 pt")
  function fontSizeToDisplay(fontSize) {
    const ma = /(\d+)\s*pt/.exec(fontSize)
    return ma ? ma[1] + ' pt' : '10 pt'
  }

  // Convert a font from display format ("10 pt") to internal format ("10pt")
  function fontDisplayToSize(fontSizeDisplay) {
    return fontSizeDisplay.replace(/\s*/g, '')
  }

  // Set the font preview panel colors
  function setPreviewColors() {
    fontPreview.style.color = config.foregroundColor
    fontPreview.style.borderColor = config.foregroundColor
    fontPreview.style.backgroundColor = config.backgroundColor
  }

  // One-time initialization of the font family list typefaces
  function setFontFamilyNames() {
    const nodeList = familyList.querySelectorAll('li')
    for (let i = 0; i < nodeList.length; i++) {
      const li = nodeList[i]
      li.style.fontFamily = li.textContent
    }
  }

  // Set the font family in the preview pane
  function setPreviewFontFamily() {
    fontPreview.style.fontFamily = config.fontFamily
    fontPreview.textContent = config.fontFamily
  }

  // Set the font size in the preview pane
  function setPreviewFontSize(e) {
    fontPreview.style.fontSize = config.fontSize
  }

  // Highlight the selected font family list item
  function setSelectedFontFamily() {
    const nodeList = familyList.querySelectorAll('li')
    for (let i = 0; i < nodeList.length; i++) {
      if (nodeList[i].textContent === config.fontFamily) {
        nodeList[i].click()
        nodeList[i].scrollIntoView()
        break
      }
    }
  }

  // Highlight the selected font size list item
  function setSelectedFontSize() {
    const fontSizeDisplay = fontSizeToDisplay(config.fontSize)
    const nodeList = sizeList.querySelectorAll('li')
    for (let i = 0; i < nodeList.length; i++) {
      if (nodeList[i].textContent === fontSizeDisplay) {
        nodeList[i].click()
        nodeList[i].scrollIntoView()
        break
      }
    }
  }

  // When the family list gets focus, focus on the selected family item
  function onFamilyListFocus(e) {
    if (e.target) {
      const selected = e.target.querySelector('.selected')
      if (selected) {
        selected.focus()
      }
    }
  }

  // When the size list gets focus, focus on the selected size item
  function onSizeListFocus(e) {
    if (e.target) {
      const selected = e.target.querySelector('.selected')
      if (selected) {
        selected.focus()
      }
    }
  }

  // Highlight the selected list box (familyList or sizeList)
  function selectElement(element) {
    // Remove 'selected' class from all list elements
    const parentUL = element.closest('ul')
    if (parentUL) {
      const nodeList = parentUL.querySelectorAll('li')
      for (let i = 0; i < nodeList.length; i++) {
        nodeList[i].classList.remove('selected')
      }
      // Add 'selected' to clicked list element
      element.classList.add('selected')
    }
  }

  // Event-handler for the font family list
  function onFamilyListClick(e) {
    if (e.target && e.target.nodeName === 'LI') {
      // The target element should be an <li> element
      const li = e.target
      // The <li> element's textContent is the font family, e.g. "Courier New"
      const value = li.textContent
      if (value) {
        // Update font family value, send to Main Process, mark as selected
        config.fontFamily = value
        sendFontFamilyChange()
        selectElement(li)
        setPreviewFontFamily()
      }
    }
  }

  // Event handler for the font size list
  function onSizeListClick(e) {
    if (e.target && e.target.nodeName === 'LI') {
      // The target element should be an <li> element
      const li = e.target
      // The <li> element's value is the font size, e.g. "10 pt"
      const value = li.textContent
      if (value) {
        // Change "10 pt" to "10pt"
        const size = fontDisplayToSize(value)

        // Update font family value, send to Main Process, mark as selected
        config.fontSize = size
        setPreviewFontSize()
        sendFontSizeChange()
        selectElement(li)
      }
    }
  }

  // Key Up/Down handler for CSS custom list box
  function onListKeydown(e) {
    // Only handle keydown events on <li> elements
    if (e.target && e.target.nodeName === 'LI') {
      const li = e.target
      let sibling = null
      // Get the key value (only handle Up and Down)
      const keyVal = VBKeys.keyVal(e)
      switch (keyVal) {
        case VBKeys.UP:
          e.preventDefault()
          // Click on the previous <li>'s <input> descendant
          sibling = li.previousElementSibling
          if (sibling) {
            // Generate a click event on the previous <li> element
            sibling.focus()
            sibling.click()
          }
          break
        case VBKeys.DOWN:
          e.preventDefault()
          // Click on the next <li>'s <input> descendant
          sibling = li.nextElementSibling
          if (sibling) {
            // Generate a click event on the next <li> element
            sibling.focus()
            sibling.click()
          }
          break
      }
    }
  }

  // Event-handler for the OK button
  function onOKClick(e) {
    sendCommitFonts()
    closeWindow()
  }

  // Event-handler for the Defaults button
  function onDefaultsClick(e) {
    config.fontFamily = config.fontFamilyDefault
    config.fontSize = config.fontSizeDefault
    setPreviewFontFamily()
    setPreviewFontSize()
    setSelectedFontFamily()
    setSelectedFontSize()
    sendFontFamilyChange()
    sendFontSizeChange()
  }

  // Event-handler for Cancel button
  function onCancelClick(e) {
    config.fontFamily = fontFamilySave
    config.fontSize = fontSizeSave
    sendFontFamilyChange()
    sendFontSizeChange()
    closeWindow()
  }

  // Document load event-handler
  function onLoad() {
    // Assign DOM element shortcuts
    familyList     = document.getElementById('familyList')
    sizeList       = document.getElementById('sizeList')
    fontPreview    = document.getElementById('fontPreview')
    okButton       = document.getElementById('okButton')
    defaultsButton = document.getElementById('defaultsButton')
    cancelButton   = document.getElementById('cancelButton')

    // Register event-handlers
    familyList     .addEventListener('click',   onFamilyListClick)
    familyList     .addEventListener('keydown', onListKeydown)
    familyList     .addEventListener('focus',   onFamilyListFocus)
    sizeList       .addEventListener('click',   onSizeListClick)
    sizeList       .addEventListener('keydown', onListKeydown)
    sizeList       .addEventListener('focus',   onSizeListFocus)
    okButton       .addEventListener('click',   onOKClick)
    defaultsButton .addEventListener('click',   onDefaultsClick)
    cancelButton   .addEventListener('click',   onCancelClick)

    // Set font list names to the corresponding fonts
    setFontFamilyNames()

    // Set initial font values from config data
    setPreviewFontFamily()
    setPreviewFontSize()

    // Highlight the selected font values
    setSelectedFontFamily()
    setSelectedFontSize()

    // Set the font preview panel colors
    setPreviewColors()
  }

  // Register the document load event-handler, fired when DOM is fully loaded
  addEventListener('load', onLoad)

}
