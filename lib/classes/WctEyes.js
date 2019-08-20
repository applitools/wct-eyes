'use strict';

const { By } = require('selenium-webdriver');
const { GeneralUtils } = require('@applitools/eyes-common');
const { EyesSelenium, EyesSeleniumUtils, Configuration } = require('@applitools/eyes-selenium');

const { WctLogHandler } = require('./WctLogHandler');

class WctEyes extends EyesSelenium {
  /**
   * @param {object} [wct]
   * @param {object} [pluginOptions]
   * @param {ClassicRunner} [runner]
   * @param {string} [pluginOptions.apiKey]
   * @param {string} [pluginOptions.serverUrl]
   * @param {string|boolean} [pluginOptions.proxy]
   * @param {boolean} [pluginOptions.forceFullPageScreenshot]
   * @param {boolean} [pluginOptions.hideScrollbars]
   * @param {boolean} [pluginOptions.verbose]
   * @param {number} [pluginOptions.subsuitesWidth]
   * @param {string} [pluginOptions.pluginVersion]
   */
  constructor(wct, pluginOptions, runner) {
    super(undefined, undefined, runner);

    this.setupConfig(pluginOptions);

    if (pluginOptions.verbose) {
      this.setLogHandler(new WctLogHandler(wct, true));
      this.getLogger().setIncludeTime(true);
    }

    this._pluginVersion = pluginOptions.pluginVersion;
    this._subsuitesWidth = pluginOptions.subsuitesWidth.toString();
    if (this._subsuitesWidth && !this._subsuitesWidth.endsWith('px')) {
      this._subsuitesWidth += 'px';
    }
  }

  /**
   * @param {object} pluginOptions
   */
  setupConfig(pluginOptions) {
    const configuration = new Configuration();

    // eslint-disable-next-line no-restricted-syntax
    for (const [key, value] of Object.entries(pluginOptions)) {
      const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      if (typeof configuration[setterName] === 'function') {
        configuration[setterName](value);
      }
    }

    configuration.setStitchOverlap(0);
    configuration.setSendDom(false);

    this.setConfiguration(configuration);
  }

  /**
   * @override
   * @param {WebDriver} driver
   * @param appName
   * @param testName
   * @param frameId
   * @return {Promise<void>}
   */
  async open(driver, appName, testName, frameId) {
    await super.open(driver, appName, testName);

    // TODO: remove later, for test purpose only
    this._logger.verbose('Start first loop.');
    while (!await this._isElementExists(By.id('subsuites'))) {
      await GeneralUtils.sleep(500);
    }
    this._logger.verbose('First loop done.');

    let frameElement = await this._findElementSafe(By.id(frameId));

    if (this._subsuitesWidth) {
      this._logger.verbose('Trying to change subsuites width of root frame.');
      await driver.executeScript(`document.getElementById('subsuites').style.width = "${this._subsuitesWidth}";` +
        `document.getElementById('mocha').style.left = "${this._subsuitesWidth}";`);
    }

    while (frameElement == null) {
      this._logger.verbose('Target iframe is not found, switching to \'.subsuite\' iframe...');

      const innerFrameElement = await this._driver.findElement(By.css('.subsuite'));
      await this._driver.switchTo().frame(innerFrameElement);

      // TODO: remove later, for test purpose only
      this._logger.verbose('Second first loop.');
      while (!await this._isElementExists(By.id('subsuites'))) {
        await GeneralUtils.sleep(500);
      }
      this._logger.verbose('Second loop done.');

      if (this._subsuitesWidth) {
        this._logger.verbose('Trying to change subsuites width.');
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
      this._logger.verbose('Trying to select target iframe...');

      // option 1 (as before, fixed async issue)
      // return await this._driver.findElement(selector);

      // option 2 (use Promise's catch instead of try-catch)
      // return await this._driver.findElement(selector).catch(() => null);

      // option 3 (use js to check if element exists)
      let isElementExists = await this._isElementExists(selector);
      if (!isElementExists) {
        this._logger.verbose('Element is not exist, trying once more.');
        await GeneralUtils.sleep(1000);
        isElementExists = await this._isElementExists(selector);
      }

      this._logger.verbose(`Is element exists: ${isElementExists}`);
      return isElementExists ? await this._driver.findElement(selector) : null;
    } catch (e) {
      return null;
    }
  }

  async _isElementExists(selector) {
    this._logger.verbose(`Trying to find element '${selector.value}'...`);
    const script = `return document.querySelector('${selector.value}') !== null ? 'true' : 'false';`;
    const isElementExists = await this._driver.executeScript(script);
    this._logger.verbose(`Search result, is element '${selector.value}' exists: '${isElementExists}'.`);
    return isElementExists === 'true';
  }
}

exports.WctEyes = WctEyes;
