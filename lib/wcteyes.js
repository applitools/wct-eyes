'use strict';

const { LogHandler, TypeUtils } = require('@applitools/eyes-sdk-core');
const { Eyes: EyesSelenium, EyesSeleniumUtils } = require('@applitools/eyes-selenium');
const { By } = require('selenium-webdriver');

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

    if (configs.verbose) {
      this.setLogHandler(new WctLogHandler(wct, true));
    }
    if (TypeUtils.isNotNull(configs.apiKey)) {
      this._logger.verbose(`ApiKey is set to '${configs.apiKey}'.`);
      this.setApiKey(configs.apiKey);
    }
    if (TypeUtils.isNotNull(configs.serverUrl)) {
      this._logger.verbose(`ServerUrl is set to '${configs.serverUrl}'.`);
      this.setServerUrl(configs.serverUrl);
    }
    if (TypeUtils.isNotNull(configs.proxy)) {
      this._logger.verbose(`Proxy is set to '${configs.proxy}'.`);
      this.setProxy(configs.proxy);
    }

    this._pluginVersion = configs.pluginVersion;
    this._subsuitesWidth = configs.subsuitesWidth.toString();
    if (this._subsuitesWidth && !this._subsuitesWidth.endsWith('px')) {
      this._subsuitesWidth += 'px';
    }
  }

  /**
   * @param {WebDriver} driver
   * @param appName
   * @param testName
   * @param frameId
   * @return {Promise<void>}
   */
  async open(driver, appName, testName, frameId) {
    await super.open(driver, appName, testName);

    let frameElement = await this._findElementSafe(By.id(frameId));

    if (this._subsuitesWidth) {
      await driver.executeScript(`document.getElementById('subsuites').style.width = "${this._subsuitesWidth}";` +
        `document.getElementById('mocha').style.left = "${this._subsuitesWidth}";`);
    }

    while (frameElement == null) {
      const innerFrameElement = await this._driver.findElement(By.css('.subsuite'));
      await this._driver.switchTo().frame(innerFrameElement);

      if (this._subsuitesWidth) {
        await driver.executeScript(`document.getElementById('subsuites').style.width = "${this._subsuitesWidth}";`);
      }

      frameElement = await this._findElementSafe(By.id(frameId));
    }
  }

  // noinspection JSMethodCanBeStatic, JSUnusedGlobalSymbols
  /** @inheritDoc */
  getBaseAgentId() {
    return `eyes.wct/${this._pluginVersion}`;
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

  async _findElementSafe(selector) {
    try {
      return await this._driver.findElement(selector);
    } catch (e) {
      return null;
    }
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
