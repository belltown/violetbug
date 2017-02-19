'use strict';

// VBConfig may be used from either the Main or Renderer Process
// Note that in each Renderer Process, the config data is read from disk
// at startup, maintained locally while the program runs,
// but NOT written to disk on shutdown
// Only the VBConfig object maintained by the Main Process is
// saved to disk upon shutdown
// Therefore, any config changes made in a Renderer that need to be
// persisted must be communicated to the Main process using IPCs

const isRenderer = !!(process && process.type === 'renderer')
const electron = require('electron')
const {app} = isRenderer ? electron.remote : electron

// Node.js modules
const fs = require('fs')
const path = require('path')

class VBConfig {

  constructor() {
    // Config object, contains the parsed data read from the config JSON file
    this.config = null
  }

  // Set up the config object by reading the config JSON file
  init() {
    // Filename for the config file
    const fname = 'vb-config.json'

    // Use the user's appData folder for the config file
    const defaultFolder = app.getPath('userData')

    // Actual folder used for the config file
    let configFolder = ''

    // Full pathname of the config file
    let configPath = ''

    // JSON data read from config file
    let data = ''

    // Current app version if default config file is used
    let version = ''

    // Determine whether the config folder exists
    try {
      const stats = fs.statSync(defaultFolder)
      if (stats && stats.isDirectory()) {
        configFolder = defaultFolder
      }
    }
    catch (e) {
      // It's okay if the userData folder is missing
      // the first time the application is run
    }

    // If config folder does not exist, attempt to create it
    if (configFolder === '') {
      try {
        fs.mkdirSync(defaultFolder)
        configFolder = defaultFolder
      }
      catch (e) {
        console.log('VBConfig could not create userData folder:', e)
      }
    }

    // Append config filename to folder name
    // Note that if we couldn't create the config folder,
    // then the default program folder is used instead
    configPath = path.join(configFolder, fname)

    // Attempt to read the config file (it won't exist the first time run)
    try {
      data = fs.readFileSync(configPath, 'utf8')
    }
    catch (e) {
      data = ''
    }

    // If the config JSON data was read, parse it into a config object
    if (data) {
      // Attempt to parse the JSON data in the config file
      try {
        this.config = JSON.parse(data)
      }
      catch (e) {
        this.config = null
        console.log('VBConfig. JSON.parse error:', e)
      }
    }

    // If no config data found, use the default config file
    if (!this.config) {
      try {
        data = fs.readFileSync(path.join(__dirname, '..', fname), 'utf8')
        version = app.getVersion()
      }
      catch (e) {
        data = ''
        console.log('VBConfig. Unable to read default config: Error:', e)
      }

      if (data) {
        // Attempt to parse the JSON data in the default config file
        try {
          this.config = JSON.parse(data)
          // If default config file used, fill in the current package version
          if (version) {
            this.config.version = version
          }
        }
        catch (e) {
          this.config = null
          console.log('VBConfig. JSON.parse error for default config:', e)
        }
      }
    }

    // If we read the config data, save the pathname used in the config obj
    // Otherwise it will be a fatal error, to be handled by the caller
    if (this.config) {
      this.config.configPath = configPath
    }

    return this.config
  }

  // Save the config object
  // This is done during application shutdown in the Main Process
  // Use a synchronous write so the application doesn't shut down
  // before the config file is fully written
  save() {
    if (this.config) {
      try {
        fs.writeFileSync(this.config.configPath,
                         JSON.stringify(this.config, null, 2))
      }
      catch (e) {
        console.log('VBConfig. Unable to save config file:', e)
      }
    }
  }

}

module.exports = VBConfig
