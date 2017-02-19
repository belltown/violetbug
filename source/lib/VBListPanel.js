'use strict';

/*
 * Handle the panel containing the discovered device list
 */

// Electron modules
const {ipcRenderer} = require('electron')

// Local modules
const VBKeys = require('./VBKeys')
const VBConfig = require('./VBConfig')
const VBDiscover = require('./VBDiscover')

class VBListPanel {

  constructor(connectCallback) {

    // Instantiate a VBConfig object
    this.vbConfig = new VBConfig()

    // Connection callback
    this.connectCallback = connectCallback

    // snTable is a Map() using Serial Number as the key
    // The value of the Map() is an SnEntry
    // snTable is ONLY updated when an ECP response is received
    this.snTable = new Map()

    // Keep track of deleted device SNs so they are not re-added on discovery
    this.deletedDeviceList = []

    // Shortcuts to DOM elements
    this.deviceListPage     = document.getElementById('deviceListPage')
    this.tabAdd             = document.getElementById('tab-Add')
    this.connectButton      = document.getElementById('connectButton')
    this.connectToIp        = document.getElementById('connectToIp')
    this.connectToPort      = document.getElementById('connectToPort')
    this.discoveredDevices  = document.getElementById('discoveredDevices')
    this.deviceTableBody    = document.getElementById('deviceTableBody')
    this.friendlyName       = document.getElementById('friendlyName')
    this.serialNumber       = document.getElementById('serialNumber')
    this.modelNumber        = document.getElementById('modelNumber')
    this.modelName          = document.getElementById('modelName')

  }

  // Create the list panel UI components and initiate device discovery
  init() {
    // Read the config data, getting a reference to the JSON config info
    this.config = this.vbConfig.init()

    if (!this.config) {
      ipcRenderer.send('fatal-error-dialog', 'Unable to read config file')
      return
    }

    // Restore the saved list of devices (from the config object)
    this.snTable = this.restoreDeviceList()

    // Fill in the last connected device and port
    this.connectToIp.value = this.config.lastConnectedIp
    this.connectToPort.value = this.config.lastConnectedPort

    // Update the UI based on the restored device list
    this.updateUIDevices()

    // Add Connect button event listener
    this.connectButton.addEventListener('click',
      e => this.onConnectClick(e)
    )

    // Clicking a device list entry will select it and display its details
    this.discoveredDevices.addEventListener('click',
      e => this.onDeviceListClick(e)
    )

    // Double-clicking a device list entry will connect to it
    this.discoveredDevices.addEventListener('dblclick',
      e => this.onDeviceListDblClick(e)
    )

    // The friendly name field for a device entry can be changed by the user
    this.friendlyName.addEventListener('input',
      e => this.onFriendlyNameChanged(e)
    )

    // Prevent text selection on double-clicking a device list entry
    this.discoveredDevices.addEventListener('mousedown', e => {
      e.preventDefault()
      return false
    })

    // Set the initial keyboard focus to the Connect button
    this.connectButton.focus()

    // Add an event handler to the device list page to generate a click event
    // on the Connect button whenever the Enter key is pressed
    this.deviceListPage.addEventListener('keydown', e => {
      if (VBKeys.keyVal(e) === VBKeys.ENTER) {
        // Check whether a device list row is focused; if so, select that item
        const elem = document.activeElement
        if (elem.tagName === 'TR' && elem.id.startsWith('sn-')) {
          elem.click()
        }
        this.connectButton.click()
      }
    })

    // Initiate SSDP discovery
    // Make sure not to start discovery until List panel set up
    VBDiscover.discover(this.onDiscoveredDevice.bind(this))
  }

  // Convert the snTable Map() object into a JSON string
  snTableToJSONString() {
    return JSON.stringify([...this.snTable])
  }

  // Read the saved list of discovered devices to populate the SN table
  restoreDeviceList() {
    try {
      // When setting up config must convert JSON stringified array list to Map
      return new Map(JSON.parse(this.config.snTable))
    }
    catch (e) {
      console.log('Exception restoring device list:', e)
      return new Map()
    }
  }

  getDeviceDetailsForIP(ip) {
    for (let snEntry of this.snTable.values()) {
      if (snEntry.ipAddr === ip) {
        return snEntry
      }
    }
    return null
  }

  // The device table is sorted then used to update the UI
  // This function should only be called when there is
  // a change to the device table
  updateUIDevices() {

    // Sort the device table by ip address
    const sorted = [...this.snTable.values()].sort((a, b) => a.ip32 - b.ip32)

    // Remove all discovered device entries from display
    while (this.deviceTableBody.firstChild) {
      this.deviceTableBody.removeChild(this.deviceTableBody.firstChild)
    }

    // Add discovered device entries from the new sorted table
    for (let entry of sorted) {
      const tr = document.createElement('TR')

      // Needs to have tabIndex set in order to receive keydown events
      tr.tabIndex = 0

      // Give the row an id based on the device serial number
      tr.id = 'sn-' + entry.serialNumber

      tr.addEventListener('keydown',
        e => this.onDeviceListKeydown(e)
      )

      // IP address
      const tdIp = document.createElement('TD')
      tdIp.appendChild(document.createTextNode(entry.ipAddr))
      tdIp.classList.add('ipAddr')

      // Friendly name
      const tdFn = document.createElement('TD')
      tdFn.appendChild(document.createTextNode(entry.friendlyName))

      // Delete button (use a circle with an "x" in the middle)
      const tdDel = document.createElement('TD')
      tdDel.appendChild(document.createTextNode('\u24e7'))
      tdDel.classList.add('del')
      tdDel.addEventListener('click', e => {
        // Don't want this registering as a click to select the device
        e.stopPropagation()
        // Add the delete device event-handler
        this.deleteDevice(entry.serialNumber)
      })

      tr.appendChild(tdIp)
      tr.appendChild(tdFn)
      tr.appendChild(tdDel)

      this.deviceTableBody.appendChild(tr)
    }

    // Fill in the selected device details for the last selected device
    this.displaySelectedDevice(this.connectToIp.value)
  }

  // Fill in information for the selected device
  // Use the Serial Number table, keyed on serial number
  displaySelectedDevice(ip) {
    const device = this.getDeviceDetailsForIP(ip)

    // Update Selected Device details fields
    if (device) {
      this.friendlyName.value  = device.friendlyName
      this.serialNumber.value  = device.serialNumber
      this.modelNumber.value   = device.modelNumber
      this.modelName.value     = device.modelName
    }
    else {
      this.friendlyName.value  = ' '
      this.serialNumber.value  = ' '
      this.modelNumber.value   = ' '
      this.modelName.value     = ' '
    }

    // If we found the device in the discovered device list,
    // mark it as selected, marking all other devices as not selected
    const trList = this.discoveredDevices.getElementsByTagName('tr')
    for (let i = 0; i < trList.length; i++) {
      const tr = trList[i]
      if (tr) {
        if (device && 'sn-' + device.serialNumber === tr.id) {
          tr.classList.add('selectedDevice')
        }
        else {
          tr.classList.remove('selectedDevice')
        }
      }
    }
    return device
  }

  // Delete a device from the discovered device list
  // Deleted devices will not be re-added when a discovery response is received
  // The deleted device list is not persisted across sessions
  deleteDevice(serialNumber) {
    // Add device to deleted device list if not already there
    // Can't think of a case where this would not be true,
    // but handle it anyway
    if (this.deletedDeviceList.indexOf(serialNumber) === -1) {
      this.deletedDeviceList.push(serialNumber)
    }
    this.snTable.delete(serialNumber)
    this.updateUIDevices()
    // Send an IPC to the Main Process so it can update its copy
    // of the discoveredDeviceList, which will be persisted to disk on shutdown
    ipcRenderer.send('device-list', this.snTableToJSONString())
  }

  // Update a serial number table entry
  // Return true if the updated entry differs from the previous entry
  updateSnEntry(snEntry, device) {
    const oldIpAddr       = snEntry.ipAddr
    const oldFriendlyName = snEntry.friendlyName
    const oldModelName    = snEntry.modelName
    const oldModelNumber  = snEntry.modelNumber

    // If the IP address has changed, calculate the 32-bit ip value
    if (snEntry.ipAddr !== device.ipAddr) {
      snEntry.ipAddr = device.ipAddr
      snEntry.ip32 = ipAddrTo32(device.ipAddr)
    }

    // Don't update the friendly name unless it was previously blank,
    // because the user could have updated the friendly name manually
    if (snEntry.friendlyName === '') {
      snEntry.friendlyName = device.friendlyName
    }

    // Don't update the table with blank values for model name/number,
    // which would happen if an SSDP Notify was received,
    // but no response could be obtained
    if (device.modelName !== '') {
      snEntry.modelName = device.modelName
    }

    if (device.modelNumber !== '') {
      snEntry.modelNumber = device.modelNumber
    }

    // Return true if any field has changed in value (SN does not change)
    return !( snEntry.ipAddr       === oldIpAddr        &&
              snEntry.friendlyName === oldFriendlyName  &&
              snEntry.modelName    === oldModelName     &&
              snEntry.modelNumber  === oldModelNumber )
  }

  // Called when an ECP response has been received from a device
  // Search for an entry containing the serial number
  // If an entry with the serial number is found,
  // check whether there is another entry with the same IP address;
  // if so, delete it
  // Update the IP address, but don't update the existing fields
  // unless they are blank [The user may have changed them. e.g. friendlyName]
  // If serial number was not found, create a new entry,
  // also check whether that ip address exists for another entry,
  // and if so delete the other entry
  onDiscoveredDevice(details) {
    let changed = false

    // Don't include devices in the deleted devices table
    if (this.deletedDeviceList.indexOf(details.serialNumber) === -1) {
      // Check whether the serial number is already in the table
      if (this.snTable.has(details.serialNumber)) {
        // Update an existing snTable entry
        const snEntry = this.snTable.get(details.serialNumber)
        const updated = this.updateSnEntry(snEntry, details)
        this.snTable.set(details.serialNumber, snEntry)
        if (updated) {
          changed = true
        }
      }
      else {
        // New serial number -- add new device
        this.snTable.set(details.serialNumber, new SnEntry(details))
        changed = true
      }

      // Check whether the ip address was previously assigned
      // to another device; if so, delete the old entry
      for (let snItem in this.snTable) {
        // Ignore the current entry
        if (snItem.serialNumber !== details.serialNumber) {
          if (snItem.ipAddr === details.ipAddr) {
            this.snTable.delete(snItem)
            changed = true
            break
          }
        }
      }

      // If the device table has changed, update the UI
      if (changed) {
        this.updateUIDevices()

        // Send an IPC to the Main Process so it can update its copy of the
        // discoveredDeviceList, which will be persisted to disk on shutdown
        ipcRenderer.send('device-list', this.snTableToJSONString())
      }
    }
  }

  // The Connect button has been clicked
  // Establish a new connection with the specified device
  onConnectClick(e) {
    // Invalid ip address will be returned with ip32 property of zero
    const ip = validIpAddr(this.connectToIp.value)

    // Invalid port will be returned as zero
    const port = validPort(this.connectToPort.value)

    // If the ip address and port are valid, attempt to establish a connection
    if (ip && port) {
      // Fill in the selected device details
      if (!this.displaySelectedDevice(ip)) {
        // If the IP does not exist in the discovered device table,
        // send off an ECP request to get its details
        VBDiscover.ecp(ip, this.onDiscoveredDevice.bind(this))
      }

      // The connect callback executes in the DockPanel's context
      this.connectCallback(ip, port)

      // Send IPC to main process so its config object can be updated
      // to record the last connected device and port
      ipcRenderer.send('update-last-connected-device', ip, port.toString())
    }
  }

  // If a discovered device list entry is clicked, then fill in
  // the 'Connect To' ip address and discovered device details
  onDeviceListClick(e) {
    let ip = ''
    const tr = e.target.closest('tr')
    if (tr !== null) {
      const elem = tr.querySelector('td.ipAddr')
      if (elem !== null) {
        tr.focus()
        ip = elem.firstChild.nodeValue
      }
    }
    if (ip) {
      // Fill in Connect To ip address
      this.connectToIp.value = ip

      // Fill in the selected device details
      this.displaySelectedDevice(ip)
    }
  }

  // If a discovered device list entry is double-clicked,
  // then connect to that device
  // Note that a 'click' event will have been raised just before this event
  onDeviceListDblClick(e) {
    this.connectButton.click()
  }

  // Key Up/Down handler for discovered devices list
  onDeviceListKeydown(e) {
    // Only handle keydown events on <tr> elements
    if (e.target && e.target.nodeName === 'TR') {
      const tr = e.target
      let sibling = null
      // Get the key value (only handle Up and Down)
      const keyVal = VBKeys.keyVal(e)
      switch (keyVal) {
        case VBKeys.UP:
          e.preventDefault()
          // Click on the previous <li>'s <input> descendant
          sibling = tr.previousElementSibling
          if (sibling) {
            // Generate a click event on the previous <li> element
            sibling.focus()
            sibling.click()
          }
          break
        case VBKeys.DOWN:
          e.preventDefault()
          // Click on the next <li>'s <input> descendant
          sibling = tr.nextElementSibling
          if (sibling) {
            // Generate a click event on the next <li> element
            sibling.focus()
            sibling.click()
          }
          break
      }
    }
  }

  onFriendlyNameChanged(e) {
    const tr = this.discoveredDevices.querySelector('.selectedDevice')
    // Get the serial number from the <tr> id attribute
    if (tr) {
      // The id is of the form "id-serialNumber"
      const sn = tr.id.substring(3)
      if (sn) {
        // Get the device table entry for that serial number
        const snEntry = this.snTable.get(sn)
        // Only update if the friendly name has changed
        if (snEntry && snEntry.friendlyName !== this.friendlyName.value) {
          // Update the discovered device table with the new friendly name
          snEntry.friendlyName = this.friendlyName.value
          this.snTable.set(sn, snEntry)
          // Update the discovered device list with the new friendly name
          this.updateUIDevices()
          // Send an IPC to the Main Process so it can update its copy of the
          // discoveredDeviceList, which will be persisted to disk on shutdown
          ipcRenderer.send('device-list', this.snTableToJSONString())
        }
      }
    }
  }

}

// Validate and return an ip address string
// Return an empty string if the ip address string is invalid
function validIpAddr(ipAddr) {
  let ipAddrReturn = ipAddr.trim()
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipAddrReturn)) {
    ipcRenderer.send('error-dialog', 'Invalid IP address')
    ipAddrReturn = ''
  }
  return ipAddrReturn
}

// Validate a string representation of a port number.
// A port number must be between 1 and 65535.
// Return the port number if valid.
// Return zero for an invalid port number
function validPort(port) {
  let portReturn = parseInt(port, 10)
  if (!(!isNaN(portReturn) && portReturn > 0 && portReturn < 65536)) {
    ipcRenderer.send('error-dialog', 'Invalid Port')
    portReturn = 0
  }
  return portReturn
}

// Convert an ip address of the form nnn.nnn.nnn.nnn to a
// 32-bit (unsigned) integer -- used for sorting device list
function ipAddrTo32(ipAddr) {
  let ip32 = 0
  const ma = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ipAddr)
  if (Array.isArray(ma) && ma.length == 5) {
    // Note - don't use JavaScript's bit shift operators
    // (they coerce operands to SIGNED 32-bit integers; we need unsigned)
    ip32 = ((ma[1] * 256 + ma[2]) * 256 + ma[3]) * 256 + ma[4]
  }
  return ip32
}

// The Serial Number table is a Map() object with a key of Serial Number
// The value of the Map() object has the following structure
// Note that ip32 is used to establish the sort order
function SnEntry(device) {
  this.serialNumber = device.serialNumber
  this.ipAddr       = device.ipAddr
  this.friendlyName = device.friendlyName
  this.modelName    = device.modelName
  this.modelNumber  = device.modelNumber
  this.ip32         = ipAddrTo32(device.ipAddr)
}

module.exports = VBListPanel
