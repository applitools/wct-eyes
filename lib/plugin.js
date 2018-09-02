'use strict';

const send = require('send');
const express = require('express');
const path = require('path');
const chalk = require('chalk');

const { TestResultsStatus, GeneralUtils, BatchInfo } = require('@applitools/eyes.sdk.core');
const { WctEyes } = require('./wcteyes');
const { WctLogHandler } = require('./loghandler');

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
    console.log(chalk.cyan('\n[EYES: TEST RESULTS]:'));
    Object.values(eyesResults).forEach((testResult) => {
      if (testResult.getStatus() === TestResultsStatus.Unresolved || testResult.getStatus() === TestResultsStatus.Failed) {
        if (testResult.getIsNew()) {
          console.log(chalk.yellow(`New test '${testResult.getName()}' of '${testResult.getAppName()}' ended. Please approve the new baseline at ${testResult.getAppUrls().getSession()}`));
        } else {
          console.log(chalk.red(`Test '${testResult.getName()}' of '${testResult.getAppName()}' detected differences! See details at ${testResult.getAppUrls().getSession()}`));
        }
      } else {
        console.log(chalk.green(`Test '${testResult.getName()}' of '${testResult.getAppName()}' passed. See details at ${testResult.getAppUrls().getSession()}`));
      }
    });

    done();
  });


  // wct.on('browser-init', (def, data, stats, browser) => {
  // });

  // wct.on('browser-start', (def, data, stats, browser) => {
  // });

  // wct.on('sub-suite-start', (def, data, stats, browser) => {
  // });

  // wct.on('test-start', (def, data, stats, browser) => {
  //   let testName = data.test.toString();
  //   if (data.test.length > 2) {
  //     testName = data.test[data.test.length - 2];
  //   }
  //
  //   eyes.setTestName(testName);
  // });

  // wct.on('test-end', (def, data, stats, browser) => {
  // });

  // wct.on('sub-suite-end', (def, data, stats, browser) => {
  // });

  wct.on('eyes:open', (def, data, stats, browser) => {
    const eyes = new WctEyes(pluginOptions);
    eyes.setBatch(eyesBatch);
    eyes.setLogHandler(new WctLogHandler(wct, false));

    const sessionId = GeneralUtils.guid();
    eyesSessions[sessionId] = eyes;

    return eyes.open(data.appName, data.testName).then(() => {
      browser.execute(`eyesEmitter.emit('eyes:openDone', ${JSON.stringify({ sessionId })})`);
    }).catch((err) => {
      wct.emit('log:error', `Eyes.open failed: ${err}`);
    });
  });

  wct.on('eyes:checkWindow', (def, data, stats, browser) => {
    const eyes = eyesSessions[data.sessionId];

    browser.takeScreenshot((err, screenshot) => {
      eyes.checkImage(screenshot, data.name).then((matchResult) => {
        browser.execute(`eyesEmitter.emit('eyes:checkWindowDone', ${JSON.stringify(matchResult)})`);
      }).catch((errp) => {
        wct.emit('log:error', `Eyes.checkWindow failed: ${errp}`);
      });
    });

    // wct.emit('log:error', def.browserName + ' failed to maximize');
    // wct.emit('log:debug', def.browserName + ' maximized');
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
      wct.emit('log:error', `Eyes.close failed: ${err}`);
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
      wct.emit('log:error', `Eyes.abortIfNotClosed failed: ${err}`);
    });
  });
};
