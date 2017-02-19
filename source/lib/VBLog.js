'use strict';

// Node.js modules
const os = require('os')
const fs = require('fs')
const path = require('path')

// Electron modules
const {remote, ipcRenderer} = require('electron')
const {app, dialog} = remote

class VBLog {

  constructor(conn) {
    // Connection object for this log stream
    this.conn = conn

    // Log file writeable stream
    this.logStream = null

    // Flag indicating whether logging is in progress
    this.logging = false
  }

  // Display a dialog box for specifying a log file
  doDialog(config, dirname, filename) {

    dialog.showSaveDialog({
      title: 'Log File',
      defaultPath: path.join(dirname, filename)
    }, (pathname) => {
      if (pathname) {
        this.logStream = fs.createWriteStream(pathname, {
          flags: 'a',
          defaultEncoding: 'utf8'
        }).on('error', (err) => {
          console.log('Log write error:', err)
          this.logging = false
          this.logStream = null
        }).on('close', () => {
          this.logging = false
          this.logStream = null
        })
        this.logging = true
        this.write('Logging started' + os.EOL)
        // Update the Renderer's config object
        config.logfilePath = pathname
        // Send IPC to Main to update its config object
        ipcRenderer.send('update-log-file', pathname)
      }
    })
  }

  // Display a log file dialog after closing any existing open log file
  doLog(config, dirname, filename) {
    // If we already have a log file in use, then close its stream
    if (this.logStream) {
      this.logStream.end(() => {
        this.logStream = null
        this.doDialog(config, dirname, filename)
      })
    }
    else {
      this.doDialog(config, dirname, filename)
    }
  }

  // Specify a new log file
  logFile(config) {
    let filename = ''
    let dirname = ''
    // If there is already a logfile path in the config object, then use it
    if (config.logfilePath) {
      filename = path.basename(config.logfilePath)
      dirname = path.dirname(config.logfilePath)
      this.doLog(config, dirname, filename)
    }
    else {
      // By default, log files will be stored in the user's
      // Documents folder in the VioletBugLogs subfolder
      const documentsPath = app.getPath('documents')
      // Check if the user's documents directory exists
      fs.stat(documentsPath, (err, stats) => {
        if (!err && stats.isDirectory()) {
          dirname = path.join(documentsPath, 'VioletBugLogs')
          // Check if the VioletBugLogs directory exists
          fs.stat(dirname, (err, stats) => {
            if (!err && stats.isDirectory()) {
              // VioletBugLogs directory already exists
              this.doLog(config, dirname, filename)
            }
            else {
              // If VioletBugLogs does not exist then create it
              fs.mkdir(dirname, (err) => {
                if (!err) {
                  // Created new VioletBugLogs directory
                  this.doLog(config, dirname, filename)
                }
                else {
                  // Unable to create VioletBugLogs directory
                  dirName = ''
                  this.doLog(config, dirName, filename)
                }
              })
            }
          })
        }
        else {
          // User's documents directory does not exist
          this.doLog(config, dirName, filename)
        }
      })
    }

  }

  // Return true if there is a logStream open, otherwise false
  isLogStream() {
    return this.logStream != null
  }

  // Return if 'Resume logging' menu item can be enabled
  canResume() {
    return !!(this.logStream && !this.logging)
  }

  // Return if 'Pause logging' menu item can be enabled
  canPause() {
    return !!(this.logStream && this.logging)
  }

  // Resume logging
  resume() {
    if (this.logStream) {
      this.logging = true
    }
  }

  // Pause logging
  pause() {
    this.logging = false
  }

  // Close the log stream (when the connection ends)
  close() {
    if (this.logStream) {
      this.logStream.end()
    }
    this.logStream = null
    this.logging = false
  }

  // Write data to the log file (async)
  write(data) {
    if (this.conn && this.logStream && this.logging) {
      this.logStream.write(data)
    }
  }

}

module.exports = VBLog
