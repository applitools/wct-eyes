'use strict';

/* eslint-disable no-console, max-len */
const send = require('send');
const express = require('express');
const path = require('path');

const { HttpClient, Executor } = require('selenium-webdriver/http');
const { WebDriver, By, Capabilities, Session } = require('selenium-webdriver');
const { GeneralUtils, PerformanceUtils } = require('@applitools/eyes-common');
const { Target, BatchInfo, TestResultsFormatter, ClassicRunner } = require('@applitools/eyes-selenium');

const { WctEyes } = require('./classes/WctEyes');
const VERSION = require('../package.json').version;

const packageJson = require(`${process.cwd()}/package.json`); // eslint-disable-line

let timeTotal = PerformanceUtils.start();
let timePart = PerformanceUtils.start();

function time() {
  const elapsed = timePart.end().time;
  timePart = PerformanceUtils.start();
  return `${elapsed} ms`;
}

// eslint-disable-next-line
module.exports = (wct, pluginOptions) => {
  pluginOptions.pluginVersion = VERSION;

  console.log(`Eyes WCT plugin loaded, version ${VERSION}.`);

  /** @type {ClassicRunner} */
  const eyesRunner = new ClassicRunner();
  /** @type {BatchInfo} */
  const eyesBatch = new BatchInfo(packageJson.name);
  /** @type {WctEyes[]} */
  const eyesSessions = [];

  wct.hook('configure', (done) => {
    timeTotal = PerformanceUtils.start();
    wct.emit('log:debug', 'WctEyesTime:', 'before:hook:configure', time());

    wct.options.extraScripts.push('../wct-eyes/eyes-browser.js');

    if (pluginOptions.subsuitesWidth) {
      wct.options.clientOptions.subsuitesWidth = pluginOptions.subsuitesWidth;
    }

    wct.emit('log:debug', 'WctEyesTime:', 'hook:configure', time());
    done();
  });

  wct.hook('define:webserver', (app, mapper, options, done) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:define:webserver', time());
    // if package installed via bower, it will be loaded automatically as any other components,
    // but we need this in case of npm, in the case we load only one script that we need on client
    const newApp = express();
    newApp.get('/components/wct-eyes/eyes-browser.js', (request, response) => {
      const browserJsPath = path.resolve(__dirname, '../eyes-browser.js');
      send(request, browserJsPath, {}).pipe(response);
    });
    newApp.use(app);
    mapper(newApp);

    wct.emit('log:debug', 'WctEyes: browser script added to the app');
    wct.emit('log:debug', 'WctEyesTime:', 'define:webserver', time());
    done();
  });

  // wct.on('browser-init', (def, data, stats, browser) => {});
  // wct.on('browser-start', (def, data, stats, browser) => {});
  // wct.on('sub-suite-start', (def, data, stats, browser) => {});
  // wct.on('test-start', (def, data, stats, browser) => {});
  // wct.on('test-end', (def, data, stats, browser) => {});
  // wct.on('sub-suite-end', (def, data, stats, browser) => {});

  wct.on('eyes:open', async (def, data, stats, browser) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:eyes:open', time());
    wct.emit('log:debug', 'WctEyes: trying to create WebDriver from existing Selenium session...');

    const executor = new Executor(new HttpClient(browser.configUrl.href));
    const capabilities = new Capabilities(browser.defaultCapabilities); // may be we will need more capabilities
    const session = new Session(browser.sessionID, capabilities);
    const driver = new WebDriver(session, executor);

    wct.emit('log:debug', 'WctEyes: WebDriver created');
    wct.emit('log:debug', 'WctEyes: trying to create Eyes instance...');

    const eyes = new WctEyes(wct, pluginOptions, eyesRunner);
    eyes.setBatch(eyesBatch);

    const sessionId = GeneralUtils.guid();
    eyesSessions[sessionId] = eyes;

    try {
      await eyes.open(driver, data.appName, data.testName, data.frameId);

      wct.emit('log:debug', 'WctEyes: Eyes instance created');
      await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:openDone', ${JSON.stringify({ sessionId })})`);
    } catch (e) {
      wct.emit('log:error', `Eyes.open failed: ${e}`, '\n', e.stack);
    }
    wct.emit('log:debug', 'WctEyesTime:', 'eyes:open', time());
  });

  wct.on('eyes:checkWindow', async (def, data, stats, browser) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:eyes:checkWindow', time());
    const eyes = eyesSessions[data.sessionId];

    try {
      wct.emit('log:debug', 'WctEyes: trying to preform check window...');

      const target = Target.region(By.css('#subsuites iframe')).timeout(0);
      if (data.stitchContent) target.fully();

      const matchResult = await eyes.check(data.name, target);
      wct.emit('log:debug', 'WctEyes: check window done');
      await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:checkWindowDone', ${JSON.stringify(matchResult)})`);
    } catch (e) {
      wct.emit('log:error', `Eyes.checkWindow failed: ${e}`, '\n', e.stack);
    }
    wct.emit('log:debug', 'WctEyesTime:', 'eyes:checkWindow', time());
  });

  wct.on('eyes:close', async (def, data, stats, browser) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:eyes:close', time());
    const eyes = eyesSessions[data.sessionId];

    wct.emit('log:debug', 'WctEyes: trying to close session...');
    await eyes.closeAsync();
    wct.emit('log:debug', 'WctEyes: closing session initiated');

    await eyes.getDriver().switchTo().defaultContent();
    await browser.execute('window.top.eyesTopClient.getEmitter().emit(\'eyes:closeDone\')');
    wct.emit('log:debug', 'WctEyesTime:', 'eyes:close', time());
  });

  wct.on('eyes:abortIfNotClosed', async (def, data, stats, browser) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:eyes:abortIfNotClosed', time());
    const eyes = eyesSessions[data.sessionId];

    if (eyes) { // sometimes, it is possible that session can't be found
      wct.emit('log:debug', 'WctEyes: trying to abortIfNotClosed...');
      await eyes.abort();
      await eyes.getDriver().switchTo().defaultContent();
      wct.emit('log:debug', 'WctEyes: abortIfNotClosed done');
    }

    await browser.execute('window.top.eyesTopClient.getEmitter().emit(\'eyes:abortIfNotClosedDone\')');
    wct.emit('log:debug', 'WctEyesTime:', 'eyes:abortIfNotClosed', time());
  });

  wct.hook('cleanup', async () => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:cleanup', time());

    const allResults = await eyesRunner.getAllTestResults(false);
    const allTestResults = allResults.getAllResults().map(resultContainer => resultContainer.getTestResults());
    const testResultsFormatter = new TestResultsFormatter(allTestResults);
    console.log(`\r\n${testResultsFormatter.asFormatterString()}\r\n`);

    wct.emit('log:debug', 'WctEyesTime:', 'cleanup', time());
    wct.emit('log:debug', 'WctEyesTime:', 'total-suite-time', `${timeTotal.end().time} ms`);
  });
};
