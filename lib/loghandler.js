'use strict';

const { LogHandler } = require('@applitools/eyes.sdk.core');

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

  // noinspection JSUnusedGlobalSymbols
  /**
   * Handle a message to be logged.
   *
   * @param {boolean} verbose - is the message verbose
   * @param {string} logString
   */
  onMessage(verbose, logString) {
    if (!verbose) {
      this._wct.emit('log:info', this.formatMessage(logString));
    }

    // if (this._isVerbose) {
    //   this._wct.emit('log:debug', this.formatMessage(logString));
    // }
  }
}

exports.WctLogHandler = WctLogHandler;
