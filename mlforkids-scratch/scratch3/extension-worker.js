(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["VirtualMachine"] = factory();
	else
		root["VirtualMachine"] = factory();
})(self, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/microee/index.js":
/*!***************************************!*\
  !*** ./node_modules/microee/index.js ***!
  \***************************************/
/***/ ((module) => {

function M() { this._events = {}; }
M.prototype = {
  on: function(ev, cb) {
    this._events || (this._events = {});
    var e = this._events;
    (e[ev] || (e[ev] = [])).push(cb);
    return this;
  },
  removeListener: function(ev, cb) {
    var e = this._events[ev] || [], i;
    for(i = e.length-1; i >= 0 && e[i]; i--){
      if(e[i] === cb || e[i].cb === cb) { e.splice(i, 1); }
    }
  },
  removeAllListeners: function(ev) {
    if(!ev) { this._events = {}; }
    else { this._events[ev] && (this._events[ev] = []); }
  },
  listeners: function(ev) {
    return (this._events ? this._events[ev] || [] : []);
  },
  emit: function(ev) {
    this._events || (this._events = {});
    var args = Array.prototype.slice.call(arguments, 1), i, e = this._events[ev] || [];
    for(i = e.length-1; i >= 0 && e[i]; i--){
      e[i].apply(this, args);
    }
    return this;
  },
  when: function(ev, cb) {
    return this.once(ev, cb, true);
  },
  once: function(ev, cb, when) {
    if(!cb) return this;
    function c() {
      if(!when) this.removeListener(ev, c);
      if(cb.apply(this, arguments) && when) this.removeListener(ev, c);
    }
    c.cb = cb;
    this.on(ev, c);
    return this;
  }
};
M.mixin = function(dest) {
  var o = M.prototype, k;
  for (k in o) {
    o.hasOwnProperty(k) && (dest.prototype[k] = o[k]);
  }
};
module.exports = M;


/***/ }),

/***/ "./node_modules/minilog/lib/common/filter.js":
/*!***************************************************!*\
  !*** ./node_modules/minilog/lib/common/filter.js ***!
  \***************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// default filter
var Transform = __webpack_require__(/*! ./transform.js */ "./node_modules/minilog/lib/common/transform.js");

var levelMap = { debug: 1, info: 2, warn: 3, error: 4 };

function Filter() {
  this.enabled = true;
  this.defaultResult = true;
  this.clear();
}

Transform.mixin(Filter);

// allow all matching, with level >= given level
Filter.prototype.allow = function(name, level) {
  this._white.push({ n: name, l: levelMap[level] });
  return this;
};

// deny all matching, with level <= given level
Filter.prototype.deny = function(name, level) {
  this._black.push({ n: name, l: levelMap[level] });
  return this;
};

Filter.prototype.clear = function() {
  this._white = [];
  this._black = [];
  return this;
};

function test(rule, name) {
  // use .test for RegExps
  return (rule.n.test ? rule.n.test(name) : rule.n == name);
};

Filter.prototype.test = function(name, level) {
  var i, len = Math.max(this._white.length, this._black.length);
  for(i = 0; i < len; i++) {
    if(this._white[i] && test(this._white[i], name) && levelMap[level] >= this._white[i].l) {
      return true;
    }
    if(this._black[i] && test(this._black[i], name) && levelMap[level] <= this._black[i].l) {
      return false;
    }
  }
  return this.defaultResult;
};

Filter.prototype.write = function(name, level, args) {
  if(!this.enabled || this.test(name, level)) {
    return this.emit('item', name, level, args);
  }
};

module.exports = Filter;


/***/ }),

/***/ "./node_modules/minilog/lib/common/minilog.js":
/*!****************************************************!*\
  !*** ./node_modules/minilog/lib/common/minilog.js ***!
  \****************************************************/
/***/ ((module, exports, __webpack_require__) => {

var Transform = __webpack_require__(/*! ./transform.js */ "./node_modules/minilog/lib/common/transform.js"),
    Filter = __webpack_require__(/*! ./filter.js */ "./node_modules/minilog/lib/common/filter.js");

var log = new Transform(),
    slice = Array.prototype.slice;

exports = module.exports = function create(name) {
  var o   = function() { log.write(name, undefined, slice.call(arguments)); return o; };
  o.debug = function() { log.write(name, 'debug', slice.call(arguments)); return o; };
  o.info  = function() { log.write(name, 'info',  slice.call(arguments)); return o; };
  o.warn  = function() { log.write(name, 'warn',  slice.call(arguments)); return o; };
  o.error = function() { log.write(name, 'error', slice.call(arguments)); return o; };
  o.log   = o.debug; // for interface compliance with Node and browser consoles
  o.suggest = exports.suggest;
  o.format = log.format;
  return o;
};

// filled in separately
exports.defaultBackend = exports.defaultFormatter = null;

exports.pipe = function(dest) {
  return log.pipe(dest);
};

exports.end = exports.unpipe = exports.disable = function(from) {
  return log.unpipe(from);
};

exports.Transform = Transform;
exports.Filter = Filter;
// this is the default filter that's applied when .enable() is called normally
// you can bypass it completely and set up your own pipes
exports.suggest = new Filter();

exports.enable = function() {
  if(exports.defaultFormatter) {
    return log.pipe(exports.suggest) // filter
              .pipe(exports.defaultFormatter) // formatter
              .pipe(exports.defaultBackend); // backend
  }
  return log.pipe(exports.suggest) // filter
            .pipe(exports.defaultBackend); // formatter
};



/***/ }),

/***/ "./node_modules/minilog/lib/common/transform.js":
/*!******************************************************!*\
  !*** ./node_modules/minilog/lib/common/transform.js ***!
  \******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var microee = __webpack_require__(/*! microee */ "./node_modules/microee/index.js");

// Implements a subset of Node's stream.Transform - in a cross-platform manner.
function Transform() {}

microee.mixin(Transform);

// The write() signature is different from Node's
// --> makes it much easier to work with objects in logs.
// One of the lessons from v1 was that it's better to target
// a good browser rather than the lowest common denominator
// internally.
// If you want to use external streams, pipe() to ./stringify.js first.
Transform.prototype.write = function(name, level, args) {
  this.emit('item', name, level, args);
};

Transform.prototype.end = function() {
  this.emit('end');
  this.removeAllListeners();
};

Transform.prototype.pipe = function(dest) {
  var s = this;
  // prevent double piping
  s.emit('unpipe', dest);
  // tell the dest that it's being piped to
  dest.emit('pipe', s);

  function onItem() {
    dest.write.apply(dest, Array.prototype.slice.call(arguments));
  }
  function onEnd() { !dest._isStdio && dest.end(); }

  s.on('item', onItem);
  s.on('end', onEnd);

  s.when('unpipe', function(from) {
    var match = (from === dest) || typeof from == 'undefined';
    if(match) {
      s.removeListener('item', onItem);
      s.removeListener('end', onEnd);
      dest.emit('unpipe');
    }
    return match;
  });

  return dest;
};

Transform.prototype.unpipe = function(from) {
  this.emit('unpipe', from);
  return this;
};

Transform.prototype.format = function(dest) {
  throw new Error([
    'Warning: .format() is deprecated in Minilog v2! Use .pipe() instead. For example:',
    'var Minilog = require(\'minilog\');',
    'Minilog',
    '  .pipe(Minilog.backends.console.formatClean)',
    '  .pipe(Minilog.backends.console);'].join('\n'));
};

Transform.mixin = function(dest) {
  var o = Transform.prototype, k;
  for (k in o) {
    o.hasOwnProperty(k) && (dest.prototype[k] = o[k]);
  }
};

module.exports = Transform;


/***/ }),

/***/ "./node_modules/minilog/lib/web/array.js":
/*!***********************************************!*\
  !*** ./node_modules/minilog/lib/web/array.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Transform = __webpack_require__(/*! ../common/transform.js */ "./node_modules/minilog/lib/common/transform.js"),
    cache = [ ];

var logger = new Transform();

logger.write = function(name, level, args) {
  cache.push([ name, level, args ]);
};

// utility functions
logger.get = function() { return cache; };
logger.empty = function() { cache = []; };

module.exports = logger;


/***/ }),

/***/ "./node_modules/minilog/lib/web/console.js":
/*!*************************************************!*\
  !*** ./node_modules/minilog/lib/web/console.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Transform = __webpack_require__(/*! ../common/transform.js */ "./node_modules/minilog/lib/common/transform.js");

var newlines = /\n+$/,
    logger = new Transform();

logger.write = function(name, level, args) {
  var i = args.length-1;
  if (typeof console === 'undefined' || !console.log) {
    return;
  }
  if(console.log.apply) {
    return console.log.apply(console, [name, level].concat(args));
  } else if(JSON && JSON.stringify) {
    // console.log.apply is undefined in IE8 and IE9
    // for IE8/9: make console.log at least a bit less awful
    if(args[i] && typeof args[i] == 'string') {
      args[i] = args[i].replace(newlines, '');
    }
    try {
      for(i = 0; i < args.length; i++) {
        args[i] = JSON.stringify(args[i]);
      }
    } catch(e) {}
    console.log(args.join(' '));
  }
};

logger.formatters = ['color', 'minilog'];
logger.color = __webpack_require__(/*! ./formatters/color.js */ "./node_modules/minilog/lib/web/formatters/color.js");
logger.minilog = __webpack_require__(/*! ./formatters/minilog.js */ "./node_modules/minilog/lib/web/formatters/minilog.js");

module.exports = logger;


/***/ }),

/***/ "./node_modules/minilog/lib/web/formatters/color.js":
/*!**********************************************************!*\
  !*** ./node_modules/minilog/lib/web/formatters/color.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Transform = __webpack_require__(/*! ../../common/transform.js */ "./node_modules/minilog/lib/common/transform.js"),
    color = __webpack_require__(/*! ./util.js */ "./node_modules/minilog/lib/web/formatters/util.js");

var colors = { debug: ['cyan'], info: ['purple' ], warn: [ 'yellow', true ], error: [ 'red', true ] },
    logger = new Transform();

logger.write = function(name, level, args) {
  var fn = console.log;
  if(console[level] && console[level].apply) {
    fn = console[level];
    fn.apply(console, [ '%c'+name+' %c'+level, color('gray'), color.apply(color, colors[level])].concat(args));
  }
};

// NOP, because piping the formatted logs can only cause trouble.
logger.pipe = function() { };

module.exports = logger;


/***/ }),

/***/ "./node_modules/minilog/lib/web/formatters/minilog.js":
/*!************************************************************!*\
  !*** ./node_modules/minilog/lib/web/formatters/minilog.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Transform = __webpack_require__(/*! ../../common/transform.js */ "./node_modules/minilog/lib/common/transform.js"),
    color = __webpack_require__(/*! ./util.js */ "./node_modules/minilog/lib/web/formatters/util.js"),
    colors = { debug: ['gray'], info: ['purple' ], warn: [ 'yellow', true ], error: [ 'red', true ] },
    logger = new Transform();

logger.write = function(name, level, args) {
  var fn = console.log;
  if(level != 'debug' && console[level]) {
    fn = console[level];
  }

  var subset = [], i = 0;
  if(level != 'info') {
    for(; i < args.length; i++) {
      if(typeof args[i] != 'string') break;
    }
    fn.apply(console, [ '%c'+name +' '+ args.slice(0, i).join(' '), color.apply(color, colors[level]) ].concat(args.slice(i)));
  } else {
    fn.apply(console, [ '%c'+name, color.apply(color, colors[level]) ].concat(args));
  }
};

// NOP, because piping the formatted logs can only cause trouble.
logger.pipe = function() { };

module.exports = logger;


/***/ }),

/***/ "./node_modules/minilog/lib/web/formatters/util.js":
/*!*********************************************************!*\
  !*** ./node_modules/minilog/lib/web/formatters/util.js ***!
  \*********************************************************/
/***/ ((module) => {

var hex = {
  black: '#000',
  red: '#c23621',
  green: '#25bc26',
  yellow: '#bbbb00',
  blue:  '#492ee1',
  magenta: '#d338d3',
  cyan: '#33bbc8',
  gray: '#808080',
  purple: '#708'
};
function color(fg, isInverse) {
  if(isInverse) {
    return 'color: #fff; background: '+hex[fg]+';';
  } else {
    return 'color: '+hex[fg]+';';
  }
}

module.exports = color;


/***/ }),

/***/ "./node_modules/minilog/lib/web/index.js":
/*!***********************************************!*\
  !*** ./node_modules/minilog/lib/web/index.js ***!
  \***********************************************/
/***/ ((module, exports, __webpack_require__) => {

var Minilog = __webpack_require__(/*! ../common/minilog.js */ "./node_modules/minilog/lib/common/minilog.js");

var oldEnable = Minilog.enable,
    oldDisable = Minilog.disable,
    isChrome = (typeof navigator != 'undefined' && /chrome/i.test(navigator.userAgent)),
    console = __webpack_require__(/*! ./console.js */ "./node_modules/minilog/lib/web/console.js");

// Use a more capable logging backend if on Chrome
Minilog.defaultBackend = (isChrome ? console.minilog : console);

// apply enable inputs from localStorage and from the URL
if(typeof window != 'undefined') {
  try {
    Minilog.enable(JSON.parse(window.localStorage['minilogSettings']));
  } catch(e) {}
  if(window.location && window.location.search) {
    var match = RegExp('[?&]minilog=([^&]*)').exec(window.location.search);
    match && Minilog.enable(decodeURIComponent(match[1]));
  }
}

// Make enable also add to localStorage
Minilog.enable = function() {
  oldEnable.call(Minilog, true);
  try { window.localStorage['minilogSettings'] = JSON.stringify(true); } catch(e) {}
  return this;
};

Minilog.disable = function() {
  oldDisable.call(Minilog);
  try { delete window.localStorage.minilogSettings; } catch(e) {}
  return this;
};

exports = module.exports = Minilog;

exports.backends = {
  array: __webpack_require__(/*! ./array.js */ "./node_modules/minilog/lib/web/array.js"),
  browser: Minilog.defaultBackend,
  localStorage: __webpack_require__(/*! ./localstorage.js */ "./node_modules/minilog/lib/web/localstorage.js"),
  jQuery: __webpack_require__(/*! ./jquery_simple.js */ "./node_modules/minilog/lib/web/jquery_simple.js")
};


/***/ }),

/***/ "./node_modules/minilog/lib/web/jquery_simple.js":
/*!*******************************************************!*\
  !*** ./node_modules/minilog/lib/web/jquery_simple.js ***!
  \*******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Transform = __webpack_require__(/*! ../common/transform.js */ "./node_modules/minilog/lib/common/transform.js");

var cid = new Date().valueOf().toString(36);

function AjaxLogger(options) {
  this.url = options.url || '';
  this.cache = [];
  this.timer = null;
  this.interval = options.interval || 30*1000;
  this.enabled = true;
  this.jQuery = window.jQuery;
  this.extras = {};
}

Transform.mixin(AjaxLogger);

AjaxLogger.prototype.write = function(name, level, args) {
  if(!this.timer) { this.init(); }
  this.cache.push([name, level].concat(args));
};

AjaxLogger.prototype.init = function() {
  if(!this.enabled || !this.jQuery) return;
  var self = this;
  this.timer = setTimeout(function() {
    var i, logs = [], ajaxData, url = self.url;
    if(self.cache.length == 0) return self.init();
    // Test each log line and only log the ones that are valid (e.g. don't have circular references).
    // Slight performance hit but benefit is we log all valid lines.
    for(i = 0; i < self.cache.length; i++) {
      try {
        JSON.stringify(self.cache[i]);
        logs.push(self.cache[i]);
      } catch(e) { }
    }
    if(self.jQuery.isEmptyObject(self.extras)) {
        ajaxData = JSON.stringify({ logs: logs });
        url = self.url + '?client_id=' + cid;
    } else {
        ajaxData = JSON.stringify(self.jQuery.extend({logs: logs}, self.extras));
    }

    self.jQuery.ajax(url, {
      type: 'POST',
      cache: false,
      processData: false,
      data: ajaxData,
      contentType: 'application/json',
      timeout: 10000
    }).success(function(data, status, jqxhr) {
      if(data.interval) {
        self.interval = Math.max(1000, data.interval);
      }
    }).error(function() {
      self.interval = 30000;
    }).always(function() {
      self.init();
    });
    self.cache = [];
  }, this.interval);
};

AjaxLogger.prototype.end = function() {};

// wait until jQuery is defined. Useful if you don't control the load order.
AjaxLogger.jQueryWait = function(onDone) {
  if(typeof window !== 'undefined' && (window.jQuery || window.$)) {
    return onDone(window.jQuery || window.$);
  } else if (typeof window !== 'undefined') {
    setTimeout(function() { AjaxLogger.jQueryWait(onDone); }, 200);
  }
};

module.exports = AjaxLogger;


/***/ }),

/***/ "./node_modules/minilog/lib/web/localstorage.js":
/*!******************************************************!*\
  !*** ./node_modules/minilog/lib/web/localstorage.js ***!
  \******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Transform = __webpack_require__(/*! ../common/transform.js */ "./node_modules/minilog/lib/common/transform.js"),
    cache = false;

var logger = new Transform();

logger.write = function(name, level, args) {
  if(typeof window == 'undefined' || typeof JSON == 'undefined' || !JSON.stringify || !JSON.parse) return;
  try {
    if(!cache) { cache = (window.localStorage.minilog ? JSON.parse(window.localStorage.minilog) : []); }
    cache.push([ new Date().toString(), name, level, args ]);
    window.localStorage.minilog = JSON.stringify(cache);
  } catch(e) {}
};

module.exports = logger;

/***/ }),

/***/ "./src/dispatch/shared-dispatch.js":
/*!*****************************************!*\
  !*** ./src/dispatch/shared-dispatch.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const log = __webpack_require__(/*! ../util/log */ "./src/util/log.js");
const mlforkidsSound = __webpack_require__(/*! ../mlforkids-components/sound */ "./src/mlforkids-components/sound/index.js");
const mlforkidsImages = __webpack_require__(/*! ../mlforkids-components/images */ "./src/mlforkids-components/images/index.js");
const mlforkidsRegression = __webpack_require__(/*! ../mlforkids-components/regression */ "./src/mlforkids-components/regression/index.js");
const mlforkidsNumbers = __webpack_require__(/*! ../mlforkids-components/numbers */ "./src/mlforkids-components/numbers/index.js");
const mlforkidsTensorFlow = __webpack_require__(/*! ../mlforkids-components/tensorflow */ "./src/mlforkids-components/tensorflow/index.js");
const mlforkidsWebllm = __webpack_require__(/*! ../mlforkids-components/webllm */ "./src/mlforkids-components/webllm/index.js");
const mlforkidsStorage = __webpack_require__(/*! ../mlforkids-components/storage */ "./src/mlforkids-components/storage/index.js");

/**
 * @typedef {object} DispatchCallMessage - a message to the dispatch system representing a service method call
 * @property {*} responseId - send a response message with this response ID. See {@link DispatchResponseMessage}
 * @property {string} service - the name of the service to be called
 * @property {string} method - the name of the method to be called
 * @property {Array|undefined} args - the arguments to be passed to the method
 */

/**
 * @typedef {object} DispatchResponseMessage - a message to the dispatch system representing the results of a call
 * @property {*} responseId - a copy of the response ID from the call which generated this response
 * @property {*|undefined} error - if this is truthy, then it contains results from a failed call (such as an exception)
 * @property {*|undefined} result - if error is not truthy, then this contains the return value of the call (if any)
 */

/**
 * @typedef {DispatchCallMessage|DispatchResponseMessage} DispatchMessage
 * Any message to the dispatch system.
 */

/**
 * The SharedDispatch class is responsible for dispatch features shared by
 * {@link CentralDispatch} and {@link WorkerDispatch}.
 */
class SharedDispatch {
  constructor() {
    /**
     * List of callback registrations for promises waiting for a response from a call to a service on another
     * worker. A callback registration is an array of [resolve,reject] Promise functions.
     * Calls to local services don't enter this list.
     * @type {Array.<Function[]>}
     */
    this.callbacks = [];

    /**
     * The next response ID to be used.
     * @type {int}
     */
    this.nextResponseId = 0;
  }

  /**
   * Call a particular method on a particular service, regardless of whether that service is provided locally or on
   * a worker. If the service is provided by a worker, the `args` will be copied using the Structured Clone
   * algorithm, except for any items which are also in the `transfer` list. Ownership of those items will be
   * transferred to the worker, and they should not be used after this call.
   * @example
   *      dispatcher.call('vm', 'setData', 'cat', 42);
   *      // this finds the worker for the 'vm' service, then on that worker calls:
   *      vm.setData('cat', 42);
   * @param {string} service - the name of the service.
   * @param {string} method - the name of the method.
   * @param {*} [args] - the arguments to be copied to the method, if any.
   * @returns {Promise} - a promise for the return value of the service method.
   */
  call(service, method) {
    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }
    return this.transferCall(service, method, null, ...args);
  }

  /**
   * Call a particular method on a particular service, regardless of whether that service is provided locally or on
   * a worker. If the service is provided by a worker, the `args` will be copied using the Structured Clone
   * algorithm, except for any items which are also in the `transfer` list. Ownership of those items will be
   * transferred to the worker, and they should not be used after this call.
   * @example
   *      dispatcher.transferCall('vm', 'setData', [myArrayBuffer], 'cat', myArrayBuffer);
   *      // this finds the worker for the 'vm' service, transfers `myArrayBuffer` to it, then on that worker calls:
   *      vm.setData('cat', myArrayBuffer);
   * @param {string} service - the name of the service.
   * @param {string} method - the name of the method.
   * @param {Array} [transfer] - objects to be transferred instead of copied. Must be present in `args` to be useful.
   * @param {*} [args] - the arguments to be copied to the method, if any.
   * @returns {Promise} - a promise for the return value of the service method.
   */
  transferCall(service, method, transfer) {
    try {
      const {
        provider,
        isRemote
      } = this._getServiceProvider(service);
      if (provider) {
        for (var _len2 = arguments.length, args = new Array(_len2 > 3 ? _len2 - 3 : 0), _key2 = 3; _key2 < _len2; _key2++) {
          args[_key2 - 3] = arguments[_key2];
        }
        if (isRemote) {
          return this._remoteTransferCall(provider, service, method, transfer, ...args);
        }

        // TODO: verify correct `this` after switching from apply to spread
        // eslint-disable-next-line prefer-spread
        const result = provider[method].apply(provider, args);
        return Promise.resolve(result);
      }
      return Promise.reject(new Error("Service not found: ".concat(service)));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Check if a particular service lives on another worker.
   * @param {string} service - the service to check.
   * @returns {boolean} - true if the service is remote (calls must cross a Worker boundary), false otherwise.
   * @private
   */
  _isRemoteService(service) {
    return this._getServiceProvider(service).isRemote;
  }

  /**
   * Like {@link call}, but force the call to be posted through a particular communication channel.
   * @param {object} provider - send the call through this object's `postMessage` function.
   * @param {string} service - the name of the service.
   * @param {string} method - the name of the method.
   * @param {*} [args] - the arguments to be copied to the method, if any.
   * @returns {Promise} - a promise for the return value of the service method.
   */
  _remoteCall(provider, service, method) {
    for (var _len3 = arguments.length, args = new Array(_len3 > 3 ? _len3 - 3 : 0), _key3 = 3; _key3 < _len3; _key3++) {
      args[_key3 - 3] = arguments[_key3];
    }
    return this._remoteTransferCall(provider, service, method, null, ...args);
  }

  /**
   * Like {@link transferCall}, but force the call to be posted through a particular communication channel.
   * @param {object} provider - send the call through this object's `postMessage` function.
   * @param {string} service - the name of the service.
   * @param {string} method - the name of the method.
   * @param {Array} [transfer] - objects to be transferred instead of copied. Must be present in `args` to be useful.
   * @param {*} [args] - the arguments to be copied to the method, if any.
   * @returns {Promise} - a promise for the return value of the service method.
   */
  _remoteTransferCall(provider, service, method, transfer) {
    for (var _len4 = arguments.length, args = new Array(_len4 > 4 ? _len4 - 4 : 0), _key4 = 4; _key4 < _len4; _key4++) {
      args[_key4 - 4] = arguments[_key4];
    }
    return new Promise((resolve, reject) => {
      const responseId = this._storeCallbacks(resolve, reject);

      /** @TODO: remove this hack! this is just here so we don't try to send `util` to a worker */
      if (args.length > 0 && typeof args[args.length - 1].yield === 'function') {
        args.pop();
      }
      if (transfer) {
        provider.postMessage({
          service,
          method,
          responseId,
          args
        }, transfer);
      } else {
        provider.postMessage({
          service,
          method,
          responseId,
          args
        });
      }
    });
  }

  /**
   * Store callback functions pending a response message.
   * @param {Function} resolve - function to call if the service method returns.
   * @param {Function} reject - function to call if the service method throws.
   * @returns {*} - a unique response ID for this set of callbacks. See {@link _deliverResponse}.
   * @protected
   */
  _storeCallbacks(resolve, reject) {
    const responseId = this.nextResponseId++;
    this.callbacks[responseId] = [resolve, reject];
    return responseId;
  }

  /**
   * Deliver call response from a worker. This should only be called as the result of a message from a worker.
   * @param {int} responseId - the response ID of the callback set to call.
   * @param {DispatchResponseMessage} message - the message containing the response value(s).
   * @protected
   */
  _deliverResponse(responseId, message) {
    try {
      const [resolve, reject] = this.callbacks[responseId];
      delete this.callbacks[responseId];
      if (message.error) {
        reject(message.error);
      } else {
        resolve(message.result);
      }
    } catch (e) {
      log.error("Dispatch callback failed: ".concat(JSON.stringify(e)));
    }
  }

  /**
   * Handle a message event received from a connected worker.
   * @param {Worker} worker - the worker which sent the message, or the global object if running in a worker.
   * @param {MessageEvent} event - the message event to be handled.
   * @protected
   */
  _onMessage(worker, event) {
    /** @type {DispatchMessage} */
    const message = event.data;
    message.args = message.args || [];
    let promise;
    if (message.service) {
      if (message.service === 'dispatch') {
        promise = this._onDispatchMessage(worker, message);
      } else {
        promise = this.call(message.service, message.method, ...message.args);
      }
    } else if (message.mlforkids) {
      console.log('[mlforkids] Handling message from ML for Kids extension running in a web worker', message);
      window.dispatchEvent(new Event(message.mlforkids));
    } else if (message.mlforkidssound) {
      if (message.mlforkidssound.command === 'init') {
        if (!this.mlforkidsSoundSupport) {
          this.mlforkidsSoundSupport = new mlforkidsSound(this.mlforkidsStorageSupport);
        }
        this.mlforkidsSoundSupport.init(message.mlforkidssound.data, worker);
      } else if (message.mlforkidssound.command === 'initlocal') {
        if (!this.mlforkidsSoundSupport) {
          this.mlforkidsSoundSupport = new mlforkidsSound(this.mlforkidsStorageSupport);
        }
        return this.mlforkidsStorageSupport.getProject(message.mlforkidssound.data).then(projectinfo => {
          projectinfo.projectid = message.mlforkidssound.data;
          this.mlforkidsSoundSupport.init(projectinfo, worker);
        }).catch(err => {
          console.log('[mlforkids] failed to load project', err);
          worker.postMessage({
            mlforkidssound: 'modelfailed'
          });
        });
      } else if (message.mlforkidssound.command === 'train') {
        this.mlforkidsSoundSupport.trainNewModel(message.mlforkidssound.data, worker);
      } else if (message.mlforkidssound.command === 'trainlocal') {
        this.mlforkidsSoundSupport.trainNewModelLocal(message.mlforkidssound.data, worker);
      } else if (message.mlforkidssound.command === 'listen') {
        this.mlforkidsSoundSupport.startListening(worker);
      } else if (message.mlforkidssound.command === 'stoplisten') {
        this.mlforkidsSoundSupport.stopListening(worker);
      }
    } else if (message.mlforkidsimage) {
      if (message.mlforkidsimage.command === 'init') {
        if (!this.mlforkidsImageSupport) {
          this.mlforkidsImageSupport = new mlforkidsImages(this.mlforkidsStorageSupport);
        }
        this.mlforkidsImageSupport.init().then(() => {
          this.mlforkidsImageSupport.initProject(message.mlforkidsimage.data, worker);
        });
      } else if (message.mlforkidsimage.command === 'initlocal') {
        if (!this.mlforkidsImageSupport) {
          this.mlforkidsImageSupport = new mlforkidsImages(this.mlforkidsStorageSupport);
        }
        this.mlforkidsImageSupport.init().then(() => {
          return this.mlforkidsStorageSupport.getProject(message.mlforkidsimage.data);
        }).then(projectinfo => {
          projectinfo.projectid = message.mlforkidsimage.data;
          this.mlforkidsImageSupport.initProject(projectinfo, worker);
        }).catch(err => {
          console.log('[mlforkids] failed to load project', err);
          worker.postMessage({
            mlforkidsimage: 'modelfailed',
            data: {
              projectid: message.mlforkidsimage.data
            }
          });
        });
      } else if (message.mlforkidsimage.command === 'classify') {
        this.mlforkidsImageSupport.classifyImageData(message.mlforkidsimage.data, worker);
      } else if (message.mlforkidsimage.command === 'train') {
        this.mlforkidsImageSupport.trainNewModel(message.mlforkidsimage.data, worker);
      } else if (message.mlforkidsimage.command === 'trainlocal') {
        this.mlforkidsImageSupport.trainNewModelLocal(message.mlforkidsimage.data, worker);
      }
    } else if (message.mlforkidsnumbers) {
      if (message.mlforkidsnumbers.command === 'init') {
        if (!this.mlforkidsNumbersSupport) {
          this.mlforkidsNumbersSupport = new mlforkidsNumbers(this.mlforkidsStorageSupport);
        }
        this.mlforkidsNumbersSupport.init().then(() => {
          this.mlforkidsNumbersSupport.initProject({
            id: message.mlforkidsnumbers.data
          }, worker);
        }).catch(err => {
          console.log('[mlforkids] failed to prepare numbers support', err);
          worker.postMessage({
            mlforkidsnumbers: 'modelfailed',
            data: {
              projectid: message.mlforkidsnumbers.data
            }
          });
        });
      } else if (message.mlforkidsnumbers.command === 'initlocal') {
        if (!this.mlforkidsNumbersSupport) {
          this.mlforkidsNumbersSupport = new mlforkidsNumbers(this.mlforkidsStorageSupport);
        }
        this.mlforkidsNumbersSupport.init().then(() => {
          return this.mlforkidsStorageSupport.getProject(message.mlforkidsnumbers.data);
        }).then(projectinfo => {
          projectinfo.projectid = message.mlforkidsnumbers.data;
          this.mlforkidsNumbersSupport.initProject(projectinfo, worker);
        }).catch(err => {
          console.log('[mlforkids] failed to load project', err);
          worker.postMessage({
            mlforkidsnumbers: 'modelfailed',
            data: {
              projectid: message.mlforkidsnumbers.data
            }
          });
        });
      } else if (message.mlforkidsnumbers.command === 'classify') {
        this.mlforkidsNumbersSupport.classifyNumberData(message.mlforkidsnumbers.data, worker);
      } else if (message.mlforkidsnumbers.command === 'train') {
        this.mlforkidsNumbersSupport.trainNewModel(message.mlforkidsnumbers.data, worker);
      } else if (message.mlforkidsnumbers.command === 'trainlocal') {
        this.mlforkidsNumbersSupport.trainNewModelLocal(message.mlforkidsnumbers.data, worker);
      }
    } else if (message.mlforkidsregression) {
      if (message.mlforkidsregression.command === 'init') {
        if (!this.mlforkidsRegressionSupport) {
          this.mlforkidsRegressionSupport = new mlforkidsRegression(this.mlforkidsStorageSupport);
        }
        this.mlforkidsRegressionSupport.init().then(() => {
          return this.mlforkidsStorageSupport.getProject(message.mlforkidsregression.data);
        }).then(projectinfo => {
          projectinfo.projectid = message.mlforkidsregression.data;
          this.mlforkidsRegressionSupport.initProject(projectinfo, worker);
        }).catch(err => {
          console.log('[mlforkids] failed to load project', err);
          worker.postMessage({
            mlforkidsimage: 'modelfailed',
            data: {
              projectid: message.mlforkidsregression.data
            }
          });
        });
      } else if (message.mlforkidsregression.command === 'train') {
        this.mlforkidsRegressionSupport.trainNewModel(message.mlforkidsregression.data, worker);
      } else if (message.mlforkidsregression.command === 'predict') {
        this.mlforkidsRegressionSupport.predict(message.mlforkidsregression.data, worker);
      }
    } else if (message.mlforkidsstorage) {
      if (message.mlforkidsstorage.command === 'init') {
        if (!this.mlforkidsStorageSupport) {
          this.mlforkidsStorageSupport = new mlforkidsStorage();
        }
      } else if (message.mlforkidsstorage.command === 'storeimage') {
        this.mlforkidsStorageSupport.storeBase64EncodedImage(message.mlforkidsstorage.data.projectid, message.mlforkidsstorage.data.label, message.mlforkidsstorage.data.image);
      } else if (message.mlforkidsstorage.command === 'storetext') {
        this.mlforkidsStorageSupport.addTrainingData(message.mlforkidsstorage.data.projectid, {
          textdata: message.mlforkidsstorage.data.textdata,
          label: message.mlforkidsstorage.data.label
        });
      } else if (message.mlforkidsstorage.command === 'storeregression') {
        this.mlforkidsStorageSupport.addTrainingData(message.mlforkidsstorage.data.projectid, message.mlforkidsstorage.data.values);
      } else if (message.mlforkidsstorage.command === 'storenumbers') {
        this.mlforkidsStorageSupport.addTrainingData(message.mlforkidsstorage.data.projectid, {
          numberdata: message.mlforkidsstorage.data.numberdata,
          label: message.mlforkidsstorage.data.label
        });
      } else if (message.mlforkidsstorage.command === 'textwatson') {
        this.mlforkidsStorageSupport.getProject(message.mlforkidsstorage.data.projectid).then(projectinfo => {
          return this.mlforkidsStorageSupport.getTrainingForCloud(projectinfo);
        }).then(training => {
          worker.postMessage({
            mlforkidsstorage: 'textwatson',
            projectid: message.mlforkidsstorage.data.projectid,
            data: training
          });
        });
      } else if (message.mlforkidsstorage.command === 'trainingdata') {
        this.mlforkidsStorageSupport.getTrainingData(message.mlforkidsstorage.data.projectid).then(training => {
          worker.postMessage({
            mlforkidsstorage: 'trainingdata',
            projectid: message.mlforkidsstorage.data.projectid,
            data: training
          });
        });
      }
    } else if (message.mlforkidstensorflow) {
      if (message.mlforkidstensorflow.command === 'init') {
        if (!this.mlforkidsTensorFlowSupport) {
          this.mlforkidsTensorFlowSupport = new mlforkidsTensorFlow();
        }
        this.mlforkidsTensorFlowSupport.initProject(message.mlforkidstensorflow.data, worker);
      } else if (message.mlforkidstensorflow.command === 'classify') {
        this.mlforkidsTensorFlowSupport.classifyData(message.mlforkidstensorflow.data, worker);
      }
    } else if (message.mlforkidswebllm) {
      if (message.mlforkidswebllm.command === 'init') {
        if (!this.mlforkidsWebLlmSupport) {
          this.mlforkidsWebLlmSupport = new mlforkidsWebllm();
        }
        this.mlforkidsWebLlmSupport.initModel(message.mlforkidswebllm.data, worker);
      } else if (message.mlforkidswebllm.command === 'clear') {
        this.mlforkidsWebLlmSupport.clearContext(message.mlforkidswebllm.data);
      } else if (message.mlforkidswebllm.command === 'prompt') {
        this.mlforkidsWebLlmSupport.promptModel(message.mlforkidswebllm.data, worker);
      }
    } else if (typeof message.responseId === 'undefined') {
      log.error("Dispatch caught malformed message from a worker: ".concat(JSON.stringify(event)));
    } else {
      this._deliverResponse(message.responseId, message);
    }
    if (promise) {
      if (typeof message.responseId === 'undefined') {
        log.error("Dispatch message missing required response ID: ".concat(JSON.stringify(event)));
      } else {
        promise.then(result => worker.postMessage({
          responseId: message.responseId,
          result
        }), error => worker.postMessage({
          responseId: message.responseId,
          error
        }));
      }
    }
  }

  /**
   * Fetch the service provider object for a particular service name.
   * @abstract
   * @param {string} service - the name of the service to look up
   * @returns {{provider:(object|Worker), isRemote:boolean}} - the means to contact the service, if found
   * @protected
   */
  _getServiceProvider(service) {
    throw new Error("Could not get provider for ".concat(service, ": _getServiceProvider not implemented"));
  }

  /**
   * Handle a call message sent to the dispatch service itself
   * @abstract
   * @param {Worker} worker - the worker which sent the message.
   * @param {DispatchCallMessage} message - the message to be handled.
   * @returns {Promise|undefined} - a promise for the results of this operation, if appropriate
   * @private
   */
  _onDispatchMessage(worker, message) {
    throw new Error("Unimplemented dispatch message handler cannot handle ".concat(message.method, " method"));
  }
}
module.exports = SharedDispatch;

/***/ }),

/***/ "./src/dispatch/worker-dispatch.js":
/*!*****************************************!*\
  !*** ./src/dispatch/worker-dispatch.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const SharedDispatch = __webpack_require__(/*! ./shared-dispatch */ "./src/dispatch/shared-dispatch.js");
const log = __webpack_require__(/*! ../util/log */ "./src/util/log.js");

/**
 * This class provides a Worker with the means to participate in the message dispatch system managed by CentralDispatch.
 * From any context in the messaging system, the dispatcher's "call" method can call any method on any "service"
 * provided in any participating context. The dispatch system will forward function arguments and return values across
 * worker boundaries as needed.
 * @see {CentralDispatch}
 */
class WorkerDispatch extends SharedDispatch {
  constructor() {
    super();

    /**
     * This promise will be resolved when we have successfully connected to central dispatch.
     * @type {Promise}
     * @see {waitForConnection}
     * @private
     */
    this._connectionPromise = new Promise(resolve => {
      this._onConnect = resolve;
    });

    /**
     * Map of service name to local service provider.
     * If a service is not listed here, it is assumed to be provided by another context (another Worker or the main
     * thread).
     * @see {setService}
     * @type {object}
     */
    this.services = {};
    this._onMessage = this._onMessage.bind(this, self);
    if (typeof self !== 'undefined') {
      self.onmessage = this._onMessage;
    }
  }

  /**
   * @returns {Promise} a promise which will resolve upon connection to central dispatch. If you need to make a call
   * immediately on "startup" you can attach a 'then' to this promise.
   * @example
   *      dispatch.waitForConnection.then(() => {
   *          dispatch.call('myService', 'hello');
   *      })
   */
  get waitForConnection() {
    return this._connectionPromise;
  }

  /**
   * Set a local object as the global provider of the specified service.
   * WARNING: Any method on the provider can be called from any worker within the dispatch system.
   * @param {string} service - a globally unique string identifying this service. Examples: 'vm', 'gui', 'extension9'.
   * @param {object} provider - a local object which provides this service.
   * @returns {Promise} - a promise which will resolve once the service is registered.
   */
  setService(service, provider) {
    if (Object.prototype.hasOwnProperty.call(this.services, service)) {
      log.warn("Worker dispatch replacing existing service provider for ".concat(service));
    }
    this.services[service] = provider;
    return this.waitForConnection.then(() => this._remoteCall(self, 'dispatch', 'setService', service));
  }

  /**
   * Fetch the service provider object for a particular service name.
   * @override
   * @param {string} service - the name of the service to look up
   * @returns {{provider:(object|Worker), isRemote:boolean}} - the means to contact the service, if found
   * @protected
   */
  _getServiceProvider(service) {
    // if we don't have a local service by this name, contact central dispatch by calling `postMessage` on self
    const provider = this.services[service];
    return {
      provider: provider || self,
      isRemote: !provider
    };
  }

  /**
   * Handle a call message sent to the dispatch service itself
   * @override
   * @param {Worker} worker - the worker which sent the message.
   * @param {DispatchCallMessage} message - the message to be handled.
   * @returns {Promise|undefined} - a promise for the results of this operation, if appropriate
   * @protected
   */
  _onDispatchMessage(worker, message) {
    let promise;
    switch (message.method) {
      case 'handshake':
        promise = this._onConnect();
        break;
      case 'terminate':
        // Don't close until next tick, after sending confirmation back
        setTimeout(() => self.close(), 0);
        promise = Promise.resolve();
        break;
      default:
        log.error("Worker dispatch received message for unknown method: ".concat(message.method));
    }
    return promise;
  }
}
module.exports = new WorkerDispatch();

/***/ }),

/***/ "./src/extension-support/argument-type.js":
/*!************************************************!*\
  !*** ./src/extension-support/argument-type.js ***!
  \************************************************/
/***/ ((module) => {

/**
 * Block argument types
 * @enum {string}
 */
const ArgumentType = {
  /**
   * Numeric value with angle picker
   */
  ANGLE: 'angle',
  /**
   * Boolean value with hexagonal placeholder
   */
  BOOLEAN: 'Boolean',
  /**
   * Numeric value with color picker
   */
  COLOR: 'color',
  /**
   * Numeric value with text field
   */
  NUMBER: 'number',
  /**
   * String value with text field
   */
  STRING: 'string',
  /**
   * String value with matrix field
   */
  MATRIX: 'matrix',
  /**
   * MIDI note number with note picker (piano) field
   */
  NOTE: 'note',
  /**
   * Inline image on block (as part of the label)
   */
  IMAGE: 'image'
};
module.exports = ArgumentType;

/***/ }),

/***/ "./src/extension-support/block-type.js":
/*!*********************************************!*\
  !*** ./src/extension-support/block-type.js ***!
  \*********************************************/
/***/ ((module) => {

/**
 * Types of block
 * @enum {string}
 */
const BlockType = {
  /**
   * Boolean reporter with hexagonal shape
   */
  BOOLEAN: 'Boolean',
  /**
   * A button (not an actual block) for some special action, like making a variable
   */
  BUTTON: 'button',
  /**
   * Command block
   */
  COMMAND: 'command',
  /**
   * Specialized command block which may or may not run a child branch
   * The thread continues with the next block whether or not a child branch ran.
   */
  CONDITIONAL: 'conditional',
  /**
   * Specialized hat block with no implementation function
   * This stack only runs if the corresponding event is emitted by other code.
   */
  EVENT: 'event',
  /**
   * Hat block which conditionally starts a block stack
   */
  HAT: 'hat',
  /**
   * Specialized command block which may or may not run a child branch
   * If a child branch runs, the thread evaluates the loop block again.
   */
  LOOP: 'loop',
  /**
   * General reporter with numeric or string value
   */
  REPORTER: 'reporter'
};
module.exports = BlockType;

/***/ }),

/***/ "./src/extension-support/target-type.js":
/*!**********************************************!*\
  !*** ./src/extension-support/target-type.js ***!
  \**********************************************/
/***/ ((module) => {

/**
 * Default types of Target supported by the VM
 * @enum {string}
 */
const TargetType = {
  /**
   * Rendered target which can move, change costumes, etc.
   */
  SPRITE: 'sprite',
  /**
   * Rendered target which cannot move but can change backdrops
   */
  STAGE: 'stage'
};
module.exports = TargetType;

/***/ }),

/***/ "./src/mlforkids-components/images/index.js":
/*!**************************************************!*\
  !*** ./src/mlforkids-components/images/index.js ***!
  \**************************************************/
/***/ ((module) => {

class ML4KidsImageTraining {
  // This component needs to support multiple instances of the image
  //  extension being used at once, so all state and models are
  //  indexed by project id
  // The base model can be shared across all projects

  // state = <INIT/READY/ERROR>
  // baseModel = <model>
  // PROJECTS[projectid].modelClasses = <label1/label2/label3/...>
  // PROJECTS[projectid].modelNumClasses = <number of modelClasses>
  // PROJECTS[projectid].state = INIT/READY/TRAINING/TRAINED/ERROR
  // PROJECTS[projectid].transferModel = <model>
  // PROJECTS[projectid].usingRestoredModel = true/false

  // states:
  //   INIT - not ready yet
  //   READY - ready for training
  //   TRAINING - training in progress
  //   TRAINED - ML model ready for use
  //   ERROR - something went wrong

  constructor(storageSupport) {
    this.PROJECTS = {};
    this.state = 'INIT';
    this._storageSupport = storageSupport;
  }

  // safe to call this multiple times, including calling it before the first call has completed
  init() {
    if (!this.initPromise) {
      this.initPromise = new Promise((resolve, reject) => {
        tf.enableProdMode();

        // const BASE_MODEL = 'https://storage.googleapis.com' +
        //                     '/tfjs-models/tfjs' +
        //                     '/mobilenet_v1_0.25_224' +
        //                     '/model.json';
        const BASE_MODEL = '/static/bower_components/tensorflow-models/image-recognition-scratch/model.json';
        tf.loadLayersModel(BASE_MODEL).then(pretrainedModel => {
          const activationLayer = pretrainedModel.getLayer('conv_pw_13_relu');
          this.baseModel = tf.model({
            inputs: pretrainedModel.inputs,
            outputs: activationLayer.output
          });
          this.state = 'READY';
          resolve();
        }).catch(err => {
          this.state = 'ERROR';
          console.log('[mlforkids] Failed to initialise images component', err);
          reject(err);
        });
      });
    }
    return this.initPromise;
  }

  // encprojectdata
  // JSON.stringify-ed version of
  //   { labels : [ labelA, labelB, labelC ], projectid : projectId }
  initProject(encprojectdata, worker) {
    console.log('[mlforkids] ML4KidsImageTraining init');
    const projectData = typeof encprojectdata === 'string' ? JSON.parse(encprojectdata) : encprojectdata;
    const projectid = projectData.projectid;
    this.PROJECTS[projectid] = {};
    this.PROJECTS[projectid].state = 'INIT';
    this.PROJECTS[projectid].modelClasses = projectData.labels;
    this.PROJECTS[projectid].modelNumClasses = projectData.labels.length;
    this.PROJECTS[projectid].usingRestoredModel = false;
    return this._loadModel(projectid).then(model => {
      if (model) {
        this.PROJECTS[projectid].transferModel = model;
        this.PROJECTS[projectid].state = 'TRAINED';
        this.PROJECTS[projectid].usingRestoredModel = true;
        worker.postMessage({
          mlforkidsimage: 'modelready',
          data: {
            projectid: projectid
          }
        });
      } else {
        this.PROJECTS[projectid].transferModel = this.prepareTransferLearningModel(projectData.labels.length);
        this.PROJECTS[projectid].state = 'READY';
        worker.postMessage({
          mlforkidsimage: 'modelinit',
          data: {
            projectid: projectid
          }
        });
      }
      this._watchForNewModels(projectid, worker);
    }).catch(err => {
      console.log('[mlforkids] ML4KidsImageTraining failed init', err);
      this.PROJECTS[projectid].state = 'ERROR';
      worker.postMessage({
        mlforkidsimage: 'modelfailed',
        data: {
          projectid: projectid
        }
      });
    });
  }
  sortByConfidence(a, b) {
    if (a.confidence < b.confidence) {
      return 1;
    } else if (a.confidence > b.confidence) {
      return -1;
    } else {
      return 0;
    }
  }

  // encrequest
  // JSON.stringify-ed version of
  //   { projectid : projectId, requestid : requestId, imagedata: base64-enc-jpg }
  classifyImageData(encrequest, worker) {
    const requestData = JSON.parse(encrequest);
    const projectid = requestData.projectid;
    const requestid = requestData.requestid;
    if (projectid in this.PROJECTS) {
      if (this.PROJECTS[projectid].state !== 'TRAINED') {
        console.log('[mlforkids] ML4KidsImageTraining received classify request before a model is ready');
        return worker.postMessage({
          mlforkidsimage: 'classifyresponse',
          data: {
            projectid: projectid,
            requestid: requestid
          }
        });
      }
      var imageElement = document.createElement('img');
      imageElement.width = 224;
      imageElement.height = 224;
      imageElement.onerror = err => {
        console.log('[mlforkids] failed to prepare image data for prediction', err);
        return worker.postMessage({
          mlforkidsimage: 'classifyresponse',
          data: {
            projectid: projectid,
            requestid: requestid
          }
        });
      };
      var that = this;
      imageElement.onload = () => {
        const imageDataTensor = tf.tidy(() => {
          return tf.browser.fromPixels(imageElement).expandDims(0).toFloat().div(127).sub(1);
        });
        const baseModelOutput = that.baseModel.predict(imageDataTensor);
        const transferModelOutput = that.PROJECTS[projectid].transferModel.predict(baseModelOutput);
        transferModelOutput.data().then(output => {
          if (output.length !== that.PROJECTS[projectid].modelNumClasses) {
            console.log('[mlforkids] ML4KidsImageTraining received unexpected classify response', output);
            return worker.postMessage({
              mlforkidsimage: 'classifyresponse',
              data: {
                projectid: projectid,
                requestid: requestid
              }
            });
          }
          const matches = that.PROJECTS[projectid].modelClasses.map((label, idx) => {
            return {
              class_name: label,
              confidence: 100 * output[idx]
            };
          }).sort(that.sortByConfidence);
          return worker.postMessage({
            mlforkidsimage: 'classifyresponse',
            data: {
              projectid: projectid,
              requestid: requestid,
              matches: matches
            }
          });
        });
      };
      imageElement.src = 'data:image/jpeg;base64,' + requestData.imagedata;
    } else {
      console.log('[mlforkids] ML4KidsImageTraining received request for unknown project');
      return worker.postMessage({
        mlforkidsimage: 'classifyresponse',
        data: {
          projectid: projectid,
          requestid: requestid
        }
      });
    }
  }
  prepareTransferLearningModel(numClasses) {
    var model = tf.sequential({
      layers: [tf.layers.flatten({
        inputShape: this.baseModel.outputs[0].shape.slice(1)
      }), tf.layers.dense({
        units: 100,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
        useBias: true
      }), tf.layers.dense({
        units: numClasses,
        activation: 'softmax',
        kernelInitializer: 'varianceScaling',
        useBias: false
      })]
    });
    model.compile({
      optimizer: tf.train.adam(0.0001),
      loss: 'categoricalCrossentropy'
    });
    return model;
  }
  _getModelDbLocation(projectid) {
    return 'indexeddb://ml4k-models-images-' + projectid.toString().replaceAll('-', '');
  }
  _loadModel(projectid) {
    console.log('[mlforkids] ML4KidsImageTraining loading model from browser storage');
    const savelocation = this._getModelDbLocation(projectid);
    return tf.loadLayersModel(savelocation).catch(err => {
      console.log('[mlforkids] ML4KidsImageTraining failed to load model from storage', err);
      return;
    });
  }
  _saveModel(projectid) {
    console.log('[mlforkids] ML4KidsImageTraining saving model to browser storage');
    const savelocation = this._getModelDbLocation(projectid);
    return this.PROJECTS[projectid].transferModel.save(savelocation).then(results => {
      console.log('[mlforkids] ML4KidsImageTraining saved model', savelocation, results);
      this._storeModelSavedDate(savelocation);
    }).catch(err => {
      console.log('[mlforkids] ML4KidsImageTraining failed to save model', err);
    });
  }
  _storeModelSavedDate(modelid) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(modelid, Date.now());
      }
    } catch (err) {
      console.log('[mlforkids] ML4KidsImageTraining unable to save model date');
    }
  }
  _watchForNewModels(projectid, worker) {
    if (!this.PROJECTS[projectid].modelWatcher) {
      console.log('[mlforkids] ML4KidsImageTraining listening for model updates', projectid);
      this.PROJECTS[projectid].modelWatcher = true;
      const modellocation = this._getModelDbLocation(projectid);
      this._storageSupport.registerForModelStorageUpdates(modellocation, () => {
        console.log('[mlforkids] ML4KidsImageTraining new model was trained outside of Scratch');
        return this._loadModel(projectid).then(model => {
          if (model) {
            this.PROJECTS[projectid].transferModel = model;
            this.PROJECTS[projectid].state = 'TRAINED';
            this.PROJECTS[projectid].usingRestoredModel = true;
            worker.postMessage({
              mlforkidsimage: 'modelready',
              data: {
                projectid: projectid
              }
            });
          } else {
            // we weren't able to load the model
            //  it may have been deleted outside of Scratch
            this.PROJECTS[projectid].state = 'ERROR';
            worker.postMessage({
              mlforkidsimage: 'modelfailed',
              data: {
                projectid: projectid
              }
            });
          }
        });
      });
    }
  }
  _getLocalImageData(projectid, trainingdataid) {
    let storedTrainingItem;
    return this._storageSupport.getTrainingDataItem(projectid, trainingdataid).then(trainingitem => {
      storedTrainingItem = trainingitem;
      if (!storedTrainingItem.imagedata) {
        const url = new URL('https://machinelearningforkids.co.uk/api/classes/' + tenant + '/students/' + userid + '/training/images');
        url.search = new URLSearchParams({
          imageurl: trainingitem.imageurl,
          label: trainingitem.label,
          option: 'prepare'
        });
        return fetch(url);
      }
    }).then(resp => {
      if (storedTrainingItem.imagedata) {
        return storedTrainingItem.imagedata;
      }
      return resp.arrayBuffer();
    }).then(imgdata => {
      return {
        imgdata,
        metadata: storedTrainingItem
      };
    });
  }
  trainNewModelLocal(projectinfo, worker) {
    const projectid = projectinfo.projectid;
    const that = this;
    return this._storageSupport.getTrainingData(projectid).then(trainingitems => {
      const data = {
        projectid,
        trainingdata: trainingitems.map(trainingitem => {
          return {
            metadata: trainingitem,
            imgdata: trainingitem.imagedata
          };
        })
      };
      that.trainNewModel(data, worker);
    });
  }
  trainNewModel(data, worker) {
    const projectid = data.projectid;
    if (this.state !== 'READY') {
      console.log('[mlforkids] ML4KidsImageTraining not ready to train a new ML model - state : ' + this.state);
      return;
    }
    if (this.PROJECTS[projectid].state === 'TRAINING') {
      console.log('[mlforkids] ML4KidsImageTraining training in progress for this model');
      return;
    }
    if (data.trainingdata.length < 5) {
      console.log('[mlforkids] ML4KidsImageTraining insufficient training examples for a new model');
      return;
    }
    console.log('[mlforkids] ML4KidsImageTraining training new model');
    this.PROJECTS[projectid].state = 'TRAINING';
    if (this.PROJECTS[projectid].usingRestoredModel) {
      this.PROJECTS[projectid].transferModel = this.prepareTransferLearningModel(this.PROJECTS[projectid].modelNumClasses);
    }
    const that = this;
    return Promise.all(data.trainingdata.map(this._getTensorForImageData)).then(trainingdata => {
      let xs;
      let ys;
      for (let i = 0; i < trainingdata.length; i++) {
        const trainingdataitem = trainingdata[i];
        const labelIdx = that.PROJECTS[projectid].modelClasses.indexOf(trainingdataitem.metadata.label);
        const xval = that.baseModel.predict(trainingdataitem.data);
        const yval = tf.tidy(function () {
          return tf.oneHot(tf.tensor1d([labelIdx]).toInt(), that.PROJECTS[projectid].modelNumClasses);
        });
        if (i === 0) {
          xs = xval;
          ys = yval;
        } else {
          var oldxs = xs;
          var oldys = ys;
          xs = oldxs.concat(xval, 0);
          ys = oldys.concat(yval, 0);
          oldxs.dispose();
          oldys.dispose();
        }
      }
      let epochs = 10;
      if (trainingdata.length > 100) {
        epochs = 20;
      } else if (trainingdata.length > 50) {
        epochs = 15;
      }
      that._trainTfjsModel(projectid, epochs, xs, ys, worker);
    }).catch(err => {
      console.log('[mlforkids] ML4KidsImageTraining failed to train model', err);
      this.PROJECTS[projectid].state = 'ERROR';
      this.PROJECTS[projectid].usingRestoredModel = false;
      worker.postMessage({
        mlforkidsimage: 'modelfailed',
        data: {
          projectid
        }
      });
    });
  }
  _trainTfjsModel(projectid, epochs, xs, ys, worker) {
    let aborted = false;
    this.PROJECTS[projectid].transferModel.fit(xs, ys, {
      batchSize: 10,
      epochs: epochs,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log('[mlforkids] ML4KidsImageTraining epoch ' + epoch + ' loss ' + logs.loss);
          if (isNaN(logs.loss)) {
            console.log('[ml4kimages] ML4KidsImageTraining aborting training');
            this.PROJECTS[projectid].transferModel.stopTraining = true;
            aborted = true;
          }
        },
        onTrainEnd: () => {
          if (aborted) {
            if (epochs >= 10) {
              // retry with a smaller epoch
              this.PROJECTS[projectid].transferModel = this.prepareTransferLearningModel(this.PROJECTS[projectid].modelNumClasses);
              return this._trainTfjsModel(projectid, epochs > 10 ? 10 : 5, xs, ys, worker);
            } else {
              // already tried with only 5 epochs - give up
              console.log('[mlforkids] ML4KidsImageTraining failed to train model');
              this.PROJECTS[projectid].state = 'ERROR';
              this.PROJECTS[projectid].usingRestoredModel = false;
              worker.postMessage({
                mlforkidsimage: 'modelfailed',
                data: {
                  projectid
                }
              });
              return;
            }
          }
          console.log('[mlforkids] ML4KidsImageTraining training complete');
          this._saveModel(projectid);
          this.PROJECTS[projectid].state = 'TRAINED';
          this.PROJECTS[projectid].usingRestoredModel = false;
          worker.postMessage({
            mlforkidsimage: 'modelready',
            data: {
              projectid
            }
          });
        }
      }
    });
  }
  _getTensorForImageData(_ref) {
    let {
      imgdata,
      metadata
    } = _ref;
    return new Promise((resolve, reject) => {
      var imgDataBlob = URL.createObjectURL(new Blob([imgdata]));
      var hiddenImg = document.createElement('img');
      hiddenImg.width = 224;
      hiddenImg.height = 224;
      hiddenImg.onerror = function (err) {
        console.log('[mlforkids] ML4KidsImageTraining failed to load image', err);
        return reject(err);
      };
      hiddenImg.onload = function () {
        var imageData = tf.tidy(function () {
          return tf.browser.fromPixels(hiddenImg).expandDims(0).toFloat().div(127).sub(1);
        });
        resolve({
          metadata,
          data: imageData
        });
        URL.revokeObjectURL(imgDataBlob);
      };
      hiddenImg.src = imgDataBlob;
    });
  }
}
module.exports = ML4KidsImageTraining;

/***/ }),

/***/ "./src/mlforkids-components/numbers/index.js":
/*!***************************************************!*\
  !*** ./src/mlforkids-components/numbers/index.js ***!
  \***************************************************/
/***/ ((module) => {

class ML4KidsNumbersTraining {
  constructor(storageSupport) {
    this.PROJECTS = {};
    this.state = 'INIT';
    this._storageSupport = storageSupport;
    // this._ydf = null;
  }
  init() {
    if (!this.initPromise) {
      this.initPromise = new Promise((resolve, reject) => {
        return YDFInference().then(ydf => {
          this._ydf = ydf;
          this.state = 'READY';
          resolve();
        }).catch(err => {
          this.state = 'ERROR';
          reject(err);
        });
      });
    }
    return this.initPromise;
  }
  initProject(project, worker) {
    const projectid = project.id.toString();
    this.PROJECTS[projectid] = {
      state: 'INIT',
      project: project
    };
    return this._loadModel(project).then(loaded => {
      if (loaded) {
        this.PROJECTS[projectid].state = 'TRAINED';
        worker.postMessage({
          mlforkidsnumbers: 'modelready',
          data: {
            projectid: projectid
          }
        });
      } else {
        this.PROJECTS[projectid].state = 'READY';
        worker.postMessage({
          mlforkidsnumbers: 'modelinit',
          data: {
            projectid: projectid
          }
        });
      }
      this._watchForNewModels(project.id, worker);
    }).catch(err => {
      console.log('[mlforkids] ML4KidsNumbersTraining failed init', err);
      this.PROJECTS[projectid].state = 'ERROR';
      worker.postMessage({
        mlforkidsnumbers: 'modelfailed',
        data: {
          projectid: projectid
        }
      });
    });
  }

  // TODO remove?
  // _getModelDbLocation (projectid) {
  //     return 'indexeddb://ml4k-models-numbers-' + projectid.toString().replaceAll('-', '');
  // }

  _getFromStorageAsJson(key) {
    const value = this._storageSupport.getFromLocalStorage(key);
    if (!value) {
      throw new Error('Missing data ' + key);
    }
    return JSON.parse(value);
  }
  _loadModel(project) {
    console.log('[mlforkids] ML4KidsNumbersTraining loading model zip from browser storage');
    var loaded = false;
    return this._storageSupport.retrieveAsset(project.id + '-model').then(modelzip => {
      return this._ydf.loadModelFromZipBlob(modelzip);
    }).then(ydfmodel => {
      this.PROJECTS[project.id].model = ydfmodel;
      const modelid = project.id;
      this.PROJECTS[project.id].features = this._getFromStorageAsJson('ml4k-models-numbers-' + modelid + '-features');
      this.PROJECTS[project.id].labels = this._getFromStorageAsJson('ml4k-models-numbers-' + modelid + '-labels');
      loaded = true;
      return loaded;
    }).catch(err => {
      console.log('[mlforkids] ML4KidsNumbersTraining failed to load model from storage', err);
      return loaded;
    });
  }
  trainNewModel(request, worker) {
    console.log('[mlforkids] new model request', request);
    const projectid = request.projectid;
    this.PROJECTS[projectid].state = 'TRAINING';
    const options = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: '{}'
    };
    return fetch(request.modelurl, options).then(resp => {
      return resp.json();
    }).then(response => {
      this.PROJECTS[projectid].details = response;
      if (response.status === 'Training') {
        this._scheduleModelStatusCheck(projectid, response, worker);
      } else if (response.status === 'Failed') {
        console.log('[mlforkids] model training failed', response);
        if (response.error && response.error.message === 'More training data needed to train a model') {
          // no training data for a model - let the scratch extension know
          worker.postMessage({
            mlforkidsnumbers: 'modelinit',
            data: {
              projectid: projectid,
              reason: 'no training data'
            }
          });
          return;
        } else {
          worker.postMessage({
            mlforkidsnumbers: 'modelfailed',
            data: {
              projectid: projectid
            }
          });
        }
      }
    }).catch(err => {
      console.log('[mlforkids] model training failed', err);
      worker.postMessage({
        mlforkidsnumbers: 'modelfailed',
        data: {
          projectid: projectid
        }
      });
    });
  }
  trainNewModelLocal(request, worker) {
    console.log('[mlforkids] new model request', request);
    const projectid = request.projectid;
    this.PROJECTS[projectid].state = 'TRAINING';
    return this._storageSupport.getTrainingData(projectid).then(training => {
      if (training.length === 0) {
        // no training - nothing we can do now - let the scratch extension know
        worker.postMessage({
          mlforkidsnumbers: 'modelinit',
          data: {
            projectid: projectid,
            reason: 'no training data'
          }
        });
        return;
      }
      const options = {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          project: this.PROJECTS[projectid].project,
          training: training,
          type: 'numbers'
        })
      };
      return fetch(request.modelurl, options);
    }).then(resp => {
      if (resp) {
        return resp.json();
      }
    }).then(response => {
      if (response) {
        this.PROJECTS[projectid].details = response;
        if (response.status === 'Training') {
          this._scheduleModelStatusCheck(projectid, response, worker);
        } else if (response.status === 'Failed') {
          console.log('[mlforkids] model training failed', response);
          if (response.error && response.error.message === 'More training data needed to train a model') {
            // no training - nothing we can do now - let the scratch extension know
            worker.postMessage({
              mlforkidsnumbers: 'modelinit',
              data: {
                projectid: projectid,
                reason: 'no training data'
              }
            });
            return;
          } else {
            worker.postMessage({
              mlforkidsnumbers: 'modelfailed',
              data: {
                projectid: projectid
              }
            });
          }
        }
      }
    }).catch(err => {
      console.log('[mlforkids] model training failed', err);
      worker.postMessage({
        mlforkidsnumbers: 'modelfailed',
        data: {
          projectid: projectid
        }
      });
    });
  }
  _scheduleModelStatusCheck(projectid, modelinfo, worker) {
    setTimeout(() => {
      this._checkModelStatus(projectid, modelinfo, worker);
    }, 4000);
  }
  _checkModelStatus(projectid, modelinfo, worker) {
    console.log('[mlforkids] checking model status');
    return fetch(modelinfo.urls.status).then(r => {
      return r.json();
    }).then(newstatus => {
      if (newstatus.status === 'Training') {
        console.log('[mlforkids] model still training');
        this._scheduleModelStatusCheck(projectid, newstatus, worker);
      } else if (newstatus.status === 'Available') {
        this._storeModelForLocalReuse(projectid, newstatus, worker);
      } else {
        console.log('[mlforkids] model server reports training failed', newstatus);
        this.PROJECTS[projectid].state = 'ERROR';
        worker.postMessage({
          mlforkidsnumbers: 'modelfailed',
          data: {
            projectid: projectid
          }
        });
      }
    }).catch(err => {
      console.log('[mlforkids] failed to check model status', err);
      this.PROJECTS[projectid].state = 'ERROR';
      worker.postMessage({
        mlforkidsnumbers: 'modelfailed',
        data: {
          projectid: projectid
        }
      });
    });
  }
  _storeModelForLocalReuse(projectid, modelinfo, worker) {
    console.log('[mlforkids] downloading ydf model');
    this._storageSupport.storeAsset(projectid + '-model', modelinfo.urls.model).then(() => {
      console.log('[mlforkids] downloading visualisation');
      return this._storageSupport.storeAsset(projectid + '-tree', modelinfo.urls.tree).then(() => {
        return this._storageSupport.storeAsset(projectid + '-dot', modelinfo.urls.dot);
      }).then(() => {
        return this._storageSupport.storeAsset(projectid + '-vocab', modelinfo.urls.vocab);
      }).catch(err => {
        console.log('[mlforkids] failed to download visualisation', err);
      });
    }).then(() => {
      console.log('[mlforkids] retrieving model from storage');
      return this._storageSupport.retrieveAsset(projectid + '-model');
    }).then(modelzip => {
      console.log('[mlforkids] opening model');
      return this._ydf.loadModelFromZipBlob(modelzip);
    }).then(ydfmodel => {
      if (this.PROJECTS[projectid].model) {
        this.PROJECTS[projectid].model.unload();
      }
      this.PROJECTS[projectid].model = ydfmodel;
      console.log('[mlforkids] saving model info');
      window.localStorage.setItem('ml4k-models-numbers-' + projectid + '-features', JSON.stringify(modelinfo.features));
      window.localStorage.setItem('ml4k-models-numbers-' + projectid + '-labels', JSON.stringify(modelinfo.labels));
      window.localStorage.setItem('ml4k-models-numbers-' + projectid + '-status', modelinfo.urls.status);
      window.localStorage.setItem('ml4k-models-numbers-' + projectid + '-date', Date.now());
      this.PROJECTS[projectid].features = modelinfo.features;
      this.PROJECTS[projectid].labels = modelinfo.labels;
    }).then(() => {
      this.PROJECTS[projectid].state = 'TRAINED';
      worker.postMessage({
        mlforkidsnumbers: 'modelready',
        data: {
          projectid: projectid
        }
      });
    }).catch(err => {
      console.log('[mlforkids] model storing failed', err);
      if (err.message && err.message.includes('BlobURLs are not yet supported')) {
        console.log('[mlforkids] UNABLE TO STORE MODEL');
        this.PROJECTS[projectid].state = 'TRAINED';
        worker.postMessage({
          mlforkidsnumbers: 'modelready',
          data: {
            projectid: projectid
          }
        });
      } else {
        worker.postMessage({
          mlforkidsnumbers: 'modelfailed',
          data: {
            projectid: projectid
          }
        });
      }
    });
  }

  // deleteModel (projectid) {
  //     this.PROJECTS[projectid].state = 'READY';
  //     delete this.PROJECTS[projectid].features;
  //     delete this.PROJECTS[projectid].labels;
  //     delete this.PROJECTS[projectid].model;
  //     // TODO delete stored model
  //     return Promise.resolve();
  // }

  classifyNumberData(request, worker) {
    const projectid = request.projectid;
    const numberdata = request.numbers;
    const requestid = request.requestid;
    const testdata = {};
    try {
      for (const key of Object.keys(numberdata)) {
        const feature = this.PROJECTS[projectid].features[key];
        if (feature) {
          if (feature.type.includes('int')) {
            testdata[feature.name] = [parseInt(numberdata[key])];
          } else if (feature.type.includes('float')) {
            testdata[feature.name] = [parseFloat(numberdata[key])];
          } else {
            testdata[feature.name] = [numberdata[key]];
          }
        }
      }
    } catch (err) {
      console.error('[mlforkids] unable to prepare data for classifying', err);
      return;
    }
    const output = this.PROJECTS[projectid].model.predict(testdata);
    if (this.PROJECTS[projectid].labels.length === 2) {
      const result = [{
        class_name: this.PROJECTS[projectid].labels[0],
        confidence: (1 - output[0]) * 100
      }, {
        class_name: this.PROJECTS[projectid].labels[1],
        confidence: output[0] * 100
      }].sort(this._sortByConfidence);
      worker.postMessage({
        mlforkidsnumbers: 'classifyresponse',
        data: {
          projectid,
          requestid,
          result
        }
      });
    } else if (this.PROJECTS[projectid].labels.length === output.length) {
      const result = this.PROJECTS[projectid].labels.map((label, idx) => {
        return {
          class_name: label,
          confidence: output[idx] * 100
        };
      }).sort(this._sortByConfidence);
      worker.postMessage({
        mlforkidsnumbers: 'classifyresponse',
        data: {
          projectid,
          requestid,
          result
        }
      });
    } else {
      console.error('[ml4knums] unexpected model response', output);
      this.PROJECTS[projectid].state = 'ERROR';
      worker.postMessage({
        mlforkidsnumbers: 'modelfailed',
        data: {
          projectid: projectid
        }
      });
    }
  }
  _watchForNewModels(projectid, worker) {
    if (!this.PROJECTS[projectid].modelWatcher) {
      console.log('[mlforkids] ML4KidsNumbersTraining listening for model updates', projectid);
      this.PROJECTS[projectid].modelWatcher = true;
      const modellocation = 'ml4k-models-numbers-' + projectid + '-date';
      this._storageSupport.registerForModelStorageUpdates(modellocation, () => {
        console.log('[mlforkids] ML4KidsNumbersTraining new model was trained');
        this.PROJECTS[projectid].state = 'TRAINING'; // loading saved model
        this._loadModel({
          id: projectid
        }).then(loaded => {
          if (loaded) {
            console.log('[mlforkids] ML4KidsNumbersTraining model loaded');
            this.PROJECTS[projectid].state = 'TRAINED';
            worker.postMessage({
              mlforkidsnumbers: 'modelready',
              data: {
                projectid: projectid
              }
            });
          } else {
            console.log('[mlforkids] ML4KidsNumbersTraining no model - model deleted');
            this.PROJECTS[projectid].state = 'READY';
            worker.postMessage({
              mlforkidsnumbers: 'modelinit',
              data: {
                projectid: projectid,
                reason: 'model deleted'
              }
            });
          }
        }).catch(() => {
          console.log('[mlforkids] ML4KidsNumbersTraining unexpected loading error');
          this.PROJECTS[projectid].state = 'ERROR';
          worker.postMessage({
            mlforkidsnumbers: 'modelfailed',
            data: {
              projectid: projectid
            }
          });
        });
      });
    }
  }
  _sortByConfidence(a, b) {
    if (a.confidence < b.confidence) {
      return 1;
    } else if (a.confidence > b.confidence) {
      return -1;
    } else {
      return 0;
    }
  }
}
module.exports = ML4KidsNumbersTraining;

/***/ }),

/***/ "./src/mlforkids-components/regression/index.js":
/*!******************************************************!*\
  !*** ./src/mlforkids-components/regression/index.js ***!
  \******************************************************/
/***/ ((module) => {

class ML4KidsRegressionTraining {
  constructor(storageSupport) {
    this.PROJECTS = {};
    this.state = 'INIT';
    this._storageSupport = storageSupport;
  }
  init() {
    if (!this.initPromise) {
      this.initPromise = new Promise(resolve => {
        tf.enableProdMode();
        this.state = 'READY';
        resolve();
      });
    }
    return this.initPromise;
  }
  initProject(project, worker) {
    this.PROJECTS[project.id] = {
      state: 'INIT',
      project: project
    };
    return this._loadModel(project.id).then(loaded => {
      if (loaded) {
        this.PROJECTS[project.id].state = 'TRAINED';
        worker.postMessage({
          mlforkidsregression: 'modelready',
          data: {
            projectid: project.id
          }
        });
      } else {
        this.PROJECTS[project.id].state = 'READY';
        worker.postMessage({
          mlforkidsregression: 'modelinit',
          data: {
            projectid: project.id
          }
        });
      }
      this._watchForNewModels(project.id, worker);
    }).catch(err => {
      console.log('[mlforkids] ML4KidsRegressionTraining failed init', err);
      this.PROJECTS[projectid].state = 'ERROR';
      worker.postMessage({
        mlforkidsregression: 'modelfailed',
        data: {
          projectid: project.id
        }
      });
    });
  }
  trainNewModel(projectid, worker) {
    if (this.PROJECTS[projectid].state === 'TRAINING') {
      console.log('[mlforkids] ML4KidsRegressionTraining training in progress for this model');
      return;
    }
    console.log('[mlforkids] ML4KidsRegressionTraining training new model');
    this.PROJECTS[projectid].state = 'TRAINING';
    const that = this;
    return this._storageSupport.getTrainingData(projectid).then(training => {
      const project = that.PROJECTS[projectid].project;

      // separate out columns into input and output values
      const inputColumns = project.columns.filter(function (col) {
        return col.output === false;
      }).map(function (col) {
        return col.label;
      });
      const targetColumns = project.columns.filter(function (col) {
        return col.output === true;
      }).map(function (col) {
        return col.label;
      });

      // turn array of JSON objects into array of raw numbers
      const inputFeatures = [];
      const targetFeatures = [];
      for (let i = 0; i < training.length; i++) {
        const trainingitem = training[i];
        let skip = false;
        const inputFeature = inputColumns.map(function (col) {
          const num = trainingitem[col];
          if (isNaN(num)) {
            skip = true;
          }
          return num;
        });
        const targetFeature = targetColumns.map(function (col) {
          const num = trainingitem[col];
          if (isNaN(num)) {
            skip = true;
          }
          return num;
        });
        if (skip) {
          console.log('[mlforkids] skipping non-numeric training data', trainingitem);
        } else {
          inputFeatures.push(inputFeature);
          targetFeatures.push(targetFeature);
        }
      }

      // normalize the input
      const inputFeaturesTensor = tf.tensor2d(inputFeatures);
      const mean = inputFeaturesTensor.mean(0);
      const standardDeviation = inputFeaturesTensor.sub(mean).square().mean(0).sqrt();
      that.PROJECTS[projectid].normalization = {
        mean,
        standardDeviation
      };
      const normalisedInputFeatures = inputFeaturesTensor.sub(that.PROJECTS[projectid].normalization.mean).div(that.PROJECTS[projectid].normalization.standardDeviation);

      // store the normalization
      that._storageSupport.addMetadataToProject(projectid, 'normalization', {
        mean: that.PROJECTS[projectid].normalization.mean.arraySync(),
        standardDeviation: that.PROJECTS[projectid].normalization.standardDeviation.arraySync()
      });

      // create the model
      that.PROJECTS[projectid].model = that._defineModel(inputColumns.length, targetColumns.length);

      // train the model
      that.PROJECTS[projectid].model.fit(normalisedInputFeatures, tf.tensor2d(targetFeatures), {
        batchSize: 40,
        epochs: 200,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log('[mlforkids] ML4KidsRegressionTraining epoch ' + epoch + ' loss ' + logs.loss);
          },
          onTrainEnd: function onTrainEnd() {
            console.log('[mlforkids] ML4KidsRegressionTraining training complete');
            that._saveModel(projectid);
            that.PROJECTS[projectid].state = 'TRAINED';
            worker.postMessage({
              mlforkidsregression: 'modelready',
              data: {
                projectid
              }
            });
          }
        }
      });
    }).catch(err => {
      console.log('[mlforkids] ML4KidsRegressionTraining failed to train model', err);
      this.PROJECTS[projectid].state = 'ERROR';
      worker.postMessage({
        mlforkidsregression: 'modelfailed',
        data: {
          projectid
        }
      });
    });
  }
  predict(requestdata, worker) {
    const requestid = requestdata.requestid;
    const projectid = requestdata.projectid;
    const project = this.PROJECTS[projectid].project;
    const normalization = this.PROJECTS[projectid].normalization;
    const testdata = requestdata.data;
    var testTensor = tf.tidy(function () {
      const inputValues = project.columns.filter(function (col) {
        return col.output === false;
      }).map(function (col) {
        return testdata[col.label];
      });
      const inputTensor = tf.tensor2d([inputValues]);
      const normalisedInputValues = inputTensor.sub(normalization.mean).div(normalization.standardDeviation);
      return normalisedInputValues;
    });
    var modelOutput = this.PROJECTS[projectid].model.predict(testTensor);
    modelOutput.data().then(function (output) {
      const targetColumns = project.columns.filter(function (col) {
        return col.output === true;
      });
      if (output.length !== targetColumns.length) {
        loggerService.error('[ml4kregress] unexpected output from model', output);
        throw new Error('Unexpected output from model');
      }
      var labelledOutput = {};
      targetColumns.forEach(function (col, idx) {
        labelledOutput[col.label] = output[idx];
      });
      worker.postMessage({
        mlforkidsregression: 'classifyresponse',
        data: {
          projectid: projectid,
          requestid: requestid,
          prediction: labelledOutput
        }
      });
    }).catch(function (err) {
      console.log('[mlforkids] ML4KidsRegressionTraining failed to run test', err);
      // TODO
    });
  }
  _defineModel(numInputFeatures, numOutputLabels) {
    const regressionModel = tf.sequential();
    regressionModel.add(tf.layers.dense({
      inputShape: [numInputFeatures],
      units: 50,
      activation: 'sigmoid',
      kernelInitializer: 'leCunNormal'
    }));
    regressionModel.add(tf.layers.dense({
      units: 50,
      activation: 'sigmoid',
      kernelInitializer: 'leCunNormal'
    }));
    regressionModel.add(tf.layers.dense({
      units: numOutputLabels
    }));
    regressionModel.compile({
      optimizer: tf.train.sgd(0.01),
      loss: 'meanSquaredError'
    });
    return regressionModel;
  }
  _getModelDbLocation(projectid) {
    return 'indexeddb://ml4k-models-regression-' + projectid.toString().replaceAll('-', '');
  }
  _loadModel(projectid) {
    console.log('[mlforkids] ML4KidsRegressionTraining loading model from browser storage');
    var loaded = false;
    if (this.PROJECTS[projectid].project.normalization) {
      const savelocation = this._getModelDbLocation(projectid);
      return tf.loadLayersModel(savelocation).then(storedModelInfo => {
        // TODO compare model with project info to check size is consistent
        if (storedModelInfo) {
          this.PROJECTS[projectid].normalization = {
            mean: tf.tensor(this.PROJECTS[projectid].project.normalization.mean),
            standardDeviation: tf.tensor(this.PROJECTS[projectid].project.normalization.standardDeviation)
          };
          this.PROJECTS[projectid].model = storedModelInfo;
          loaded = true;
        }
        return loaded;
      }).catch(err => {
        console.log('[mlforkids] ML4KidsRegressionTraining failed to load model from storage', err);
        return loaded;
      });
    } else {
      console.log('[mlforkids] ML4KidsRegressionTraining no stored normalization data - cannot use a loaded model');
      return Promise.resolve(loaded);
    }
  }
  _saveModel(projectid) {
    console.log('[mlforkids] ML4KidsRegressionTraining saving model to browser storage');
    const savelocation = this._getModelDbLocation(projectid);
    return this.PROJECTS[projectid].model.save(savelocation).then(results => {
      console.log('[mlforkids] ML4KidsRegressionTraining saved model', savelocation, results);
    }).catch(err => {
      console.log('[mlforkids] ML4KidsRegressionTraining failed to save model', err);
    });
  }
  _watchForNewModels(projectid, worker) {
    if (!this.PROJECTS[projectid].modelWatcher) {
      console.log('[mlforkids] ML4KidsRegressionTraining listening for model updates', projectid);
      this.PROJECTS[projectid].modelWatcher = true;
      const modellocation = this._getModelDbLocation(projectid);
      this._storageSupport.registerForModelStorageUpdates(modellocation, () => {
        console.log('[mlforkids] ML4KidsRegressionTraining new model was trained');
        this.trainNewModel(projectid, worker);
      });
    }
  }
}
module.exports = ML4KidsRegressionTraining;

/***/ }),

/***/ "./src/mlforkids-components/sound/index.js":
/*!*************************************************!*\
  !*** ./src/mlforkids-components/sound/index.js ***!
  \*************************************************/
/***/ ((module) => {

class ML4KidsSoundTraining {
  // states:
  //   INIT - not ready yet
  //   READY - ready for training
  //   TRAINING - training in progress
  //   TRAINED - ML model ready for use
  //   LISTENING - ML model being used
  //   ERROR - something went wrong

  constructor(storageSupport) {
    this.state = 'INIT';
    this.usingRestoredModel = false;
    this._storageSupport = storageSupport;
  }
  init(encprojectdata, worker) {
    // TODO this will break if there are multiple sound extensions open in Scratch - use multi-project approach from image-support class

    if (typeof encprojectdata === 'string') {
      if (encprojectdata[0] === '{') {
        // additional info for using indexeddb to store/load models
        const projectData = JSON.parse(encprojectdata);
        this.mlprojectid = projectData.projectid;
        this.mlprojectlabels = projectData.labels;
        if (!projectData.labels.includes('_background_noise_')) {
          this.mlprojectlabels.unshift('_background_noise_');
        }
      } else {
        // project id only means new models can be created only
        this.mlprojectid = encprojectdata;
      }
    } else {
      // additional info for using indexeddb to store/load models
      this.mlprojectid = encprojectdata.projectid;
      this.mlprojectlabels = encprojectdata.labels;
      if (!encprojectdata.labels.includes('_background_noise_')) {
        this.mlprojectlabels.unshift('_background_noise_');
      }
    }
    tf.enableProdMode();
    window.addEventListener('mlforkids-runtime-project-stop-all', () => {
      this.stopListening(worker);
    });
    return this.loadSpeechCommands().then(() => {
      return this.initSoundSupport(true, worker);
      // })
      // .then(() => {
      //     this._watchForNewModels(this.mlprojectid);
    });
  }
  loadSpeechCommands() {
    const scriptid = 'mlforkids-script-speechcommands';
    const scripturl = 'https://machinelearningforkids.co.uk' + '/static/bower_components' + '/tensorflow-models/speech-commands-scratch' + '/speech-commands.min.js?v=118';
    return new Promise((resolve, reject) => {
      if (document.getElementById(scriptid)) {
        return resolve();
      } else {
        const scriptObj = document.createElement('script');
        scriptObj.id = scriptid;
        scriptObj.type = 'text/javascript';
        scriptObj.src = scripturl;
        scriptObj.onload = resolve;
        scriptObj.onError = reject;
        document.head.appendChild(scriptObj);
      }
    });
  }
  prepareSoundService(worker) {
    if (this.usingRestoredModel) {
      // models restored from indexeddb don't have the base layers needed
      //  to train a new model, so we need to start from scratch
      console.log('[mlforkids] Setting up new transfer learning model');
      return this.initSoundSupport(false, worker);
    } else {
      // we aren't using a model restored from indexeddb so we should
      //  have everything we need already in place to train a new model
      return Promise.resolve();
    }
  }
  initSoundSupport(loadModelIfAvailable, worker) {
    const siteUrl = 'https://machinelearningforkids.co.uk' + '/static/bower_components' + '/tensorflow-models/speech-commands-scratch';
    const vocab = null;
    const modelJson = siteUrl + '/model.json';
    const metadataJson = siteUrl + '/metadata.json';
    console.log('[mlforkids] Creating base recognizer');
    const baseRecognizer = speechCommands.create('BROWSER_FFT', vocab, modelJson, metadataJson);
    return baseRecognizer.ensureModelLoaded().then(() => {
      console.log('[mlforkids] Creating transfer learning model');
      this.transferRecognizer = baseRecognizer.createTransfer('project-' + this.mlprojectid);
      const modelInfo = this.transferRecognizer.modelInputShape();
      this.transferModelInfo = {
        numFrames: modelInfo[1],
        fftSize: modelInfo[2]
      };
      if (loadModelIfAvailable) {
        return this._loadModel(this.mlprojectid, this.mlprojectlabels, worker);
      }
    }).catch(err => {
      console.log('[mlforkids] ML4KidsSoundTraining failed init', err);
      this.state = 'ERROR';
      if (worker) {
        worker.postMessage({
          mlforkidssound: 'modelfailed'
        });
      }
    });
  }
  trainNewModelLocal(projectinfo, worker) {
    const projectid = projectinfo.projectid;
    const that = this;
    return this._storageSupport.getTrainingData(projectid).then(data => {
      return that.trainNewModel(data, worker);
    });
  }
  trainNewModel(data, worker) {
    if (this.state === 'LISTENING') {
      this.stopListening();
    }
    if (this.state !== 'READY' && this.state !== 'TRAINED') {
      console.log('[mlforkids] ML4KidsSoundTraining not ready to train a new ML model - state : ' + this.state);
      return;
    }
    this.state = 'TRAINING';
    return this.prepareSoundService(worker).then(() => {
      this.transferRecognizer.dataset.clear();
      this.transferRecognizer.dataset.label2Ids = {};
      this.transferRecognizer.words = null;
      for (var i = 0; i < data.length; i++) {
        var trainingdataitem = data[i];
        this.transferRecognizer.dataset.addExample({
          label: trainingdataitem.label,
          spectrogram: {
            frameSize: this.transferModelInfo.fftSize,
            data: new Float32Array(trainingdataitem.audiodata)
          }
        });
      }
      this.transferRecognizer.collateTransferWords();
      return tf.nextFrame();
    }).then(() => {
      return this.transferRecognizer.train({
        epochs: 100
      });
    }).then(() => {
      this.state = 'TRAINED';
      this.usingRestoredModel = false;
      return this._saveModel(this.mlprojectid);
    }).then(() => {
      worker.postMessage({
        mlforkidssound: 'modelready'
      });
    }).catch(err => {
      this.state = 'ERROR';
      worker.postMessage({
        mlforkidssound: 'modelfailed'
      });
      console.log('[mlforkids] ML4KidsSoundTraining model training failed');
      console.log(err);
    });
  }
  startListening(worker) {
    if (this.state !== 'TRAINED') {
      console.log('[mlforkids] ML4KidsSoundTraining not ready to listen - state : ' + this.state);
      return;
    }
    console.log('[mlforkids] startListening');
    try {
      var that = this;
      this.transferRecognizer.listen(result => {
        var matches = [];
        var labels = that.transferRecognizer.wordLabels();
        for (var i = 0; i < result.scores.length; i++) {
          matches.push({
            class_name: labels[i],
            confidence: result.scores[i] * 100
          });
        }
        matches.sort((a, b) => {
          return b.confidence - a.confidence;
        });
        worker.postMessage({
          mlforkidssound: 'recognized',
          data: matches
        });
      }, {
        probabilityThreshold: 0.70
      });
      this.state = 'LISTENING';
    } catch (err) {
      this.state = 'ERROR';
      console.log('[mlforkids] ML4KidsSoundTraining failed to start listening');
      console.log(err);
    }
  }
  stopListening(worker) {
    if (this.state !== 'LISTENING') {
      console.log('[mlforkids] ML4KidsSoundTraining not listening - state : ' + this.state);
      return;
    }
    console.log('[mlforkids] stopListening');
    try {
      this.transferRecognizer.stopListening();
      this.state = 'TRAINED';
      worker.postMessage({
        mlforkidssound: 'stopped'
      });
    } catch (err) {
      this.state = 'ERROR';
      console.log('[mlforkids] ML4KidsSoundTraining failed to start listening');
      console.log(err);
    }
  }
  _getModelDbLocation(projectid) {
    return 'indexeddb://ml4k-models-sounds-' + projectid.toString().replaceAll('-', '');
  }
  _saveModel(projectid) {
    console.log('[mlforkids] ML4KidsSoundTraining saving model to browser storage');
    var savelocation = this._getModelDbLocation(projectid);
    this.transferRecognizer.save(savelocation).then(r => {
      console.log('[mlforkids] ML4KidsSoundTraining saved model', r);
      this._storeModelSavedDate(savelocation);
    }).catch(err => {
      console.log('[mlforkids] ML4KidsSoundTraining failed to save model', err);
    });
  }
  _storeModelSavedDate(modelid) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(modelid, Date.now());
      }
    } catch (err) {
      console.log('[mlforkids] ML4KidsSoundTraining unable to save model date');
    }
  }
  _loadModel(projectid, labels, worker) {
    if (labels) {
      console.log('[mlforkids] ML4KidsSoundTraining loading model from browser storage');
      var savelocation = this._getModelDbLocation(projectid);
      return this.transferRecognizer.load(savelocation).then(() => {
        this.transferRecognizer.words = Array.from(labels).sort();
        console.log('[mlforkids] ML4KidsSoundTraining loaded model from storage');
        this.state = 'TRAINED';
        this.usingRestoredModel = true;
        if (worker) {
          worker.postMessage({
            mlforkidssound: 'modelready'
          });
        }
      }).catch(err => {
        console.log('[mlforkids] ML4KidsSoundTraining failed to load model from storage', err);
        this.state = 'READY';
        if (worker) {
          worker.postMessage({
            mlforkidssound: 'modelinit'
          });
        }
      });
    } else {
      console.log('[mlforkids] ML4KidsSoundTraining unable to restore model from storage');
      this.state = 'READY';
    }
  }

  // TODO - too risky for now... need to consider things like:
  //   - what if the transferRecognizer is currently listening? do we need to stop listening first? notify extensions?
  // _watchForNewModels (projectid) {
  //     if (!this.modelWatcher) {
  //         console.log('[mlforkids] ML4KidsSoundTraining listening for model updates', projectid);
  //         this.modelWatcher = true;
  //
  //         const modellocation = this._getModelDbLocation(projectid);
  //         window.addEventListener('storage', (evt) => {
  //             if (evt.key === modellocation) {
  //                 console.log('[mlforkids] ML4KidsSoundTraining new model is available');
  //                 return this._loadModel(projectid, this.mlprojectlabels);
  //             }
  //         });
  //     }
  // }
}
module.exports = ML4KidsSoundTraining;

/***/ }),

/***/ "./src/mlforkids-components/storage/index.js":
/*!***************************************************!*\
  !*** ./src/mlforkids-components/storage/index.js ***!
  \***************************************************/
/***/ ((module) => {

class ML4KidsLocalStorage {
  constructor() {
    // this.projectsDbHandle;
    this.PROJECTS_DB_NAME = 'mlforkidsLocalProjects';
    this.PROJECTS_TABLE = 'projects';
    this.trainingDataDatabases = {};
    this.TRAINING_DB_NAME_PREFIX = 'mlforkidsProject';
    this.TRAINING_TABLE = 'training';

    // this.assetsDbHandle;
    this.ASSETS_DB_NAME = 'mlforkidsAssets';
    this.ASSETS_TABLE = 'assets';
  }

  //-----------------------------------------------------------
  //  common functions
  //-----------------------------------------------------------

  promisifyIndexedDbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = resolve;
      request.onerror = reject;
    });
  }
  initProjectsDatabase(event) {
    console.log('[ml4kstorage] initProjectsDatabase');
    event.target.result.createObjectStore(this.PROJECTS_TABLE, {
      keyPath: 'id',
      autoIncrement: true
    });
  }
  initTrainingDatabase(event) {
    console.log('[ml4kstorage] initTrainingDatabase');
    const table = event.target.result.createObjectStore(this.TRAINING_TABLE, {
      keyPath: 'id',
      autoIncrement: true
    });
    table.createIndex('label', 'label', {
      unique: false
    });
  }
  initAssetsDatabase(event) {
    console.log('[ml4kstorage] initAssetsDatabase');
    event.target.result.createObjectStore(this.ASSETS_TABLE);
  }
  getProjectsDatabase() {
    console.log('[ml4kstorage] getProjectsDatabase');
    const request = window.indexedDB.open(this.PROJECTS_DB_NAME);
    request.onupgradeneeded = this.initProjectsDatabase;
    return this.promisifyIndexedDbRequest(request).then(event => {
      return event.target.result;
    });
  }
  getTrainingDatabase(projectId) {
    console.log('[ml4kstorage] getTrainingDatabase');
    const request = window.indexedDB.open(this.TRAINING_DB_NAME_PREFIX + projectId);
    request.onupgradeneeded = this.initTrainingDatabase;
    return this.promisifyIndexedDbRequest(request).then(event => {
      return event.target.result;
    });
  }
  getAssetsDatabase() {
    console.log('[ml4kstorage] getAssetsDatabase');
    const request = window.indexedDB.open(this.ASSETS_DB_NAME);
    request.onupgradeneeded = this.initAssetsDatabase;
    return this.promisifyIndexedDbRequest(request).then(event => {
      return event.target.result;
    });
  }
  async requiresProjectsDatabase() {
    if (!this.projectsDbHandle) {
      this.projectsDbHandle = await this.getProjectsDatabase();
      this.projectsDbHandle.onclose = () => {
        console.log('[ml4kstorage] projects database closed');
        delete this.projectsDbHandle;
      };
      this.projectsDbHandle.onversionchange = () => {
        console.log('[ml4kstorage] external change to projects database');
        if (this.projectsDbHandle) {
          this.projectsDbHandle.close();
          delete this.projectsDbHandle;
        }
      };
    }
  }
  async requiresTrainingDatabase(projectId) {
    if (!this.trainingDataDatabases[projectId]) {
      this.trainingDataDatabases[projectId] = await this.getTrainingDatabase(projectId);
      this.trainingDataDatabases[projectId].onclose = () => {
        console.log('[ml4kstorage] training database closed', projectId);
        delete this.trainingDataDatabases[projectId];
      };
      this.trainingDataDatabases[projectId].onversionchange = () => {
        console.log('[ml4kstorage] external change to training database');
        if (this.trainingDataDatabases[projectId]) {
          this.trainingDataDatabases[projectId].close();
          delete this.trainingDataDatabases[projectId];
        }
      };
    }
  }
  async requiresAssetsDatabase() {
    if (!this.assetsDbHandle) {
      this.assetsDbHandle = await this.getAssetsDatabase();
      this.assetsDbHandle.onclose = () => {
        console.log('[ml4kstorage] assets database closed');
        delete this.assetsDbHandle;
      };
      this.assetsDbHandle.onversionchange = () => {
        console.log('[ml4kstorage] external change to assets database');
        if (this.assetsDbHandle) {
          this.assetsDbHandle.close();
          delete this.assetsDbHandle;
        }
      };
    }
  }
  requiresResult(event) {
    if (event && event.target && event.target.result) {
      return event.target.result;
    }
    const notFoundErr = new Error('not found');
    notFoundErr.status = 404;
    notFoundErr.data = {
      error: 'not found'
    };
    throw notFoundErr;
  }
  requiresIntegerId(id) {
    return parseInt(id, 10);
  }

  //-----------------------------------------------------------
  //  PROJECTS database
  //-----------------------------------------------------------

  async getProject(projectId) {
    console.log('[ml4kstorage] getProject', projectId);
    await this.requiresProjectsDatabase();
    const transaction = this.projectsDbHandle.transaction([this.PROJECTS_TABLE], 'readonly');
    const request = transaction.objectStore(this.PROJECTS_TABLE).get(this.requiresIntegerId(projectId));
    return this.promisifyIndexedDbRequest(request).then(event => {
      return this.requiresResult(event);
    });
  }
  async addMetadataToProject(projectid, key, value) {
    console.log('[ml4kstorage] addMetadataToProject');
    await this.requiresProjectsDatabase();
    const transaction = this.projectsDbHandle.transaction([this.PROJECTS_TABLE], 'readwrite');
    const projectsTable = transaction.objectStore(this.PROJECTS_TABLE);
    const readRequest = projectsTable.get(this.requiresIntegerId(projectid));
    const readEvent = await this.promisifyIndexedDbRequest(readRequest);
    const projectObject = this.requiresResult(readEvent);
    projectObject[key] = value;
    const updateRequest = projectsTable.put(projectObject);
    await this.promisifyIndexedDbRequest(updateRequest);
    return projectObject;
  }

  //-----------------------------------------------------------
  //  TRAINING DATA store
  //-----------------------------------------------------------

  async getTrainingData(projectId) {
    console.log('[ml4kstorage] getTrainingData', projectId);
    await this.requiresTrainingDatabase(projectId);
    const transaction = this.trainingDataDatabases[projectId].transaction([this.TRAINING_TABLE], 'readonly');
    const request = transaction.objectStore(this.TRAINING_TABLE).getAll();
    return this.promisifyIndexedDbRequest(request).then(event => {
      return event.target.result;
    });
  }
  async addTrainingData(projectId, trainingObject) {
    console.log('[ml4kstorage] addTrainingData');
    await this.requiresTrainingDatabase(projectId);
    const transaction = this.trainingDataDatabases[projectId].transaction([this.TRAINING_TABLE], 'readwrite');
    const request = transaction.objectStore(this.TRAINING_TABLE).add(trainingObject);
    return this.promisifyIndexedDbRequest(request).then(event => {
      trainingObject.id = event.target.result;
      if (trainingObject.label) {
        this.addLabel(projectId, trainingObject.label);
      }
      return trainingObject;
    });
  }

  // update labels to meet WA requirements
  sanitizeLabel(proposedlabel) {
    return proposedlabel.replace(/[^\w.]/g, '_').substring(0, 30);
  }
  async addLabel(projectId, newlabel) {
    console.log('[ml4kstorage] addLabel');
    await this.requiresProjectsDatabase();
    let label = newlabel;
    try {
      label = this.sanitizeLabel(newlabel);
    } catch (labelErr) {
      console.error('[ml4kstorage] Failed to sanitize label, leaving as-is');
    }
    const transaction = this.projectsDbHandle.transaction([this.PROJECTS_TABLE], 'readwrite');
    const projectsTable = transaction.objectStore(this.PROJECTS_TABLE);
    const readRequest = projectsTable.get(this.requiresIntegerId(projectId));
    const readEvent = await this.promisifyIndexedDbRequest(readRequest);
    const projectObject = this.requiresResult(readEvent);
    if (!projectObject.labels.map(l => l.toLowerCase()).includes(label.toLowerCase())) {
      projectObject.labels.push(label);
      const updateRequest = projectsTable.put(projectObject);
      await this.promisifyIndexedDbRequest(updateRequest);
    }
  }
  getTrainingForCloud(project) {
    return this.getTrainingData(project.id).then(allTraining => {
      if (project.type === 'text') {
        const trainingByLabel = {};
        const duplicatesCheck = {};
        for (const item of allTraining) {
          const label = item.label;
          const text = item.textdata.substring(0, 1024);
          if (!(label in trainingByLabel)) {
            trainingByLabel[label] = {
              intent: label.replace(/\s/g, '_'),
              examples: []
            };
          }
          if (!(label in duplicatesCheck)) {
            duplicatesCheck[label] = [];
          }
          if (!duplicatesCheck[label].includes(text)) {
            trainingByLabel[label].examples.push({
              text
            });
            duplicatesCheck[label].push(text);
          }
        }
        return {
          name: project.name,
          language: project.language ? project.language : 'en',
          intents: Object.values(trainingByLabel),
          dialog_nodes: [],
          counterexamples: [],
          entities: [],
          metadata: {
            createdby: 'machinelearningforkids'
          }
        };
      } else if (project.type === 'numbers') {
        const csvRows = allTraining.map(data => {
          const rowLabel = data.label;
          const rowValues = data.numberdata;

          // TODO what if we have a field called label???
          const csvRow = {
            label: rowLabel
          };
          project.fields.forEach((field, idx) => {
            if (field.type === 'multichoice') {
              csvRow[field.name] = field.choices[rowValues[idx]];
            } else {
              csvRow[field.name] = rowValues[idx];
            }
          });
          return csvRow;
        });
        return Papa.unparse(csvRows, {
          columns: project.fields.map(field => {
            return field.name;
          })
        });
      } else {
        console.error('[ml4kstorage] unexpected project type', project);
      }
    });
  }

  //-----------------------------------------------------------
  //  ASSETS database
  //-----------------------------------------------------------

  storeAsset(id, url) {
    console.log('[ml4kstorage] storeAsset', id);
    return this.requiresAssetsDatabase().then(() => {
      return fetch(url);
    }).then(r => {
      return r.blob();
    }).then(zipdata => {
      const transaction = this.assetsDbHandle.transaction([this.ASSETS_TABLE], 'readwrite');
      const request = transaction.objectStore(this.ASSETS_TABLE).put(zipdata, id);
      return this.promisifyIndexedDbRequest(request);
    });
  }
  async retrieveAsset(id) {
    console.log('[ml4kstorage] retrieveAsset', id);
    await this.requiresAssetsDatabase();
    const transaction = this.assetsDbHandle.transaction([this.ASSETS_TABLE], 'readonly');
    const request = transaction.objectStore(this.ASSETS_TABLE).get(id);
    return this.promisifyIndexedDbRequest(request).then(event => {
      return this.requiresResult(event);
    });
  }
  async deleteAsset(id) {
    console.log('[ml4kstorage] deleteAsset', id);
    await this.requiresAssetsDatabase();
    const transaction = this.assetsDbHandle.transaction([this.ASSETS_TABLE], 'readwrite');
    transaction.objectStore(this.ASSETS_TABLE).delete(id);
    return this.promisifyIndexedDbTransaction(transaction);
  }

  //-----------------------------------------------------------
  //  Other
  //-----------------------------------------------------------

  getFromLocalStorage(id) {
    return window.localStorage.getItem(id);
  }
  storeBase64EncodedImage(projectid, label, b64imgdata) {
    const _that = this;
    return fetch("data:image/jpeg;base64,".concat(b64imgdata)).then(converted => {
      return converted.blob();
    }).then(imagedata => {
      _that.addTrainingData(projectid, {
        imagedata,
        label: label,
        isstored: true
      });
    });
  }
  registerForModelStorageUpdates(modelid, callback) {
    window.addEventListener('storage', evt => {
      if (evt.key === modelid) {
        callback();
      }
    });
  }
}
module.exports = ML4KidsLocalStorage;

/***/ }),

/***/ "./src/mlforkids-components/tensorflow/index.js":
/*!******************************************************!*\
  !*** ./src/mlforkids-components/tensorflow/index.js ***!
  \******************************************************/
/***/ ((module) => {

class ML4KidsTensorFlow {
  // This component needs to support multiple instances of the model
  //  extension being used at once, so all state and models are
  //  indexed by a unique request id

  // PROJECTS[projectid].modelClasses = <label1/label2/label3/...>
  // PROJECTS[projectid].modelNumClasses = <number of modelClasses>
  // PROJECTS[projectid].dataType = teachablemachineimage
  // PROJECTS[projectid].state = INIT/READY/TRAINED/ERROR
  // PROJECTS[projectid].model = <model>

  // states:
  //   INIT - not ready yet
  //   READY - ready for training
  //   TRAINED - ML model ready for use
  //   ERROR - something went wrong

  constructor() {
    this.PROJECTS = {};
    this.state = 'INIT';
    tf.enableProdMode();
  }

  // encprojectdata
  // JSON.stringify-ed version of
  //   { projectid : someprojectid, labels : [ labelA, labelB, labelC ], dataType : IMAGE, modelurl : http://somedomain... }
  initProject(encprojectdata, worker) {
    const projectData = JSON.parse(encprojectdata);
    const projectid = projectData.projectid;
    let modellocation = projectData.modelurl;
    console.log('[mlforkids] Initializing project', projectid, projectData);
    this.PROJECTS[projectid] = {};
    this.PROJECTS[projectid].state = 'INIT';
    this.PROJECTS[projectid].modelClasses = projectData.labels;
    this.PROJECTS[projectid].modelNumClasses = projectData.labels.length;
    this.PROJECTS[projectid].dataType = projectData.dataType;
    let loadModelPromise;
    if (this.PROJECTS[projectid].dataType === 'graphdefimage') {
      const loadModelOptions = {};
      if (modellocation.startsWith('https://tfhub.dev') || modellocation.startsWith('https://www.kaggle.com')) {
        loadModelOptions.fromTFHub = true;
      }
      if (this.urlEndsWith(modellocation, '/model.json')) {
        modellocation = modellocation.substr(0, modellocation.length - '/model.json'.length);
      }
      console.log('[mlforkids] loading graph model', modellocation, loadModelOptions);
      loadModelPromise = tf.loadGraphModel(modellocation, loadModelOptions);
    } else if (this.PROJECTS[projectid].dataType === 'teachablemachinepose') {
      console.log('[mlforkids] loading pose model iframe');
      loadModelPromise = this._loadPoseModelSupport().then(iframe => {
        this.teachableMachinePoseIframe = iframe;
        const metadataJsonUrl = modellocation.replace(/model\.json$/, 'metadata.json');
        return iframe.contentWindow.initModel(projectid, modellocation, metadataJsonUrl);
      });
    } else {
      console.log('[mlforkids] loading layers model', modellocation);
      loadModelPromise = tf.loadLayersModel(modellocation);
    }
    return loadModelPromise.then(model => {
      this.PROJECTS[projectid].model = model;
      this.PROJECTS[projectid].state = 'TRAINED';
      worker.postMessage({
        mlforkidstensorflow: 'modelready',
        data: {
          projectid: projectid
        }
      });
    }).catch(err => {
      console.log('[mlforkids] ML4KidsTensorFlow failed init', err);
      this.PROJECTS[projectid].state = 'ERROR';
      worker.postMessage({
        mlforkidstensorflow: 'modelfailed',
        data: {
          projectid: projectid
        }
      });
    });
  }
  urlEndsWith(urlToCheck, stringToCheck) {
    return urlToCheck.length === urlToCheck.indexOf(stringToCheck) + stringToCheck.length;
  }
  sortByConfidence(a, b) {
    if (a.confidence < b.confidence) {
      return 1;
    } else if (a.confidence > b.confidence) {
      return -1;
    } else {
      return 0;
    }
  }

  // encrequest
  // JSON.stringify-ed version of
  //   { projectid : projectId, requestid : requestId, requestdata : somethingtouse }
  classifyData(encrequest, worker) {
    const requestData = JSON.parse(encrequest);
    const projectid = requestData.projectid;
    const requestid = requestData.requestid;
    return this._prepareDataForClassification(projectid, requestData.requestdata).then(dataToClassify => {
      if (this.PROJECTS[projectid].dataType === 'teachablemachinepose') {
        return this.teachableMachinePoseIframe.contentWindow.predict(projectid, dataToClassify);
      } else {
        return this.PROJECTS[projectid].model.predict(dataToClassify).data();
      }
    }).then(output => {
      let matches;
      if (this.PROJECTS[projectid].dataType === 'teachablemachinepose') {
        matches = output.sort(this.sortByConfidence);
      } else {
        if (this.PROJECTS[projectid].modelNumClasses > 0) {
          matches = this.PROJECTS[projectid].modelClasses.map((label, idx) => {
            return {
              class_name: label,
              confidence: 100 * output[idx]
            };
          }).sort(this.sortByConfidence);
        } else {
          // label names aren't known, so we just have to refer to them by idx
          const anonScores = new Array(output.length);
          for (let idx = 0; idx < output.length; idx++) {
            anonScores[idx] = {
              class_name: 'label ' + idx,
              confidence: 100 * output[idx]
            };
          }
          matches = anonScores.sort(this.sortByConfidence);
        }
      }
      return worker.postMessage({
        mlforkidstensorflow: 'classifyresponse',
        data: {
          projectid: projectid,
          requestid: requestid,
          matches: matches
        }
      });
    }).catch(err => {
      if (err) {
        console.log('[mlforkids] ML4KidsTensorFlow error', err);
      }
      return worker.postMessage({
        mlforkidstensorflow: 'classifyresponse',
        data: {
          projectid: projectid,
          requestid: requestid
        }
      });
    });
  }
  _prepareDataForClassification(projectid, classifydata) {
    return new Promise((resolve, reject) => {
      if (projectid in this.PROJECTS) {
        if (this.PROJECTS[projectid].state !== 'TRAINED') {
          console.log('[mlforkids] ML4KidsTensorFlow received classify request before a model is ready');
          return reject();
        }
        if (this.PROJECTS[projectid].dataType === 'teachablemachineimage' || this.PROJECTS[projectid].dataType === 'graphdefimage') {
          const imageElement = document.createElement('img');
          imageElement.width = 224;
          imageElement.height = 224;
          imageElement.onerror = err => {
            console.log('[mlforkids] ML4KidsTensorFlow failed to prepare image data for prediction', err);
            return reject();
          };
          imageElement.onload = () => {
            return resolve(tf.tidy(() => {
              return tf.browser.fromPixels(imageElement).expandDims(0).toFloat().div(127).sub(1);
            }));
          };
          imageElement.src = 'data:image/jpeg;base64,' + classifydata;
        } else if (this.PROJECTS[projectid].dataType === 'teachablemachinepose') {
          this.teachableMachinePoseIframe.contentWindow.createImage(classifydata, resolve);
        } else {
          return resolve(classifydata);
        }
      } else {
        console.log('[mlforkids] ML4KidsTensorFlow received request for unknown project');
        return reject();
      }
    });
  }
  _loadPoseModelSupport() {
    return new Promise(resolve => {
      var id = 'mlforkids-iframe-posenet';
      var iframeObj = document.getElementById(id);
      if (iframeObj) {
        console.log('[mlforkids] Posenet already loaded');
        resolve(iframeObj);
      } else {
        console.log('[mlforkids] loading posenet');
        iframeObj = document.createElement('iframe');
        iframeObj.id = id;
        iframeObj.type = 'text/javascript';
        iframeObj.src = 'teachablemachinepose.html';
        iframeObj.onload = () => {
          resolve(iframeObj);
        };
        document.head.appendChild(iframeObj);
      }
    });
  }
}
module.exports = ML4KidsTensorFlow;

/***/ }),

/***/ "./src/mlforkids-components/webllm/index.js":
/*!**************************************************!*\
  !*** ./src/mlforkids-components/webllm/index.js ***!
  \**************************************************/
/***/ ((module) => {

class ML4KidsWebLlm {
  constructor() {
    this.MODELS = {};
    this.state = 'INIT';
  }
  initModel(requestdata, worker) {
    const modelid = requestdata.modelid;
    const contextwindow = requestdata.contextwindow;
    this.MODELS[modelid + '-' + contextwindow] = {
      state: 'INIT',
      busy: false,
      messages: []
    };
    this._loadWebLlmProjectSupport().then(() => {
      this.MODELS[modelid + '-' + contextwindow].webllmEngine = new window.mlforkidsWebLlm.MLCEngine();
      const modelCfg = {
        context_window_size: contextwindow
      };
      console.log('[mlforkids] loading model', modelid, modelCfg);
      return this.MODELS[modelid + '-' + contextwindow].webllmEngine.reload(modelid, modelCfg);
    }).then(() => {
      console.log('[mlforkids] loaded model');
      this.MODELS[modelid + '-' + contextwindow].state = 'READY';
      worker.postMessage({
        mlforkidswebllm: 'modelready',
        data: {
          modelid,
          contextwindow
        }
      });
    }).catch(err => {
      console.log('[mlforkids] failed to load model', err);
      this.MODELS[modelid + '-' + contextwindow].state = 'ERROR';
      worker.postMessage({
        mlforkidswebllm: 'modelfailed',
        data: {
          modelid,
          contextwindow
        }
      });
    });
  }
  clearContext(requestdata) {
    const modelid = requestdata.modelid;
    const contextwindow = requestdata.contextwindow;
    const modelKey = modelid + '-' + contextwindow;
    if (modelKey in this.MODELS === false) {
      console.log('[mlforkids] Unknown model ' + modelKey);
      return;
    }
    this.MODELS[modelKey].messages = [];
  }
  promptModel(requestdata, worker) {
    const requestid = requestdata.requestid;
    const modelid = requestdata.modelid;
    const contextwindow = requestdata.contextwindow;
    const input = requestdata.input;
    const temperature = requestdata.temperature;
    const top_p = requestdata.top_p;
    const modelKey = modelid + '-' + contextwindow;
    if (modelKey in this.MODELS === false) {
      console.log('[mlforkids] Unknown model ' + modelKey);
      return;
    }
    if (this.MODELS[modelKey].state !== 'READY') {
      console.log('[mlforkids] Model not ready');
      return;
    }
    if (this.MODELS[modelKey].busy) {
      console.log('[mlforkids] Model is busy');
      return;
    }
    this.MODELS[modelKey].busy = true;
    this._submitPrompt(requestid, modelid, contextwindow, modelKey, temperature, top_p, input, worker);
  }
  _submitPrompt(requestid, modelid, contextwindow, modelKey, temperature, top_p, input, worker) {
    if (this.MODELS[modelKey].messages.length === 0) {
      this.MODELS[modelKey].messages.push({
        role: 'system',
        content: 'You are a friendly and supportive AI assistant for children. ' + 'Use simple, clear, and encouraging language. Keep responses short, ' + 'engaging, and educational. Avoiding harmful, inappropriate, ' + 'scary, or violent content. ' + 'Always be positive and constructive, and avoid sarcasm or harsh language. ' + 'Promote digital safety by reminding children not to share personal ' + 'information. If a child asks something unsafe, gently guide them toward ' + 'a trusted adult.'
      });
    }
    this.MODELS[modelKey].messages.push({
      role: 'user',
      content: input
    });
    const prompt = {
      messages: this.MODELS[modelKey].messages,
      temperature,
      top_p
    };
    console.log(prompt);
    this.MODELS[modelid + '-' + contextwindow].webllmEngine.chat.completions.create(prompt).then(reply => {
      console.log(reply);
      const response = reply.choices[0].message.content;
      worker.postMessage({
        mlforkidswebllm: 'promptresponse',
        data: {
          requestid,
          modelid,
          contextwindow,
          response
        }
      });
      this.MODELS[modelKey].messages.push({
        role: 'assistant',
        content: response
      });
      this.MODELS[modelKey].busy = false;
    }).catch(err => {
      console.log('[mlforkids] language model fail', err);
      if (err.message.includes('tokens exceed context window size') && this.MODELS[modelKey].messages.length > 1) {
        this.MODELS[modelKey].messages.pop();
        this.MODELS[modelKey].messages.splice(1, 1);
        this._submitPrompt(requestid, modelid, contextwindow, modelKey, temperature, top_p, input, worker);
      } else {
        worker.postMessage({
          mlforkidswebllm: 'promptresponse',
          data: {
            requestid,
            modelid,
            contextwindow,
            response: 'Unable to respond'
          }
        });
        this.MODELS[modelKey].busy = false;
      }
    });
  }
  _loadWebLlmProjectSupport() {
    console.log('[mlforkids] loading web-llm script');
    return new Promise((resolve, reject) => {
      if (window.mlforkidsWebLlm) {
        return resolve(window.mlforkidsWebLlm);
      }
      const scriptObj = document.createElement('script');
      scriptObj.src = './mlforkids-thirdparty-libs/web-llm/index.js';
      scriptObj.onload = () => {
        this._waitForWebLlmModule(resolve);
        scriptObj.remove();
      };
      scriptObj.onerror = err => {
        this.state = 'ERROR';
        console.log('[mlforkids] Failed to load web-llm module', err);
        reject();
      };
      document.head.appendChild(scriptObj);
    });
  }
  _waitForWebLlmModule(resolve) {
    if (window.mlforkidsWebLlm) {
      console.log('[mlforkids] loaded web-llm');
      resolve(window.mlforkidsWebLlm);
    } else {
      setTimeout(() => {
        this._waitForWebLlmModule(resolve);
      }, 3000);
    }
  }
}
module.exports = ML4KidsWebLlm;

/***/ }),

/***/ "./src/util/log.js":
/*!*************************!*\
  !*** ./src/util/log.js ***!
  \*************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const minilog = __webpack_require__(/*! minilog */ "./node_modules/minilog/lib/web/index.js");
minilog.enable();
module.exports = minilog('vm');

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!***************************************************!*\
  !*** ./src/extension-support/extension-worker.js ***!
  \***************************************************/
/* eslint-env worker */

const ArgumentType = __webpack_require__(/*! ../extension-support/argument-type */ "./src/extension-support/argument-type.js");
const BlockType = __webpack_require__(/*! ../extension-support/block-type */ "./src/extension-support/block-type.js");
const dispatch = __webpack_require__(/*! ../dispatch/worker-dispatch */ "./src/dispatch/worker-dispatch.js");
const TargetType = __webpack_require__(/*! ../extension-support/target-type */ "./src/extension-support/target-type.js");
class ExtensionWorker {
  constructor() {
    this.nextExtensionId = 0;
    this.initialRegistrations = [];
    this.extensionURL = null;
    dispatch.waitForConnection.then(() => {
      dispatch.call('extensions', 'allocateWorker').then(x => {
        const [id, extension] = x;
        this.workerId = id;
        console.log('[mlforkids] ExtensionWorker ' + extension);
        if (extension.indexOf('http') === 0) {
          console.log('[mlforkids] Extension from remote URL : ' + extension);
          this.extensionURL = extension;
        } else {
          console.log('[mlforkids] Skipping built-in extension : ' + extension);
          this.extensionURL = extension;
          return dispatch.call('extensions', 'onWorkerInit', id);
        }
        try {
          importScripts(extension);
          const initialRegistrations = this.initialRegistrations;
          this.initialRegistrations = null;
          Promise.all(initialRegistrations).then(() => dispatch.call('extensions', 'onWorkerInit', id));
        } catch (e) {
          dispatch.call('extensions', 'onWorkerInit', id, e);
          if (postMessage && e.name === 'NetworkError' && extension.indexOf('extension3.js') > 0) {
            postMessage({
              mlforkids: 'mlforkids-extension-help'
            });
          }
        }
      });
    });
    this.extensions = [];
  }
  register(extensionObject) {
    const extensionId = this.nextExtensionId++;
    this.extensions.push(extensionObject);
    const serviceName = "extension.".concat(this.workerId, ".").concat(extensionId);
    const promise = dispatch.setService(serviceName, extensionObject).then(() => dispatch.call('extensions', 'registerExtensionService', serviceName, this.extensionURL));
    if (this.initialRegistrations) {
      this.initialRegistrations.push(promise);
    }
    return promise;
  }
}
__webpack_require__.g.Scratch = __webpack_require__.g.Scratch || {};
__webpack_require__.g.Scratch.ArgumentType = ArgumentType;
__webpack_require__.g.Scratch.BlockType = BlockType;
__webpack_require__.g.Scratch.TargetType = TargetType;

/**
 * Expose only specific parts of the worker to extensions.
 */
const extensionWorker = new ExtensionWorker();
__webpack_require__.g.Scratch.extensions = {
  register: extensionWorker.register.bind(extensionWorker)
};
})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=extension-worker.js.map