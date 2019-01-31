'use strict';

const send = require('send');
const express = require('express');
const path = require('path');
const chalk = require('chalk');

const { WebDriver, By, Capabilities, Session } = require('selenium-webdriver');
const { HttpClient, Executor } = require('selenium-webdriver/http');
const { TestResultsStatus, GeneralUtils, BatchInfo } = require('@applitools/eyes-sdk-core');
const { Target, OverflowAwareScrollPositionProvider } = require('@applitools/eyes-selenium');

const { WctEyes } = require('./wcteyes');
const VERSION = require('../package.json').version;

const packageJson = require(`${process.cwd()}/package.json`); // eslint-disable-line

module.exports = (wct, pluginOptions) => {
  pluginOptions.pluginVersion = VERSION;

  console.log(`Eyes WCT plugin loaded, version ${VERSION}.`);

  /** @type {WctEyes[]} */
  const eyesSessions = [];
  /** @type {TestResults[]} */
  const eyesResults = [];

  const eyesBatch = new BatchInfo(packageJson.name);

  wct.hook('configure', (done) => {
    wct.options.extraScripts.push('../wct-eyes/eyes-browser.js');

    if (pluginOptions.subsuitesWidth) {
      wct.options.clientOptions.subsuitesWidth = pluginOptions.subsuitesWidth;
    }

    done();
  });

  wct.hook('define:webserver', (app, mapper, options, done) => {
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
    done();
  });

  wct.hook('cleanup', (done) => {
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
    done();
  });

  // wct.on('browser-init', (def, data, stats, browser) => {});
  // wct.on('browser-start', (def, data, stats, browser) => {});
  // wct.on('sub-suite-start', (def, data, stats, browser) => {});
  // wct.on('test-start', (def, data, stats, browser) => {});
  // wct.on('test-end', (def, data, stats, browser) => {});
  // wct.on('sub-suite-end', (def, data, stats, browser) => {});

  wct.on('eyes:open', async (def, data, stats, browser) => {
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
      eyes.setHideScrollbars(true);
      eyes.setPositionProvider(new OverflowAwareScrollPositionProvider(eyes._logger, eyes._jsExecutor));

      wct.emit('log:debug', 'WctEyes: Eyes instance created');
      await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:openDone', ${JSON.stringify({ sessionId })})`);
    } catch (e) {
      wct.emit('log:error', `Eyes.open failed: ${e}`, '\n', e.stack);
    }
  });

  wct.on('eyes:checkWindow', async (def, data, stats, browser) => {
    const eyes = eyesSessions[data.sessionId];

    try {
      wct.emit('log:debug', 'WctEyes: trying to preform check window...');

      const matchResult = await eyes.check(
        data.name,
        Target.frame(By.css('#subsuites iframe')).fully().timeout(0)
      );

      wct.emit('log:debug', 'WctEyes: check window done');
      await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:checkWindowDone', ${JSON.stringify(matchResult)})`);
    } catch (e) {
      wct.emit('log:error', `Eyes.checkWindow failed: ${e}`, '\n', e.stack);
    }
  });

  wct.on('eyes:close', async (def, data, stats, browser) => {
    const eyes = eyesSessions[data.sessionId];

    try {
      wct.emit('log:debug', 'WctEyes: trying to close session...');
      const testResults = await eyes.close(data.throwEx);

      const results = { passed: true, testResults };

      wct.emit('log:debug', 'WctEyes: session closed with NO differences');
      await browser.execute(`window.top.eyesTopClient.getEmitter().emit('eyes:closeDone', ${JSON.stringify(results)})`);
      eyesResults[data.sessionId] = results.testResults;
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
  });

  wct.on('eyes:abortIfNotClosed', async (def, data, stats, browser) => {
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
  });
};
