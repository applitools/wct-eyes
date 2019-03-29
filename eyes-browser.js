/* eslint-disable */

var EyesEmitter = /** @class */ (function () {
  function EyesEmitter() {
    console.debug('WctEyes: EyesEmitter() - create');
    this.events = {};
  }

  EyesEmitter.prototype.on = function (eventName, fn) {
    console.debug('WctEyes: EyesEmitter.on() - begin', eventName);
    if (typeof this.events[eventName] !== 'object') {
      this.events[eventName] = [];
    }

    this.events[eventName].push(fn);
  };

  EyesEmitter.prototype.off = function (eventName, fn) {
    console.debug('WctEyes: EyesEmitter.off() - begin', eventName);
    if (typeof this.events[eventName] === 'object') {
      var idx = this.events[eventName].indexOf(fn);

      if (idx > -1) {
        this.events[eventName].splice(idx, 1);
      }
    }
  };

  EyesEmitter.prototype.once = function (eventName, fn) {
    console.debug('WctEyes: EyesEmitter.once() - begin', eventName);
    this.on(eventName, function g () {
      this.off(eventName, g);
      fn.apply(this, arguments);
    });
  };

  EyesEmitter.prototype.emit = function (eventName) {
    console.debug('WctEyes: EyesEmitter.emit() - begin', eventName);
    var args = [].slice.call(arguments, 1);

    if (typeof this.events[eventName] === 'object') {
      var events = this.events[eventName];
      for (var i = 0, l = events.length; i < l; i++) {
        events[i].apply(this, args);
      }
    }
  };

  return EyesEmitter;
}());


/**
 *
 */
var EyesConnectionClient = /** @class */ (function () {
  /**
   * @param {string=} query A query string to parse.
   * @return {!Object<string, !Array<string>>} All params on the URL's query.
   */
  function getParams(query) {
    query = typeof query === 'string' ? query : window.location.search;
    if (query.substring(0, 1) === '?') {
      query = query.substring(1);
    }
    // python's SimpleHTTPServer tacks a `/` on the end of query strings :(
    if (query.slice(-1) === '/') {
      query = query.substring(0, query.length - 1);
    }
    if (query === '') return {};
    var result = {};
    query.split('&')
      .forEach(function (part) {
        var pair = part.split('=');
        if (pair.length !== 2) {
          console.warn('Invalid URL query part:', part);
          return;
        }
        var key = decodeURIComponent(pair[0]);
        var value = decodeURIComponent(pair[1]);
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(value);
      });
    return result;
  }

  /**
   * @param {string} path The URI of the script to load.
   * @param {function} done
   */
  function loadScript(path, done) {
    console.debug('WctEyes: loadScript() - begin', path);
    var script = document.createElement('script');
    script.src = path;
    if (done) {
      script.onload = done.bind(null, null);
      script.onerror = done.bind(null, 'Failed to load script ' + script.src);
    }
    document.head.appendChild(script);
  }

  /**
   * @param {function(*, string, socket)} done Node-style callback.
   */
  function createSocket(done) {
    var SOCKETIO_ENDPOINT = window.location.protocol + '//' + window.location.host;
    var SOCKETIO_LIBRARY = SOCKETIO_ENDPOINT + '/socket.io/socket.io.js';
    console.debug('WctEyes: createSocket() - define', SOCKETIO_ENDPOINT, SOCKETIO_LIBRARY);

    var params = getParams(window.top.location.search);
    var browserId = params['cli_browser_id'] ? params['cli_browser_id'][0] : null;
    console.debug('WctEyes: createSocket.init() - begin', browserId);
    if (!browserId) return done('no browserId given');

    function openSocket() {
      console.debug('WctEyes: createSocket.init() - openSocket');
      var socket = io(SOCKETIO_ENDPOINT);
      socket.on('error', function (error) {
        console.debug('WctEyes: createSocket.init() - error');
        socket.off();
        done(error);
      });

      socket.on('connect', function () {
        console.debug('WctEyes: createSocket.init() - connect');
        socket.off();
        done(null, browserId, socket);
      });
    }

    if (typeof io !== 'undefined') {
      openSocket();
    } else {
      loadScript(SOCKETIO_LIBRARY, function (error) {
        console.debug('WctEyes: createSocket.init() - loadScript done', error);
        if (error) return done(error);
        openSocket();
      });
    }
  }



  function EyesConnectionClient() {
    var that = this;
    console.debug('EyesConnectionClient: constructor() - begin');

    this.browserId = undefined;
    this.socket = undefined;
    this.eyesEmitter = new EyesEmitter();
    this.socketPromise = new Promise(function (resolve, reject) {
      console.debug('EyesConnectionClient: constructor() - socket promise');
      createSocket(function (error, browserId, socket) {
        if (error) return reject(error);

        that.browserId = browserId;
        that.socket = socket;
        console.debug('EyesConnectionClient: constructor() - socket created');
        resolve();
      });
    });
  }

  EyesConnectionClient.prototype.getEmitter = function () {
    return this.eyesEmitter;
  };

  EyesConnectionClient.prototype.getPromise = function () {
    return this.socketPromise;
  };

  EyesConnectionClient.prototype.startCommand = function (event, data) {
    console.debug('WctEyes: CLISocket.emitEvent() - begin', event, data);
    this.socket.emit('client-event', {
      browserId: this.browserId,
      event: event,
      data: data
    });
  };

  return EyesConnectionClient;
}());



if(window.top === window.self) {
  window.eyesTopClient = new EyesConnectionClient();
}

function getEyesTopClient() {
  if (!window.top.eyesTopClient) {
    console.log('eyesTopClient not found, creating...');
    window.top.eyesTopClient = new EyesConnectionClient();
  }

  return window.top.eyesTopClient;
}


/**
 *
 */
var EyesClient = /** @class */ (function () {
  function Eyes() {
    console.debug('WctEyes: constructor() - begin');
    this.eyesTop = getEyesTopClient();

    this.sessionId = undefined;
    this.controlFlow = this.eyesTop.getPromise();
  }

  /**
   * @param [appName]
   * @param [testName]
   */
  Eyes.prototype.open = function (appName, testName) {
    var that = this;
    console.debug('WctEyes: open() - begin');
    this.controlFlow = this.controlFlow.then(function () {
      return new Promise(function (resolve) {
        console.debug('WctEyes: open() - begin promise');
        that.eyesTop.getEmitter().once('eyes:openDone', function (sessionData) {
          console.debug('WctEyes: open() - openDone', sessionData);
          that.sessionId = sessionData.sessionId;
          resolve();
        });
        console.debug('WctEyes: open() - open');

        var frameElement = window.frameElement;
        var generatedId = Math.random().toString(36).substring(2);
        frameElement.name = '123';
        frameElement.id = generatedId;
        that.eyesTop.startCommand('eyes:open', { appName: appName, testName: testName, frameId: generatedId });
      });
    });
    return this.controlFlow;
  };

  /**
   * @param {string} [name]
   * @param {boolean} [stitchContent]
   */
  Eyes.prototype.checkWindow = function (name, stitchContent = false) {
    var that = this;
    console.debug('WctEyes: checkWindow() - begin');
    this.controlFlow = this.controlFlow.then(function () {
      return new Promise(function (resolve) {
        console.debug('WctEyes: checkWindow() - begin promise');
        that.eyesTop.getEmitter().once('eyes:checkWindowDone', function () {
          console.debug('WctEyes: checkWindow() - checkWindowDone');
          resolve();
        });
        console.debug('WctEyes: checkWindow() - checkWindow');
        that.eyesTop.startCommand('eyes:checkWindow', { sessionId: that.sessionId, name: name, stitchContent });
      });
    });

    return this.controlFlow;
  };

  /**
   * @param {string} [name]
   * @param {boolean} [stitchContent]
   * @return {TestResults}
   */
  Eyes.prototype.testWindow = function (name, stitchContent = false) {
    var that = this;
    console.debug('WctEyes: testWindow() - begin');
    this.controlFlow = this.controlFlow.then(function () {
      return new Promise(function (resolve) {
        console.debug('WctEyes: testWindow() - begin promise');
        that.eyesTop.getEmitter().once('eyes:testWindowDone', function (testResults) {
          console.debug('WctEyes: testWindow() - testWindowDone', testResults);
          if (testResults.passed) return resolve();
          return reject(new Error(testResults.message));
        });
        console.debug('WctEyes: testWindow() - testWindow');
        that.eyesTop.startCommand('eyes:testWindow', { sessionId: that.sessionId, name: name, stitchContent });
      });
    });

    return this.controlFlow;
  };

  Eyes.prototype.close = function (throwEx) {
    var that = this;
    console.debug('WctEyes: close() - begin');
    this.controlFlow = this.controlFlow.then(function () {
      return new Promise(function (resolve, reject) {
        console.debug('WctEyes: close() - begin promise');
        that.eyesTop.getEmitter().once('eyes:closeDone', function (testResults) {
          console.debug('WctEyes: close() - closeDone', testResults);
          if (testResults.passed) return resolve();
          return reject(new Error(testResults.message));
        });
        console.debug('WctEyes: close() - close');
        that.eyesTop.startCommand('eyes:close', { sessionId: that.sessionId, throwEx: throwEx });
      });
    });
    return this.controlFlow;
  };

  Eyes.prototype.abortIfNotClosed = function () {
    console.debug('WctEyes: abortIfNotClosed() - begin');
    if (this.sessionId) {
      var that = this;
      this.controlFlow = new Promise(function (resolve) {
        console.debug('WctEyes: abortIfNotClosed() - begin promise');
        that.eyesTop.getEmitter().once('eyes:abortIfNotClosedDone', function () {
          console.debug('WctEyes: abortIfNotClosed() - abortIfNotClosedDone');
          resolve();
        });
        console.debug('WctEyes: abortIfNotClosed() - abortIfNotClosed');
        that.eyesTop.startCommand('eyes:abortIfNotClosed', { sessionId: that.sessionId });
      });
      return this.controlFlow;
    }
  };

  /**
   * @param {function} callback
   */
  Eyes.prototype.whenDone = function (callback) {
    console.debug('WctEyes: whenDone() - begin');
    if (callback) {
      console.debug('WctEyes: whenDone() - in callback');
      this.controlFlow.then(callback, callback);
    }

    return this.controlFlow;
  };

  window.Eyes = Eyes;
  return Eyes;
}());
