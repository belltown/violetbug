'use strict';

const VBKeys = require('./VBKeys')

class VBHistory {

  constructor() {
    // List of previous commands entered. Every time the Enter key is pressed,
    // an entry is added to the end of the history buffer
    this.historyBuffer = new Array()

    // The history index always indicates the index in the history buffer
    // where the next entry will be written (if at the end of the buffer),
    // or the index of the last item viewed when using the up/down keys
    // to navigate through the history buffer
    this.historyIndex = 0

    // A kludgy way of keeping track of whether the user enters a
    // previously-selected history item when navigating the history buffer
    this.prevText = ''

    // A flag set when text is entered while navigating through
    // the history buffer, if a previously-selected history item is entered
    this.redo = false

    // When navigating command history using the Tab/Shift-Tab keys,
    // keeps track of where we are in the history buffer
    // Resets when the Enter key is pressed
    this.tabIndex = -1

    // When a sequence of Tab/Shift-Tab presses is used for command completion,
    // keeps track of what the user had entered before the first tab press
    this.tabText = ''

    // Used to detect whether user changes the command line while
    // cycling through tab completions
    this.prevTabText = ''

  }

  emptyString(s) {
    return s.length === 0 || !s.trim()
  }

  doEnter(lineIn) {
    if (!this.emptyString(lineIn)) {
      if (this.historyIndex === this.historyBuffer.length) {
        // Not going through history, add text to end, set index to past end
        this.redo = false
        ++this.historyIndex
      }
      else if (lineIn === this.prevText) {
        // Going through history, picked a prior history item,
        // don't change index
        this.redo = true
      }
      else {
        // Going through history, changed a prior history item
        this.redo = false
        this.historyIndex = this.historyBuffer.length + 1
      }
      this.historyBuffer.push(lineIn)
    }
    // Reset for tab-completion
    this.tabIndex = -1
    this.tabText = ''
    this.prevTabText = ''
    return null
  }

  doUp(lineIn) {
    let lineOut = null
    if (this.historyBuffer.length > 0) {
        if (!this.redo && this.historyIndex > 0) {
            --this.historyIndex
        }
        this.redo = false
        this.prevText = this.historyBuffer[this.historyIndex]
        lineOut = this.historyBuffer[this.historyIndex]
    }
    return lineOut
  }

  doDown(lineIn) {
    let lineOut = null
    if (this.historyBuffer.length > 0) {
      if (this.historyIndex < this.historyBuffer.length - 1) {
        ++this.historyIndex
        lineOut = this.historyBuffer[this.historyIndex]
        this.prevText = this.historyBuffer[this.historyIndex]
      }
      this.redo = false
    }
    return lineOut
  }

  doPgUp(lineIn) {
    let lineOut = null
    if (this.historyBuffer.length > 0) {
      this.redo = false
      this.historyIndex = 0
      lineOut = this.historyBuffer[0]
    }
    return lineOut
  }

  doPgDown(lineIn) {
    let lineOut = null
    if (this.historyBuffer.length > 0) {
      this.redo = false
      this.historyIndex = this.historyBuffer.length - 1
      lineOut = this.historyBuffer[this.historyIndex]
    }
    return lineOut
  }

  doTab(lineIn) {
    let lineOut = null
    if (!this.emptyString(lineIn) && this.historyBuffer.length > 0) {
      // If we are just starting a sequence of Tab completions,
      // use the current input text and history index
      if (this.tabIndex === -1) {
        this.tabIndex = this.historyIndex
        this.tabText = lineIn
      }
      // Detect whether the user changed the command line while
      // cycling through tab completions
      else if (lineIn !== this.prevTabText) {
        this.tabText = lineIn
      }
      // Search the history buffer cyclically
      for (let i of this.historyBuffer) {
        // If we've reached the start of the history buffer,
        //resume from the end of the buffer
        if (--this.tabIndex < 0) {
          this.tabIndex = this.historyBuffer.length - 1
        }
        // Check if the item being examined starts with the input string
        if (this.historyBuffer[this.tabIndex].startsWith(this.tabText)) {
          lineOut = this.historyBuffer[this.tabIndex]
          // We found a match; we're done
          this.prevTabText = this.historyBuffer[this.tabIndex]
          break
        }
      }
    }
    return lineOut
  }

  doShiftTab(lineIn) {
    let lineOut = null
    if (!this.emptyString(lineIn) && this.historyBuffer.length > 0) {
      // If we are just starting a sequence of Tab completions,
      // use the current input text and history index
      if (this.tabIndex === -1) {
        this.tabIndex = this.historyIndex
        this.tabText = lineIn
      }
      // Detect whether the user changed the command line
      // while cycling through tab completions
      else if (lineIn !== this.prevTabText) {
        this.tabText = lineIn
      }
      // Search the history buffer cyclically
      for (let i of this.historyBuffer) {
        // If we've reached the start of the history buffer,
        // resume from the end of the buffer
        if (++this.tabIndex >= this.historyBuffer.length - 1) {
          this.tabIndex = 0
        }
        // Check if the item being examined starts with the input string
        if (this.historyBuffer[this.tabIndex].startsWith(this.tabText)) {
          lineOut = this.historyBuffer[this.tabIndex]
          // We found a match; we're done
          this.prevTabText = this.historyBuffer[this.tabIndex]
          break
        }
      }
    }
    return lineOut
  }

  keydown(keyVal, lineIn) {

    switch (keyVal) {
      case VBKeys.ENTER:    return this.doEnter(lineIn)
      case VBKeys.UP:       return this.doUp(lineIn)
      case VBKeys.DOWN:     return this.doDown(lineIn)
      case VBKeys.PGUP:     return this.doPgUp(lineIn)
      case VBKeys.PGDN:     return this.doPgDown(lineIn)
      case VBKeys.TAB:      return this.doTab(lineIn)
      case VBKeys.SHTAB:    return this.doShiftTab(lineIn)
    }

    return null

  }

}

module.exports = VBHistory
