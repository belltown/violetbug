'use strict';

// Node.js modules
const os = require('os')          // To get network interfaces
const http = require('http')      // ECP requests
const dgram = require('dgram')    // SSDP M-SEARCH and NOTIFY

// RegEx to extract ip addr/serial number from M-SEARCH and NOTIFY responses
const reIpAddr = /\r\nLocation\s*:\s*(?:.*?:\/\/)?([^:\/\r\n]+)/i
const reSerialNumber = /\r\nUSN:\s*uuid:roku:ecp:\s*([A-Z0-9]+)/i

// Use a regular expression to extract a field from some data,
// returning an empty string if the field is not found
function extract(re, data) {
  const m = re.exec(data)
  return Array.isArray(m) && m.length === 2 ? m[1] : ''
}

// Extract device details from a device's ECP response
// Not terribly efficient, but it doesn't need to be
// In case there was an error getting an ECP response,
// return the serial number from the M-SEARCH/NOTIFY response
function parseDeviceDetails(ipAddr, sn, data) {
  return {
    ipAddr:       ipAddr,
    serialNumber: sn || extract(/<serialNumber>(.*?)<\/serialNumber>/i, data),
    friendlyName: extract(/<friendlyName>(.*?)<\/friendlyName>/i, data),
    modelNumber:  extract(/<modelNumber>(.*?)<\/modelNumber>/i, data),
    modelName:    extract(/<modelName>(.*?)<\/modelName>/i, data)
  }
}

// Send an ECP request to the device to get its details
// Invoke the callback to pass the device details back to the caller
function deviceDiscovered(ipAddr, serialNumber, discoveryCallback) {
  let remoteAddress = ''
  const bufferList = []
  const req = http.request({host: ipAddr, port: 8060, family: 4}, (res) => {
    res.on('data', (chunk) => {
      bufferList.push(chunk)
    })
    res.on('end', () => {
      const response = Buffer.concat(bufferList).toString()
      // Use the remoteAddress obtained from the socket event in case
      // an ECP request has been issued specifying a host name
      // rather than an IP address
      const ip = remoteAddress || ipAddr
      const details = parseDeviceDetails(ip, serialNumber, response)
      if (details.serialNumber) {
        discoveryCallback(details)
      }
    })
  })

  // A 'socket' event is emitted after a socket is assigned to the request
  // Handle this event to set a timeout on the socket connection
  // This is instead of setting the timeout when http.request() is called,
  // which would only be emitted after the socket is assigned and is connected,
  // and would not detect a timeout while trying to establish the connection
  // Additionally, we'll need to listen for the socket connect event so we
  // can obtain the remote IP address in case an ECP request was issued to
  // a host name rather than an IP address
  req.on('socket', (socket) => {
    socket.setTimeout(10000)
    socket.on('timeout', () => {
      console.log('deviceDiscovered socket timeout')
      // A timeout does not abort the connection; it has to be done manually
      // This will cause a createHangUpError error to be emitted on the request
      req.abort()
    })
    // Listen for the socket connect event so we can determine the
    // IP address of the Roku, which will be necessary if an ECP request
    // was issue to a host name rather than an IP address; this will
    // be the earliest time we can determine what the IP address is
    socket.on('connect', () => {
      remoteAddress = socket.remoteAddress
    })
  })

  // Even if there is an error on the ECP request, invoke the
  // discoveryCallback with the known ip address and serial number
  req.on('error', (error) => {
    // Use the remoteAddress obtained from the socket connect event in case
    // an ECP request has been issued specifying a host name
    // rather than an IP address
    const ip = remoteAddress || ipAddr
    const details = parseDeviceDetails(ip, serialNumber, '')
    if (details.serialNumber) {
      discoveryCallback(details)
    }
    //console.log('deviceDiscovered error: %O', error)
  })

  // The ECP request has an empty body
  req.write('')

  // Send the ECP request
  req.end()
}

// Send an SSDP M-SEARCH discovery request
function ssdpSearchRequest(discoveryCallback) {
  const ssdpRequest = new Buffer(
                      'M-SEARCH * HTTP/1.1\r\n' +
                      'HOST: 239.255.255.250:1900\r\n' +
                      'MAN: "ssdp:discover"\r\n' +
                      'ST: roku:ecp\r\n' +
                      'MX: 3\r\n' +
                      '\r\n')

  const searchSocket = dgram.createSocket('udp4')

  searchSocket.on('message', (msg, rinfo) => {
    const ssdpResponse = msg.toString()
    const serialNumber = extract(reSerialNumber, ssdpResponse)
    const ipAddr = extract(reIpAddr, ssdpResponse)
    // Only add devices that have an ip address and serial number
    // This will trigger an ECP request to get the device details
    if (ipAddr && serialNumber) {
      deviceDiscovered(ipAddr, serialNumber, discoveryCallback)
    }
  })

  // Send the M-SEARCH request to the SSDP multicast group
  searchSocket.send(ssdpRequest, 1900, '239.255.255.250')
}

// Listen for SSDP discovery NOTIFY responses
// These should be received whenever a device connects to the network
function ssdpNotify(discoveryCallback) {
  let notifySocket = dgram.createSocket({type: 'udp4', reuseAddr: true})

  notifySocket.on('message', (msg, rinfo) => {
    const ssdpResponse = msg.toString()
    const serialNumber = extract(reSerialNumber, ssdpResponse)
    const ipAddr = extract(reIpAddr, ssdpResponse)

    // Only add devices that have an ip address AND Roku serial number,
    // to avoid sending ECP requests to non-Roku devices.
    if (ipAddr && serialNumber) {
      deviceDiscovered(ipAddr, serialNumber, discoveryCallback)
    }
  })

  // If binding fails, an 'error' event is generated
  // However, in some cases, an exception may be thrown,
  // hence the 'try-catch' in the bind() function
  notifySocket.on('error', (e) => {
    console.log('notifySocket error: %O', e)
  })

  // SSDP NOTIFY responses are directed to port 1900
  notifySocket.bind(1900, () => {
    try {
      // Prevent receipt of local SSDP M-SEARCH requests
      notifySocket.setMulticastLoopback(false)

      // Join the SSDP multicast group so we can receive SSDP NOTIFY responses
      notifySocket.addMembership('239.255.255.250')
    }
    catch (e) {
      console.log('notifySocket.bind exception: %O', e)
    }
  })

  // If the network connection drops, then no further NOTIFY responses
  // will be received on the bound port
  // Since there is no indication of a network connection failure,
  // after a predetermined timeout, close then re-establish the connection
  setTimeout( () => {
    try {
      notifySocket.close( () => {ssdpNotify(discoveryCallback)} )
    }
    catch (e) {
      console.log('Exception when trying to close socket: %O', e)
    }
  }, 5 * 60 * 1000 )
}

// The SSDP protocol, which uses UDP datagrams, is inherently flaky
// M-SEARCH responses are not guaranteed to be received.
// To make allowances for this, send out multiple M-SEARCH requests
function ssdpSearch(discoveryCallback) {
  setTimeout(ssdpSearchRequest, 0, discoveryCallback)
  setTimeout(ssdpSearchRequest, 15000, discoveryCallback)
  setTimeout(ssdpSearchRequest, 30000, discoveryCallback)
}

// Convert an IP address from a dotted decimal string to a 32-bit integer
function ipAddrTo32 (ipAddr) {
  let ip32 = 0
  const ma = ipAddr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (Array.isArray(ma) && ma.length === 5) {
    const d0 = parseInt(ma[1], 10)
    const d1 = parseInt(ma[2], 10)
    const d2 = parseInt(ma[3], 10)
    const d3 = parseInt(ma[4], 10)
    ip32 = ((d0 * 256 + d1) * 256 + d2) * 256 + d3
  }
  return ip32
}

// Convert a 32-bit IP address to a dotted decimal string
function ip32ToAddr(ip32) {
  const d3 = ip32 % 256
  let r = (ip32 - d3) / 256
  const d2 = r % 256
  r = (r - d2) / 256
  const d1 = r % 256
  const d0 = (r - d1) / 256
  return d0 + '.' + d1 + '.' + d2 + '.' + d3
}

// Send an ECP request to each potential host on the network
function subnetScan(discoveryCallback, hostLimit = 256) {

  // Get the list of all network interfaces
  const interfaceList = os.networkInterfaces()

  // Examine each network interface
  for (let interfaceListEntry of Object.values(interfaceList)) {

    // Get the list of IP addresses handled by this interface
    for (let interfaceItem of Object.values(interfaceListEntry)) {

      // Only handle non-internal (not loopback), IPv4 addresses
      if (!interfaceItem.internal && interfaceItem.family === 'IPv4') {

        // Convert the interface ip address and subnet mask
        // from dotted decimal to 32-bit integers
        const ip32 = ipAddrTo32(interfaceItem.address)
        const mask32 = ipAddrTo32(interfaceItem.netmask)

        // Only continue if the ip address and subnet mask are valid
        if (ip32 > 0 && mask32 > 0) {

          // Use the subnet mask to determine the maximum number of
          // hosts to scan for on this subnet
          const maxHosts = (2 ** 32) - mask32

          // Limit the maximum number of hosts addressed
          const lastHost = maxHosts > hostLimit ? hostLimit : maxHosts

          // Compute the base address for all hosts on this subnet
          const base32 = ip32 - (ip32 % maxHosts)

          // Scan each host on this subnet (don't scan first and last)
          for (let i = 1; i < lastHost - 1; i++) {

            // Generate next host ip address
            const host32 = base32 + i

            // Don't send an ECP request to ourself
            if (host32 !== ip32) {
              const ipAddr = ip32ToAddr(host32)
              // Send an ECP request to the host ip address
              deviceDiscovered(ipAddr, '', discoveryCallback)
            }
          }
        }
      }
    }
  }
}

class VBDiscover {

  // Initiate SSDP discovery
  static discover(discoveryCallback, maxHostsToScan = 256) {
    ssdpSearch(discoveryCallback)
    ssdpNotify(discoveryCallback)
    subnetScan(discoveryCallback, maxHostsToScan)
  }

  // Attempt to acquire device details from a user-entered, non-discovered
  // device, for which the serial number is unknown
  static ecp(ipAddr, discoveryCallback) {
    deviceDiscovered(ipAddr, '', discoveryCallback)
  }

}

module.exports = VBDiscover
