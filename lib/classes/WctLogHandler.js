'use strict';

const { LogHandler } = require('@applitools/eyes-selenium');

/**
 * Write log massages to the browser/node console
 */
class WctLogHandler extends LogHandler {
  /**
   * @param wct
   * @param {boolean} isVerbose Whether to handle or ignore verbose log messages.
   */
  constructor(wct, isVerbose) {
    super();

    this._wct = wct;
    this.setIsVerbose(isVerbose);
  }

  open() {}

  close() {}

  /** @inheritDoc */
  onMessage(verbose, logString) {
    this._wct.emit(verbose ? 'log:debug' : 'log:info', logString);
  }
}

exports.WctLogHandler = WctLogHandler;
