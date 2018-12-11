'use strict';

const { LogHandler } = require('@applitools/eyes-sdk-core');
const { Eyes: EyesSelenium, EyesSeleniumUtils } = require('@applitools/eyes-selenium');

class WctEyes extends EyesSelenium {
  /**
   * @param {object} [wct]
   * @param {object} [configs]
   * @param {string} [configs.apiKey]
   * @param {string} [configs.serverUrl]
   * @param {string|boolean} [configs.proxy]
   * @param {boolean} [configs.verbose]
   * @param {string} [configs.pluginVersion]
   */
  constructor(wct, configs) {
    super();

    if (configs.apiKey !== undefined) {
      this.setApiKey(configs.apiKey);
    }
    if (configs.serverUrl !== undefined) {
      this.setServerUrl(configs.serverUrl);
    }
    if (configs.proxy !== undefined) {
      this.setProxy(configs.proxy);
    }
    if (configs.verbose !== undefined) {
      this.setLogHandler(new WctLogHandler(wct, true));
    }

    this.pluginVersion = configs.pluginVersion;
  }

  // noinspection JSMethodCanBeStatic, JSUnusedGlobalSymbols
  /** @inheritDoc */
  getBaseAgentId() {
    return `eyes.wct/${this.pluginVersion}`;
  }

  /** @inheritDoc */
  async getViewportSize() {
    const viewportSize = this._viewportSizeHandler.get();
    if (viewportSize) {
      return viewportSize;
    }

    this._logger.verbose('Extracting viewport size...');
    return EyesSeleniumUtils.getViewportSizeOrDisplaySize(this._logger, this._driver);
  }
}


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
    this._wct.emit(verbose ? 'log:debug' : 'log:info', this.formatMessage(logString));
  }
}

exports.WctLogHandler = WctLogHandler;
exports.WctEyes = WctEyes;
