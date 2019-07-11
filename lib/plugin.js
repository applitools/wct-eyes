'use strict';

const send = require('send');
const express = require('express');
const path = require('path');
const chalk = require('chalk');

const { HttpClient, Executor } = require('selenium-webdriver/http');
const { WebDriver, By, Capabilities, Session } = require('selenium-webdriver');
const { GeneralUtils, PerformanceUtils } = require('@applitools/eyes-common');
const { Target, BatchInfo, TestResultsStatus } = require('@applitools/eyes-selenium');

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

  /** @type {WctEyes[]} */
  const eyesSessions = [];
  /** @type {TestResults[]} */
  const eyesResults = [];

  const eyesBatch = new BatchInfo(packageJson.name);

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

    const eyes = new WctEyes(wct, pluginOptions);
    eyes.setBatch(eyesBatch);

    const sessionId = GeneralUtils.guid();
    eyesSessions[sessionId] = eyes;

    try {
      await eyes.open(driver, data.appName, data.testName, data.frameId);

      eyes.setStitchOverlap(0);
      eyes.setSendDom(false);

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

  wct.on('eyes:testWindow', async (def, data, stats, browser) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:eyes:testWindow', time());
    const eyes = eyesSessions[data.sessionId];

    try {
      wct.emit('log:debug', 'WctEyes: trying to preform test window...');

      const target = Target.region(By.css('#subsuites iframe')).timeout(0);
      if (data.stitchContent) target.fully();

      const testResults = await eyes.testWindow(data.name, target);

      const results = { passed: testResults.isPassed(), testResults };

      wct.emit('log:debug', 'WctEyes: check window done');
      await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:testWindowDone', ${JSON.stringify(results)})`);
      eyesResults[data.sessionId] = testResults;
    } catch (e) {
      wct.emit('log:error', `Eyes.testWindow failed: ${e}`, '\n', e.stack);
    } finally {
      await eyes.getDriver().switchTo().defaultContent();
    }
    wct.emit('log:debug', 'WctEyesTime:', 'eyes:testWindow', time());
  });

  wct.on('eyes:close', async (def, data, stats, browser) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:eyes:close', time());
    const eyes = eyesSessions[data.sessionId];

    try {
      wct.emit('log:debug', 'WctEyes: trying to close session...');
      const testResults = await eyes.close(data.throwEx);

      const results = { passed: true, testResults };

      wct.emit('log:debug', 'WctEyes: session closed with NO differences');
      await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:closeDone', ${JSON.stringify(results)})`);
      eyesResults[data.sessionId] = testResults;
    } catch (e) {
      let testResults;
      if (typeof e.getTestResults !== 'undefined') {
        testResults = e.getTestResults();
        eyesResults[data.sessionId] = testResults;
      }

      const results = { passed: false, message: e.message, testResults };

      wct.emit('log:debug', 'WctEyes: session closed and differences found');
      await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:closeDone', ${JSON.stringify(results)})`);
      wct.emit('log:error', `Eyes.close failed: ${e}`, '\n', e.stack);
    } finally {
      await eyes.getDriver().switchTo().defaultContent();
    }
    wct.emit('log:debug', 'WctEyesTime:', 'eyes:close', time());
  });

  wct.on('eyes:abortIfNotClosed', async (def, data, stats, browser) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:eyes:abortIfNotClosed', time());
    const eyes = eyesSessions[data.sessionId];

    try {
      if (eyes) { // sometimes during debugging when multiple browsers open, it is possible that session can't be found
        wct.emit('log:debug', 'WctEyes: trying to abortIfNotClosed...');
        const testResults = await eyes.abortIfNotClosed();
        if (testResults) {
          eyesResults[data.sessionId] = testResults;
        }

        wct.emit('log:debug', 'WctEyes: abortIfNotClosed done');
        await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:abortIfNotClosedDone', ${JSON.stringify(testResults)})`);
      } else {
        wct.emit('log:debug', 'WctEyes: abortIfNotClosed skipped, the session is not open');
        await browser.execute('window.top.eyesTopClient.getEmitter().emit(\'eyes:abortIfNotClosedDone\')');
      }
    } catch (e) {
      wct.emit('log:error', `Eyes.abortIfNotClosed failed: ${e}`, '\n', e.stack);
    } finally {
      await eyes.getDriver().switchTo().defaultContent();
    }
    wct.emit('log:debug', 'WctEyesTime:', 'eyes:abortIfNotClosed', time());
  });

  wct.hook('cleanup', (done) => {
    wct.emit('log:debug', 'WctEyesTime:', 'before:cleanup', time());
    wct.emit('log:debug', 'WctEyes: test results output on `cleanup`...');

    let lastTestResult;
    console.log(chalk.cyan('\n[EYES: TEST RESULTS]:'));
    Object.values(eyesResults).forEach((testResult) => {
      lastTestResult = testResult;
      const prefix = `[${testResult.getHostApp()}] Test '${testResult.getName()}' of '${testResult.getAppName()}'`;

      if (testResult.getIsNew()) {
        console.log(chalk.yellow(`${prefix} is a new test, please, approve baseline!`));
      } else if ([TestResultsStatus.Unresolved, TestResultsStatus.Failed].includes(testResult.getStatus())) {
        console.log(chalk.red(`${prefix} detected differences!`));
      } else {
        console.log(chalk.green(`${prefix} passed.`));
      }
    });

    if (lastTestResult) {
      console.log(chalk.blue(`See details at ${lastTestResult.getAppUrls().getBatch()}`));
    }

    wct.emit('log:debug', 'WctEyes: test results output done');
    wct.emit('log:debug', 'WctEyesTime:', 'cleanup', time());
    wct.emit('log:debug', 'WctEyesTime:', 'total-suite-time', `${timeTotal.end().time} ms`);
    done();
  });
};
