'use strict';
{ // Enclosing block to keep function definitions out of global namespace

  //
  // Main menu color selection settings dialog
  // Invoked from VBMenu.js
  //

  // Electron modules
  const {remote, ipcRenderer} = require('electron')

  // Local modules
  const VBConfig = require('./lib/VBConfig')

  // Declare DOM shortcuts; assign in onLoad(), called when the DOM is loaded
  let fgSelect
  let bgSelect
  let rSlider
  let gSlider
  let bSlider
  let rValue
  let gValue
  let bValue
  let listHead
  let listHeadColor
  let listHeadPredefined
  let listBody
  let predefinedText
  let previewText
  let ok
  let cancel

  // Read config data (to get FG and BG colors)
  // This colors module only reads the config data, never writing directly
  // When the FG or BG color is changed, an IPC message is sent to
  // the Main Process using ipcRenderer.send()
  // The Main Process will in turn send IPCs to the Renderer Processes
  // so they can update the colors for any displayed connection tabs or
  // floating tabs
  const vbConfig = new VBConfig()
  const config = vbConfig.init()

  // True if the Foreground radio button is selected, else false
  let fg = true

  // Keep track of the current FG and BG colors
  let fgColorString = config.foregroundColor
  let bgColorString = config.backgroundColor

  // Save the initial colors in case the user clicks the Cancel button
  let fgColorStringSave = fgColorString
  let bgColorStringSave = bgColorString

  // No need to release any resources - closing the window takes care of that
  function closeWindow() {
    remote.getCurrentWindow().close()
  }

  // Send an IPC to the main process for any change in FG/BG color
  function sendFGChange(color) {
    ipcRenderer.send('fgColorChanged', color)
  }

  function sendBGChange(color) {
    ipcRenderer.send('bgColorChanged', color)
  }

  // Instruct the Main Process to flush its config data to disk
  // Do this when the OK button is pressed so that any subsequent
  // connection tabs will get the up-to-date colors when they read
  // the config file during their initialization
  function sendCommitColors() {
    ipcRenderer.send('commitColors')
  }

  // Convert between color byte values (0-255) and hex pairs (00-FF)
  function byteToHex(byte) {
    const hex = parseInt(byte, 10).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  function hexToByte(hex) {
    let value = parseInt(hex, 16)
    return Number.isNaN(value) ? 0 : value
  }

  // Color strings are in the form "#RRGGBB" (hex pairs)
  function rgbToHexString(r, g, b) {
    return '#' + byteToHex(r) + byteToHex(g) + byteToHex(b)
  }

  function hexStringToRGB(hexString) {
    return {
      r: hexToByte(hexString.substring(1, 3)),
      g: hexToByte(hexString.substring(3, 5)),
      b: hexToByte(hexString.substring(5, 7))
    }
  }

  // We do try to prevent the user from entering non-numeric color values
  // in onValueKeypress(); however, there's nothing to stop them pasting in
  // an invalid value from the clipboard, or entering a value outside
  // the valid byte range (0-255)
  function validateRGB(value) {
    let parsed = parseInt(value, 10)
    if (Number.isNaN(parsed) || parsed < 0) {
      parsed = 0
    }
    else if (parsed > 255) {
      parsed = 255
    }
    return parsed
  }

  // Set all 3 color sliders and values based on the current color strings
  function setSliders() {
    let rgb = null
    if (fg) {
      rgb = hexStringToRGB(fgColorString)
    }
    else {
      rgb = hexStringToRGB(bgColorString)
    }
    rSlider.value = rValue.value = rgb.r
    gSlider.value = gValue.value = rgb.g
    bSlider.value = bValue.value = rgb.b
  }

  // Set the foreground and background colors in the preview pane
  function setFGColor(color) {
    previewText.style.color = color
  }

  function setBGColor(color) {
    previewText.style.backgroundColor = color
  }

  // Depending on whether the Foreground or Background radio button
  // is selected, update the FG or BG color, and notify the Main Process
  // of the change
  function updateColor(r, g, b) {
    if (fg) {
      fgColorString = rgbToHexString(r, g, b)
      setFGColor(fgColorString)
      sendFGChange(fgColorString)
    }
    else {
      bgColorString = rgbToHexString(r, g, b)
      setBGColor(bgColorString)
      sendBGChange(bgColorString)
    }
  }

  // Reset the color dropdown box any time the foreground or background
  // radio button is pressed
  function resetListHeader() {
    predefinedText.style.display = 'block'
    listHeadColor.style.display = 'none'
  }

  // When the user clicks on one of the list items in the predefined
  // colors list, place the selected color in the dropdown list header
  function setListHeader(li) {
    predefinedText.style.display = 'none'
    listHeadColor.style.display = 'flex'

    // Remove existing children of #listHeadColor
    // Death to the children
    while (listHeadColor.firstChild) {
      listHeadColor.removeChild(listHeadColor.firstChild)
    }

    // Clone the selected list item, appending to #listHeadColor
    // Long live the clones
    const clone = li.cloneNode(true)
    while (clone.hasChildNodes()) {
      listHeadColor.appendChild(clone.removeChild(clone.firstChild))
    }
  }

  // Click-handler for the foreground/background radio buttons
  function onFGBGClick(e) {
    fg = fgSelect.checked
    setSliders()
    resetListHeader()
  }

  // Click-handler for the entire document
  function onDocumentClick(e) {
    // Hide the predefined styles list body
    listBody.style.display = 'none'
  }

  // Click-handler for the predefined styles list header
  function onListHeadClick(e) {
    // Prevent the document click-handler from receiving this click event
    e.stopPropagation()

    // Toggle display/hide of the predefined styles list body
    const style = listBody.style
    style.display = style.display === 'block' ? 'none' : 'block'
  }

  // Click-handler for the predefined styles list body
  function onListBodyClick(e) {
    // Find the list item that was clicked
    const li = e.target.closest('LI')
    if (li) {
      // The list item's first DIV (if any) contains the item's color value
      const div = li.querySelector('DIV')
      if (div) {
        // Extract the background-color inline style for the item's color
        const color = div.style.backgroundColor
        // Color values are returned as a string, e.g. "rgb(128, 255, 255)"
        const m = /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color)
        if (Array.isArray(m) && m.length === 4) {
          // Update the foreground or background color value, and preview pane
          updateColor(m[1], m[2], m[3])
          // Set the color sliders and values
          setSliders()
        }
      }
      // Put the selected color in the dropdown list header box
      setListHeader(li)
    }
  }

  // When one of the color sliders is changed, update the FG/BG color
  // and the associated color textbox
  function onSliderChange(e) {
    switch (e.target) {
      case rSlider:
        rValue.value = rSlider.value
        break;
      case gSlider:
        gValue.value = gSlider.value
        break;
      case bSlider:
        bValue.value = bSlider.value
        break;
    }
    updateColor(rSlider.value, gSlider.value, bSlider.value)
  }

  // Only allow digits in the input textbox
  function onValueKeypress(e) {
    if (e.key < "0" || e.key > "9") {
      e.preventDefault()
      return false
    }
    else {
      return true
    }
  }

  // When one of the color textbox values changes, update the FG/BG color,
  // and reposition the associated color slider
  function onValueChange(e) {
    switch (e.target) {
      case rValue:
        rSlider.value = rValue.value = validateRGB(rValue.value)
        break;
      case gValue:
        gSlider.value = gValue.value = validateRGB(gValue.value)
        break;
      case bValue:
        bSlider.value = bValue.value = validateRGB(bValue.value)
        break;
    }
    updateColor(rSlider.value, gSlider.value, bSlider.value)
  }

  // Event-handler for the OK button
  function onOKClick(e) {
    sendCommitColors()
    closeWindow()
  }

  // Event-handler for Cancel button
  function onCancelClick(e) {
    sendFGChange(fgColorStringSave)
    sendBGChange(bgColorStringSave)
    closeWindow()
  }

  // Document load event-handler
  function onLoad() {
    // Assign DOM element shortcuts
    fgSelect            = document.getElementById('fgSelect')
    bgSelect            = document.getElementById('bgSelect')
    rSlider             = document.getElementById('r-slider')
    gSlider             = document.getElementById('g-slider')
    bSlider             = document.getElementById('b-slider')
    rValue              = document.getElementById('r-value')
    gValue              = document.getElementById('g-value')
    bValue              = document.getElementById('b-value')
    listHead            = document.getElementById('listHead')
    listHeadColor       = document.getElementById('listHeadColor')
    listHeadPredefined  = document.getElementById('listHeadPredefined')
    listBody            = document.getElementById('listBody')
    predefinedText      = document.getElementById('predefinedText')
    previewText         = document.getElementById('previewText')
    ok                  = document.getElementById('okButton')
    cancel              = document.getElementById('cancelButton')

    // Register event-handlers
    document  .addEventListener('click',    onDocumentClick)
    fgSelect  .addEventListener('click',    onFGBGClick)
    bgSelect  .addEventListener('click',    onFGBGClick)
    rSlider   .addEventListener('input',    onSliderChange)
    gSlider   .addEventListener('input',    onSliderChange)
    bSlider   .addEventListener('input',    onSliderChange)
    rValue    .addEventListener('keypress', onValueKeypress)
    gValue    .addEventListener('keypress', onValueKeypress)
    bValue    .addEventListener('keypress', onValueKeypress)
    rValue    .addEventListener('change',   onValueChange)
    gValue    .addEventListener('change',   onValueChange)
    bValue    .addEventListener('change',   onValueChange)
    listHead  .addEventListener('click',    onListHeadClick)
    listBody  .addEventListener('click',    onListBodyClick)
    ok        .addEventListener('click',    onOKClick)
    cancel    .addEventListener('click',    onCancelClick)

    // Set initial color values and sliders
    setSliders()
    setFGColor(fgColorString)
    setBGColor(bgColorString)
  }

  // Register the document load event-handler
  addEventListener('load', onLoad)

}
