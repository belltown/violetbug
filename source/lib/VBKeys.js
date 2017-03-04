'use strict';

class VBKeys {

  static keyVal(e) {

    const key     = e.code

    const alt     = e.altKey.valueOf()
    const ctrl    = e.ctrlKey.valueOf()
    const meta    = e.metaKey.valueOf()
    const shift   = e.shiftKey.valueOf()

    const noSACM  = !(shift || alt || ctrl || meta)

    // Keys without modifiers
    if (noSACM) {
      if (key === 'Enter')      return this.ENTER
      if (key === 'Escape')     return this.ESCAPE
      if (key === 'ArrowUp')    return this.UP
      if (key === 'ArrowDown')  return this.DOWN
      if (key === 'PageUp')     return this.PGUP
      if (key === 'PageDown')   return this.PGDN
      if (key === 'Tab')        return this.TAB
      return this.OTHER
    }

    // Keys with modifiers
    if (key === 'Tab'  &&  shift && !alt && !ctrl && !meta) return this.SHTAB
    if (key === 'KeyC' && !shift && !alt &&  ctrl && !meta) return this.CTRLC
    if (key === 'KeyF' && !shift && !alt &&  ctrl && !meta) return this.CTRLF
    if (key === 'KeyI' && !shift && !alt &&  ctrl && !meta) return this.CTRLI
    if (key === 'KeyC' && !shift &&  alt && !ctrl && !meta) return this.ALTC

    // Handle Command/F for macOS the same as CTRL/F (Find)
    if (process.platform === 'darwin' &&
        (key === 'KeyF' && !shift && !alt && !ctrl && meta)) {
        return this.CTRLF
        }

    // Shortcut keys
    if ((key >= 'Digit0' && key <= 'Digit9') &&
        (!shift && !alt && ctrl && !meta)) {
      return e.key - '0' + this.CTRL0
    }

    return this.OTHER

  }

}

VBKeys.OTHER    = 0
VBKeys.ENTER    = 1
VBKeys.ESCAPE   = 2
VBKeys.UP       = 3
VBKeys.DOWN     = 4
VBKeys.PGUP     = 5
VBKeys.PGDN     = 6
VBKeys.TAB      = 7
VBKeys.DEL      = 8
VBKeys.SHTAB    = 9
VBKeys.CTRLC    = 10
VBKeys.CTRLF    = 11
VBKeys.CTRLI    = 12
VBKeys.ALTC     = 13
VBKeys.CTRL0    = 20
VBKeys.CTRL1    = 21
VBKeys.CTRL2    = 22
VBKeys.CTRL3    = 23
VBKeys.CTRL4    = 24
VBKeys.CTRL5    = 25
VBKeys.CTRL6    = 26
VBKeys.CTRL7    = 27
VBKeys.CTRL8    = 28
VBKeys.CTRL9    = 29

module.exports  = VBKeys
