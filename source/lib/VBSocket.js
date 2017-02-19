'use strict';

// Node.js modules
const net = require('net')

// Electron modules
const {ipcRenderer} = require('electron')

class VBSocket {

  constructor(ip, port) {
    // IP address (string)
    this.ip = ip

    // Port (integer)
    this.port = port

    // Node.js Socket object
    this.socket = null

    // Callbacks into VBConnPanel object
    this.socketDataCallback     = null
    this.socketConnectCallback  = null
    this.socketCloseCallback    = null
    this.socketErrorCallback    = null
    this.socketTimeoutCallback  = null
   }

   registerDataCallback(callback) {
      this.socketDataCallback = callback
   }

   registerConnectCallback(callback) {
     this.socketConnectCallback = callback
   }

   registerCloseCallback(callback) {
     this.socketCloseCallback = callback
   }

   registerErrorCallback(callback) {
     this.socketErrorCallback = callback
   }

   registerTimeoutCallback(callback) {
     this.socketTimeoutCallback = callback
   }

  terminate() {
    if (this.socket) {
      this.socket.destroy()
    }
    this.socketDataCallback     = null
    this.socketConnectCallback  = null
    this.socketCloseCallback    = null
    this.socketErrorCallback    = null
    this.socketTimeoutCallback  = null
    this.socket = null
  }

  write(data) {
    if (this.socket) {
      this.socket.write(data)
    }
  }

  // Establish a connection with the specifed ip address and port
  setupConnectionSocket(reConnect) {

    // Create a full-duplex TCP socket for the connection
    this.socket = net.connect({host: this.ip, port: this.port})

    // Note that the 'data' listener is registered from within the
    // 'connect' listener as we don't want any data received until
    // the UI needed to display it is fully set up
    this.socket.on('connect', () => {
      this.onSocketConnect()
    })

    this.socket.on('close', (had_error) => {
      this.onSocketClose(had_error)
    })

    this.socket.on('error', (error) => {
      this.onSocketError(error)
    })

    this.socket.on('timeout', () => {
      this.onSocketTimeout()
    })

  }

  onSocketData(buffer) {
    // Pass a Buffer object (NOT a UTF-8 encoded string) back to the caller
    // This is because Buffers are stored outside of the V-8 heap space,
    // thus minimizing the memory used by the user process,
    // which we need to do because the user queues the Buffer objects
    // until the next animation frame timeout occurs
    // If a lot of data is received faster than the user can process it,
    // the the memory in the user processes could potentially grow quite large
    if (this.socketDataCallback) {
      this.socketDataCallback(buffer)
    }

  }

  onSocketConnect() {
    if (this.socketConnectCallback) {
      this.socketConnectCallback()
    }

    // The 'data' event handler must be added AFTER the DOM is set up
    this.socket.on('data', (buffer) => {
      this.onSocketData(buffer)
    })

  }

  onSocketClose(had_error) {
    if (this.socket) {
      this.socket = null
    }

    if (this.socketCloseCallback) {
      this.socketCloseCallback()
    }
  }

  onSocketError(error) {
    console.log('Connect Event: error: %O', error)

    ipcRenderer.send('error-dialog',
                     `Connection Error ${this.ip}:${this.port}`,
                     error.message)

    if (this.socket) {
      this.socket = null
    }

    if (this.socketErrorCallback) {
      this.socketErrorCallback()
    }
  }

  onSocketTimeout() {
    ipcRenderer.send('error-dialog',
                     `Connection Timeout ${this.ip}:${this.port}`)

    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }

    if (this.socketTimeoutCallback) {
      this.socketTimeoutCallback()
    }
  }

}

module.exports = VBSocket
