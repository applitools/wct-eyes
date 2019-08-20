'use strict';

const { By } = require('selenium-webdriver');
const { GeneralUtils } = require('@applitools/eyes-common');
const { EyesSelenium, EyesVisualGrid, VisualGridRunner, EyesSeleniumUtils, Configuration } = require('@applitools/eyes-selenium');

const { WctLogHandler } = require('./WctLogHandler');

class WctEyes {
  /**
   * @param {object} [wct]
   * @param {object} [pluginOptions]
   * @param {EyesRunner} [runner]
   * @param {string} [pluginOptions.apiKey]
   * @param {string} [pluginOptions.serverUrl]
   * @param {string|boolean} [pluginOptions.proxy]
   * @param {boolean} [pluginOptions.forceFullPageScreenshot]
   * @param {boolean} [pluginOptions.hideScrollbars]
   * @param {boolean} [pluginOptions.verbose]
   * @param {number} [pluginOptions.subsuitesWidth]
   * @param {string} [pluginOptions.pluginVersion]
   * @return {Eyes}
   */
  constructor(wct, pluginOptions, runner) {
    let eyes;
    if (runner instanceof VisualGridRunner) {
      eyes = new EyesVisualGrid(undefined, undefined, runner);
    } else {
      eyes = new EyesSelenium(undefined, undefined, runner);
      eyes.getViewportSize = this.getViewportSize;
    }

    // TODO: it is definitely should be refactored in the future
    eyes.navigateToFrameId = this.navigateToFrameId;
    eyes.getBaseAgentId = this.getBaseAgentId;

    eyes.setConfiguration(WctEyes.createConfiguration(pluginOptions));

    if (pluginOptions.verbose) {
      eyes.setLogHandler(new WctLogHandler(wct, true));
      eyes.getLogger().setIncludeTime(true);
    }

    eyes._pluginVersion = pluginOptions.pluginVersion;
    eyes._subsuitesWidth = pluginOptions.subsuitesWidth.toString();
    if (eyes._subsuitesWidth && !eyes._subsuitesWidth.endsWith('px')) {
      eyes._subsuitesWidth += 'px';
    }

    return eyes;
  }

  /**
   * @param frameId
   * @return {Promise<void>}
   */
  async navigateToFrameId(frameId) {
    // TODO: remove later, for test purpose only
    this._logger.verbose('Start first loop.');
    while (!await WctEyes.isElementExists(this._logger, this._driver, By.id('subsuites'))) {
      await GeneralUtils.sleep(500);
    }
    this._logger.verbose('First loop done.');

    let frameElement = await WctEyes.findElementSafe(this._logger, this._driver, By.id(frameId));

    if (this._subsuitesWidth) {
      this._logger.verbose('Trying to change subsuites width of root frame.');
      await this._driver.executeScript(`document.getElementById('subsuites').style.width = "${this._subsuitesWidth}";` +
        `document.getElementById('mocha').style.left = "${this._subsuitesWidth}";`);
    }

    while (frameElement == null) {
      this._logger.verbose('Target iframe is not found, switching to \'.subsuite\' iframe...');

      const innerFrameElement = await this._driver.findElement(By.css('.subsuite'));
      await this._driver.switchTo().frame(innerFrameElement);

      // TODO: remove later, for test purpose only
      this._logger.verbose('Second first loop.');
      while (!await WctEyes.isElementExists(this._logger, this._driver, By.id('subsuites'))) {
        await GeneralUtils.sleep(500);
      }
      this._logger.verbose('Second loop done.');

      if (this._subsuitesWidth) {
        this._logger.verbose('Trying to change subsuites width.');
        await this._driver.executeScript(`document.getElementById('subsuites').style.width = "${this._subsuitesWidth}";`);
      }

      frameElement = await WctEyes.findElementSafe(this._logger, this._driver, By.id(frameId));
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

  /**
   * @param {object} pluginOptions
   * @return {Configuration}
   */
  static createConfiguration(pluginOptions) {
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
    return configuration;
  }

  static async findElementSafe(logger, driver, selector) {
    try {
      logger.verbose('Trying to select target iframe...');

      // option 1 (as before, fixed async issue)
      // return await driver.findElement(selector);

      // option 2 (use Promise's catch instead of try-catch)
      // return await driver.findElement(selector).catch(() => null);

      // option 3 (use js to check if element exists)
      let elementExists = await WctEyes.isElementExists(logger, driver, selector);
      if (!elementExists) {
        logger.verbose('Element is not exist, trying once more.');
        await GeneralUtils.sleep(1000);
        elementExists = await WctEyes.isElementExists(logger, driver, selector);
      }

      logger.verbose(`Is element exists: ${elementExists}`);
      return elementExists ? await driver.findElement(selector) : null;
    } catch (e) {
      return null;
    }
  }

  static async isElementExists(logger, driver, selector) {
    logger.verbose(`Trying to find element '${selector.value}'...`);
    const script = `return document.querySelector('${selector.value}') !== null ? 'true' : 'false';`;
    const elementExists = await driver.executeScript(script);
    logger.verbose(`Search result, is element '${selector.value}' exists: '${elementExists}'.`);
    return elementExists === 'true';
  }
}

exports.WctEyes = WctEyes;
