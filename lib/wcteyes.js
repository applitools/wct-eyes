'use strict';

const {
  EyesBase,
  RectangleSize,
  EyesSimpleScreenshot,
  NullRegionProvider,
  CheckSettings,
  MutableImage,
} = require('@applitools/eyes.sdk.core');

const VERSION = require('../package.json').version;

class WctEyes extends EyesBase {
  /**
   * Initializes an Eyes instance.
   *
   * @param {object} [configs] The eyes.storybook configuration
   */
  constructor(configs) {
    super();

    if (configs.apiKey) {
      this.setApiKey(configs.apiKey);
    }
    if (configs.serverUrl) {
      this.setServerUrl(configs.serverUrl);
    }
    if (configs.proxy) {
      this.setProxy(configs.proxy);
    }

    this._testName = undefined;
    this._title = undefined;
    this._screenshot = undefined;
    this._inferred = '';
  }

  /** @override */
  getBaseAgentId() {
    return `eyes.wct/${VERSION}`;
  }

  setTestName(testName) {
    this._testName = testName;
  }

  /**
   * Starts a test.
   *
   * @param {string} appName The application being tested.
   * @param {string} testName The test's name.
   * @param {RectangleSize} [imageSize] Determines the resolution used for the baseline. {@code null} will
   *   automatically grab the resolution from the image.
   * @return {Promise<void>}
   */
  open(appName, testName, imageSize) {
    return super.openBase(appName, testName || this._testName, imageSize);
  }

  /**
   * Perform visual validation for the current image.
   *
   * @param {string} screenshot The image png bytes or ImageProvider.
   * @param {string} [name] An optional tag to be associated with the validation checkpoint.
   * @return {Promise<MatchResult>}
   */
  checkImage(screenshot, name) {
    const mutableImage = MutableImage.fromBase64(screenshot, this.getPromiseFactory());

    this._title = name || '';
    this._screenshot = new EyesSimpleScreenshot(mutableImage);

    const regionProvider = new NullRegionProvider(this.getPromiseFactory());
    this._logger.verbose(`checkImage(screenshot, "${name}")`);
    return super.checkWindowBase(regionProvider, name, false, new CheckSettings(0));
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Adds a mouse trigger.
   *
   * @param {MouseTrigger.MouseAction} action  Mouse action.
   * @param {Region} control The control on which the trigger is activated (context relative coordinates).
   * @param {Location} cursor  The cursor's position relative to the control.
   */
  addMouseTrigger(action, control, cursor) {
    super.addMouseTriggerBase(action, control, cursor);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Adds a keyboard trigger.
   *
   * @param {Region} control The control's context-relative region.
   * @param {string} text The trigger's text.
   */
  addTextTrigger(control, text) {
    super.addTextTriggerBase(control, text);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the AUT session id.
   *
   * @return {Promise<?string>}
   */
  getAUTSessionId() {
    return this.getPromiseFactory().resolve(undefined);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the viewport size.
   *
   * @return {Promise<RectangleSize>}
   */
  getViewportSize() {
    if (this._screenshot) {
      return this.getPromiseFactory().resolve(this._screenshot.getSize());
    }

    return this.getPromiseFactory().resolve(this._viewportSizeHandler.get());
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Set the viewport size.
   *
   * @param {RectangleSize} viewportSize The required viewport size.
   * @return {Promise<void>}
   */
  setViewportSize(viewportSize) {
    this._viewportSizeHandler.set(new RectangleSize(viewportSize));
    return this.getPromiseFactory().resolve();
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the inferred environment.
   *
   * @protected
   * @return {Promise<string>} A promise which resolves to the inferred environment string.
   */
  getInferredEnvironment() {
    return this.getPromiseFactory().resolve(this._inferred);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Sets the inferred environment for the test.
   *
   * @param {string} inferred The inferred environment string.
   */
  setInferredEnvironment(inferred) {
    this._inferred = inferred;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the screenshot.
   *
   * @return {Promise<EyesSimpleScreenshot>} The screenshot.
   */
  getScreenshot() {
    return this.getPromiseFactory().resolve(this._screenshot);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the title.
   *
   * @protected
   * @return {Promise<string>} The current title of of the AUT.
   */
  getTitle() {
    return this.getPromiseFactory().resolve(this._title);
  }

  getDomUrl() {
    return this.getPromiseFactory().resolve();
  }

  getScreenshotUrl() {
    return this.getPromiseFactory().resolve();
  }
}

exports.WctEyes = WctEyes;
