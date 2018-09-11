'use strict';

const send = require('send');
const express = require('express');
const path = require('path');
const chalk = require('chalk');

const { WebDriver, By, Capabilities, Session } = require('selenium-webdriver');
const { HttpClient, Executor } = require('selenium-webdriver/http');
const { TestResultsStatus, GeneralUtils, BatchInfo } = require('@applitools/eyes.sdk.core');
const { Target, OverflowAwareScrollPositionProvider } = require('@applitools/eyes.selenium');

const { WctEyes } = require('./wcteyes');

const packageJson = require(`${process.cwd()}/package.json`); // eslint-disable-line

module.exports = (wct, pluginOptions) => {
  console.log('Eyes WCT plugin loaded.');

  /** @type {WctEyes[]} */
  const eyesSessions = {};
  /** @type {TestResults[]} */
  const eyesResults = {};

  const eyesBatch = new BatchInfo(packageJson.name);

  wct.hook('configure', (done) => {
    wct.options.extraScripts.push('../wct-eyes/eyes-browser.js');
    done();
  });

  wct.hook('define:webserver', (app, mapper, options, done) => {
    // if package installed via bower, it will be loaded automatically as any other components,
    // but we need this in case of npm, in the case we load only one script that we need on client
    const newApp = express();
    newApp.get('/components/wct-eyes/eyes-browser.js', (request, response) => {
      const browserJsPath = path.resolve(__dirname, '../eyes-browser.js');
      send(request, browserJsPath).pipe(response);
    });
    newApp.use(app);
    mapper(newApp);
    done();
  });

  wct.hook('cleanup', (done) => {
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
    done();
  });

  // wct.on('browser-init', (def, data, stats, browser) => {});
  // wct.on('browser-start', (def, data, stats, browser) => {});
  // wct.on('sub-suite-start', (def, data, stats, browser) => {});
  // wct.on('test-start', (def, data, stats, browser) => {});
  // wct.on('test-end', (def, data, stats, browser) => {});
  // wct.on('sub-suite-end', (def, data, stats, browser) => {});

  wct.on('sub-suite-start', (def, data, stats, browser) => {
    if (pluginOptions.subsuitesWidth) {
      let requiredWidth = pluginOptions.subsuitesWidth.toString();
      if (!requiredWidth.endsWith('px')) requiredWidth += 'px';

      browser.execute(`document.getElementById('subsuites').style.width = "${requiredWidth}";` +
                      `document.getElementById('mocha').style.left = "${requiredWidth}";`);
    }
  });

  wct.on('eyes:open', (def, data, stats, browser) => {
    const executor = new Executor(new HttpClient(browser.configUrl.href));
    const capabilities = new Capabilities(browser.defaultCapabilities); // may be we will need more capabilities
    const session = new Session(browser.sessionID, capabilities);
    const driver = new WebDriver(session, executor);
    // const driver = WebDriver.attachToSession(executor, browser.sessionID);

    const eyes = new WctEyes(wct, pluginOptions);
    eyes.setBatch(eyesBatch);

    const sessionId = GeneralUtils.guid();
    eyesSessions[sessionId] = eyes;

    return eyes.open(driver, data.appName, data.testName).then(() => {
      eyes.setStitchOverlap(0);
      eyes.setHideScrollbars(true);
      eyes.setPositionProvider(new OverflowAwareScrollPositionProvider(eyes._logger, eyes._jsExecutor));

      browser.execute(`eyesEmitter.emit('eyes:openDone', ${JSON.stringify({ sessionId })})`);
    }).catch((err) => {
      wct.emit('log:error', `Eyes.open failed: ${err}`, '\n', err.stack);
    });
  });

  wct.on('eyes:checkWindow', (def, data, stats, browser) => {
    const eyes = eyesSessions[data.sessionId];

    eyes.check(data.name, Target.frame(By.css('#subsuites iframe')).fully().timeout(0)).then((matchResult) => {
      browser.execute(`eyesEmitter.emit('eyes:checkWindowDone', ${JSON.stringify(matchResult)})`);
    }).catch((err) => {
      wct.emit('log:error', `Eyes.checkWindow failed: ${err}`, '\n', err.stack);
    });
  });

  wct.on('eyes:close', (def, data, stats, browser) => {
    const eyes = eyesSessions[data.sessionId];

    eyes.close(data.throwEx).then((testResults) => {
      const results = { passed: true, testResults };
      browser.execute(`eyesEmitter.emit('eyes:closeDone', ${JSON.stringify(results)})`);
      eyesResults[data.sessionId] = results.testResults;
    }).catch((err) => {
      const results = { passed: false, message: err.message, testResults: err.getTestResults() };
      browser.execute(`eyesEmitter.emit('eyes:closeDone', ${JSON.stringify(results)})`);
      eyesResults[data.sessionId] = results.testResults;
      wct.emit('log:error', `Eyes.close failed: ${err}`, '\n', err.stack);
    });
  });

  wct.on('eyes:abortIfNotClosed', (def, data, stats, browser) => {
    const eyes = eyesSessions[data.sessionId];

    eyes.abortIfNotClosed().then((testResults) => {
      if (testResults) {
        eyesResults[data.sessionId] = testResults;
      }

      browser.execute(`eyesEmitter.emit('eyes:abortIfNotClosedDone', ${JSON.stringify(testResults)})`);
    }).catch((err) => {
      wct.emit('log:error', `Eyes.abortIfNotClosed failed: ${err}`, '\n', err.stack);
    });
  });
};
