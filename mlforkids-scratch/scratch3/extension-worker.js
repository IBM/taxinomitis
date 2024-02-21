/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./node_modules/babel-loader/lib/index.js?!./node_modules/scratch-vm/src/extension-support/extension-worker.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/babel-loader/lib/index.js?!./node_modules/scratch-vm/src/extension-support/extension-worker.js":
/*!*******************************************************************************************************************!*\
  !*** ./node_modules/babel-loader/lib??ref--4!./node_modules/scratch-vm/src/extension-support/extension-worker.js ***!
  \*******************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/* eslint-env worker */

var ArgumentType = __webpack_require__(/*! ../extension-support/argument-type */ "./node_modules/scratch-vm/src/extension-support/argument-type.js");
var BlockType = __webpack_require__(/*! ../extension-support/block-type */ "./node_modules/scratch-vm/src/extension-support/block-type.js");
var dispatch = __webpack_require__(/*! ../dispatch/worker-dispatch */ "./node_modules/scratch-vm/src/dispatch/worker-dispatch.js");
var TargetType = __webpack_require__(/*! ../extension-support/target-type */ "./node_modules/scratch-vm/src/extension-support/target-type.js");
var ExtensionWorker = /*#__PURE__*/function () {
  function ExtensionWorker() {
    var _this = this;
    _classCallCheck(this, ExtensionWorker);
    this.nextExtensionId = 0;
    this.initialRegistrations = [];
    this.extensionURL = null;
    dispatch.waitForConnection.then(function () {
      dispatch.call('extensions', 'allocateWorker').then(function (x) {
        var _x = _slicedToArray(x, 2),
          id = _x[0],
          extension = _x[1];
        _this.workerId = id;
        console.log('[mlforkids] ExtensionWorker ' + extension);
        if (extension.indexOf('http') === 0) {
          console.log('[mlforkids] Extension from remote URL : ' + extension);
          _this.extensionURL = extension;
        } else {
          console.log('[mlforkids] Skipping built-in extension : ' + extension);
          _this.extensionURL = extension;
          return dispatch.call('extensions', 'onWorkerInit', id);
        }
        try {
          importScripts(extension);
          var initialRegistrations = _this.initialRegistrations;
          _this.initialRegistrations = null;
          Promise.all(initialRegistrations).then(function () {
            return dispatch.call('extensions', 'onWorkerInit', id);
          });
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
  _createClass(ExtensionWorker, [{
    key: "register",
    value: function register(extensionObject) {
      var _this2 = this;
      var extensionId = this.nextExtensionId++;
      this.extensions.push(extensionObject);
      var serviceName = "extension.".concat(this.workerId, ".").concat(extensionId);
      var promise = dispatch.setService(serviceName, extensionObject).then(function () {
        return dispatch.call('extensions', 'registerExtensionService', serviceName, _this2.extensionURL);
      });
      if (this.initialRegistrations) {
        this.initialRegistrations.push(promise);
      }
      return promise;
    }
  }]);
  return ExtensionWorker;
}();
global.Scratch = global.Scratch || {};
global.Scratch.ArgumentType = ArgumentType;
global.Scratch.BlockType = BlockType;
global.Scratch.TargetType = TargetType;

/**
 * Expose only specific parts of the worker to extensions.
 */
var extensionWorker = new ExtensionWorker();
global.Scratch.extensions = {
  register: extensionWorker.register.bind(extensionWorker)
};
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./node_modules/scratch-vm/node_modules/microee/index.js":
/*!***************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/microee/index.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/common/filter.js":
/*!***************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/common/filter.js ***!
  \***************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

// default filter
var Transform = __webpack_require__(/*! ./transform.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js");

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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/common/minilog.js":
/*!****************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/common/minilog.js ***!
  \****************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var Transform = __webpack_require__(/*! ./transform.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js"),
    Filter = __webpack_require__(/*! ./filter.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/filter.js");

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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js":
/*!******************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js ***!
  \******************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var microee = __webpack_require__(/*! microee */ "./node_modules/scratch-vm/node_modules/microee/index.js");

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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/web/array.js":
/*!***********************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/web/array.js ***!
  \***********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var Transform = __webpack_require__(/*! ../common/transform.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js"),
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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/web/console.js":
/*!*************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/web/console.js ***!
  \*************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var Transform = __webpack_require__(/*! ../common/transform.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js");

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
logger.color = __webpack_require__(/*! ./formatters/color.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/color.js");
logger.minilog = __webpack_require__(/*! ./formatters/minilog.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/minilog.js");

module.exports = logger;


/***/ }),

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/color.js":
/*!**********************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/color.js ***!
  \**********************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var Transform = __webpack_require__(/*! ../../common/transform.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js"),
    color = __webpack_require__(/*! ./util.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/util.js");

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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/minilog.js":
/*!************************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/minilog.js ***!
  \************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var Transform = __webpack_require__(/*! ../../common/transform.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js"),
    color = __webpack_require__(/*! ./util.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/util.js"),
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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/util.js":
/*!*********************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/web/formatters/util.js ***!
  \*********************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/web/index.js":
/*!***********************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/web/index.js ***!
  \***********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var Minilog = __webpack_require__(/*! ../common/minilog.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/minilog.js");

var oldEnable = Minilog.enable,
    oldDisable = Minilog.disable,
    isChrome = (typeof navigator != 'undefined' && /chrome/i.test(navigator.userAgent)),
    console = __webpack_require__(/*! ./console.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/console.js");

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
  array: __webpack_require__(/*! ./array.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/array.js"),
  browser: Minilog.defaultBackend,
  localStorage: __webpack_require__(/*! ./localstorage.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/localstorage.js"),
  jQuery: __webpack_require__(/*! ./jquery_simple.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/jquery_simple.js")
};


/***/ }),

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/web/jquery_simple.js":
/*!*******************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/web/jquery_simple.js ***!
  \*******************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var Transform = __webpack_require__(/*! ../common/transform.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js");

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

/***/ "./node_modules/scratch-vm/node_modules/minilog/lib/web/localstorage.js":
/*!******************************************************************************!*\
  !*** ./node_modules/scratch-vm/node_modules/minilog/lib/web/localstorage.js ***!
  \******************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var Transform = __webpack_require__(/*! ../common/transform.js */ "./node_modules/scratch-vm/node_modules/minilog/lib/common/transform.js"),
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

/***/ "./node_modules/scratch-vm/src/dispatch/shared-dispatch.js":
/*!*****************************************************************!*\
  !*** ./node_modules/scratch-vm/src/dispatch/shared-dispatch.js ***!
  \*****************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var log = __webpack_require__(/*! ../util/log */ "./node_modules/scratch-vm/src/util/log.js");
var mlforkidsSound = __webpack_require__(/*! ../mlforkids-components/sound */ "./node_modules/scratch-vm/src/mlforkids-components/sound/index.js");
var mlforkidsImages = __webpack_require__(/*! ../mlforkids-components/images */ "./node_modules/scratch-vm/src/mlforkids-components/images/index.js");
var mlforkidsRegression = __webpack_require__(/*! ../mlforkids-components/regression */ "./node_modules/scratch-vm/src/mlforkids-components/regression/index.js");
var mlforkidsTensorFlow = __webpack_require__(/*! ../mlforkids-components/tensorflow */ "./node_modules/scratch-vm/src/mlforkids-components/tensorflow/index.js");
var mlforkidsStorage = __webpack_require__(/*! ../mlforkids-components/storage */ "./node_modules/scratch-vm/src/mlforkids-components/storage/index.js");

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
var SharedDispatch = /*#__PURE__*/function () {
  function SharedDispatch() {
    _classCallCheck(this, SharedDispatch);
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
  _createClass(SharedDispatch, [{
    key: "call",
    value: function call(service, method) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }
      return this.transferCall.apply(this, [service, method, null].concat(args));
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
  }, {
    key: "transferCall",
    value: function transferCall(service, method, transfer) {
      try {
        var _this$_getServiceProv = this._getServiceProvider(service),
          provider = _this$_getServiceProv.provider,
          isRemote = _this$_getServiceProv.isRemote;
        if (provider) {
          for (var _len2 = arguments.length, args = new Array(_len2 > 3 ? _len2 - 3 : 0), _key2 = 3; _key2 < _len2; _key2++) {
            args[_key2 - 3] = arguments[_key2];
          }
          if (isRemote) {
            return this._remoteTransferCall.apply(this, [provider, service, method, transfer].concat(args));
          }

          // TODO: verify correct `this` after switching from apply to spread
          // eslint-disable-next-line prefer-spread
          var result = provider[method].apply(provider, args);
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
  }, {
    key: "_isRemoteService",
    value: function _isRemoteService(service) {
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
  }, {
    key: "_remoteCall",
    value: function _remoteCall(provider, service, method) {
      for (var _len3 = arguments.length, args = new Array(_len3 > 3 ? _len3 - 3 : 0), _key3 = 3; _key3 < _len3; _key3++) {
        args[_key3 - 3] = arguments[_key3];
      }
      return this._remoteTransferCall.apply(this, [provider, service, method, null].concat(args));
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
  }, {
    key: "_remoteTransferCall",
    value: function _remoteTransferCall(provider, service, method, transfer) {
      var _this = this;
      for (var _len4 = arguments.length, args = new Array(_len4 > 4 ? _len4 - 4 : 0), _key4 = 4; _key4 < _len4; _key4++) {
        args[_key4 - 4] = arguments[_key4];
      }
      return new Promise(function (resolve, reject) {
        var responseId = _this._storeCallbacks(resolve, reject);

        /** @TODO: remove this hack! this is just here so we don't try to send `util` to a worker */
        if (args.length > 0 && typeof args[args.length - 1].yield === 'function') {
          args.pop();
        }
        if (transfer) {
          provider.postMessage({
            service: service,
            method: method,
            responseId: responseId,
            args: args
          }, transfer);
        } else {
          provider.postMessage({
            service: service,
            method: method,
            responseId: responseId,
            args: args
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
  }, {
    key: "_storeCallbacks",
    value: function _storeCallbacks(resolve, reject) {
      var responseId = this.nextResponseId++;
      this.callbacks[responseId] = [resolve, reject];
      return responseId;
    }

    /**
     * Deliver call response from a worker. This should only be called as the result of a message from a worker.
     * @param {int} responseId - the response ID of the callback set to call.
     * @param {DispatchResponseMessage} message - the message containing the response value(s).
     * @protected
     */
  }, {
    key: "_deliverResponse",
    value: function _deliverResponse(responseId, message) {
      try {
        var _this$callbacks$respo = _slicedToArray(this.callbacks[responseId], 2),
          resolve = _this$callbacks$respo[0],
          reject = _this$callbacks$respo[1];
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
  }, {
    key: "_onMessage",
    value: function _onMessage(worker, event) {
      var _this2 = this;
      /** @type {DispatchMessage} */
      var message = event.data;
      message.args = message.args || [];
      var promise;
      if (message.service) {
        if (message.service === 'dispatch') {
          promise = this._onDispatchMessage(worker, message);
        } else {
          promise = this.call.apply(this, [message.service, message.method].concat(_toConsumableArray(message.args)));
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
          return this.mlforkidsStorageSupport.getProject(message.mlforkidssound.data).then(function (projectinfo) {
            projectinfo.projectid = message.mlforkidssound.data;
            _this2.mlforkidsSoundSupport.init(projectinfo, worker);
          }).catch(function (err) {
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
          this.mlforkidsSoundSupport.stopListening();
        }
      } else if (message.mlforkidsimage) {
        if (message.mlforkidsimage.command === 'init') {
          if (!this.mlforkidsImageSupport) {
            this.mlforkidsImageSupport = new mlforkidsImages(this.mlforkidsStorageSupport);
          }
          this.mlforkidsImageSupport.init().then(function () {
            _this2.mlforkidsImageSupport.initProject(message.mlforkidsimage.data, worker);
          });
        } else if (message.mlforkidsimage.command === 'initlocal') {
          if (!this.mlforkidsImageSupport) {
            this.mlforkidsImageSupport = new mlforkidsImages(this.mlforkidsStorageSupport);
          }
          this.mlforkidsImageSupport.init().then(function () {
            return _this2.mlforkidsStorageSupport.getProject(message.mlforkidsimage.data);
          }).then(function (projectinfo) {
            projectinfo.projectid = message.mlforkidsimage.data;
            _this2.mlforkidsImageSupport.initProject(projectinfo, worker);
          }).catch(function (err) {
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
      } else if (message.mlforkidsregression) {
        if (message.mlforkidsregression.command === 'init') {
          if (!this.mlforkidsRegressionSupport) {
            this.mlforkidsRegressionSupport = new mlforkidsRegression(this.mlforkidsStorageSupport);
          }
          this.mlforkidsRegressionSupport.init().then(function () {
            return _this2.mlforkidsStorageSupport.getProject(message.mlforkidsregression.data);
          }).then(function (projectinfo) {
            projectinfo.projectid = message.mlforkidsregression.data;
            _this2.mlforkidsRegressionSupport.initProject(projectinfo, worker);
          }).catch(function (err) {
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
        } else if (message.mlforkidsstorage.command === 'textwatson') {
          this.mlforkidsStorageSupport.getProject(message.mlforkidsstorage.data.projectid).then(function (projectinfo) {
            return _this2.mlforkidsStorageSupport.getTrainingForWatsonAssistant(projectinfo);
          }).then(function (training) {
            worker.postMessage({
              mlforkidsstorage: 'textwatson',
              projectid: message.mlforkidsstorage.data.projectid,
              data: training
            });
          });
        } else if (message.mlforkidsstorage.command === 'trainingdata') {
          this.mlforkidsStorageSupport.getTrainingData(message.mlforkidsstorage.data.projectid).then(function (training) {
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
      } else if (typeof message.responseId === 'undefined') {
        log.error("Dispatch caught malformed message from a worker: ".concat(JSON.stringify(event)));
      } else {
        this._deliverResponse(message.responseId, message);
      }
      if (promise) {
        if (typeof message.responseId === 'undefined') {
          log.error("Dispatch message missing required response ID: ".concat(JSON.stringify(event)));
        } else {
          promise.then(function (result) {
            return worker.postMessage({
              responseId: message.responseId,
              result: result
            });
          }, function (error) {
            return worker.postMessage({
              responseId: message.responseId,
              error: error
            });
          });
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
  }, {
    key: "_getServiceProvider",
    value: function _getServiceProvider(service) {
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
  }, {
    key: "_onDispatchMessage",
    value: function _onDispatchMessage(worker, message) {
      throw new Error("Unimplemented dispatch message handler cannot handle ".concat(message.method, " method"));
    }
  }]);
  return SharedDispatch;
}();
module.exports = SharedDispatch;

/***/ }),

/***/ "./node_modules/scratch-vm/src/dispatch/worker-dispatch.js":
/*!*****************************************************************!*\
  !*** ./node_modules/scratch-vm/src/dispatch/worker-dispatch.js ***!
  \*****************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } else if (call !== void 0) { throw new TypeError("Derived constructors may only return object or undefined"); } return _assertThisInitialized(self); }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }
function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }
function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); Object.defineProperty(subClass, "prototype", { writable: false }); if (superClass) _setPrototypeOf(subClass, superClass); }
function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }
var SharedDispatch = __webpack_require__(/*! ./shared-dispatch */ "./node_modules/scratch-vm/src/dispatch/shared-dispatch.js");
var log = __webpack_require__(/*! ../util/log */ "./node_modules/scratch-vm/src/util/log.js");

/**
 * This class provides a Worker with the means to participate in the message dispatch system managed by CentralDispatch.
 * From any context in the messaging system, the dispatcher's "call" method can call any method on any "service"
 * provided in any participating context. The dispatch system will forward function arguments and return values across
 * worker boundaries as needed.
 * @see {CentralDispatch}
 */
var WorkerDispatch = /*#__PURE__*/function (_SharedDispatch) {
  _inherits(WorkerDispatch, _SharedDispatch);
  function WorkerDispatch() {
    var _this;
    _classCallCheck(this, WorkerDispatch);
    _this = _callSuper(this, WorkerDispatch);

    /**
     * This promise will be resolved when we have successfully connected to central dispatch.
     * @type {Promise}
     * @see {waitForConnection}
     * @private
     */
    _this._connectionPromise = new Promise(function (resolve) {
      _this._onConnect = resolve;
    });

    /**
     * Map of service name to local service provider.
     * If a service is not listed here, it is assumed to be provided by another context (another Worker or the main
     * thread).
     * @see {setService}
     * @type {object}
     */
    _this.services = {};
    _this._onMessage = _this._onMessage.bind(_assertThisInitialized(_this), self);
    if (typeof self !== 'undefined') {
      self.onmessage = _this._onMessage;
    }
    return _this;
  }

  /**
   * @returns {Promise} a promise which will resolve upon connection to central dispatch. If you need to make a call
   * immediately on "startup" you can attach a 'then' to this promise.
   * @example
   *      dispatch.waitForConnection.then(() => {
   *          dispatch.call('myService', 'hello');
   *      })
   */
  _createClass(WorkerDispatch, [{
    key: "waitForConnection",
    get: function get() {
      return this._connectionPromise;
    }

    /**
     * Set a local object as the global provider of the specified service.
     * WARNING: Any method on the provider can be called from any worker within the dispatch system.
     * @param {string} service - a globally unique string identifying this service. Examples: 'vm', 'gui', 'extension9'.
     * @param {object} provider - a local object which provides this service.
     * @returns {Promise} - a promise which will resolve once the service is registered.
     */
  }, {
    key: "setService",
    value: function setService(service, provider) {
      var _this2 = this;
      if (Object.prototype.hasOwnProperty.call(this.services, service)) {
        log.warn("Worker dispatch replacing existing service provider for ".concat(service));
      }
      this.services[service] = provider;
      return this.waitForConnection.then(function () {
        return _this2._remoteCall(self, 'dispatch', 'setService', service);
      });
    }

    /**
     * Fetch the service provider object for a particular service name.
     * @override
     * @param {string} service - the name of the service to look up
     * @returns {{provider:(object|Worker), isRemote:boolean}} - the means to contact the service, if found
     * @protected
     */
  }, {
    key: "_getServiceProvider",
    value: function _getServiceProvider(service) {
      // if we don't have a local service by this name, contact central dispatch by calling `postMessage` on self
      var provider = this.services[service];
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
  }, {
    key: "_onDispatchMessage",
    value: function _onDispatchMessage(worker, message) {
      var promise;
      switch (message.method) {
        case 'handshake':
          promise = this._onConnect();
          break;
        case 'terminate':
          // Don't close until next tick, after sending confirmation back
          setTimeout(function () {
            return self.close();
          }, 0);
          promise = Promise.resolve();
          break;
        default:
          log.error("Worker dispatch received message for unknown method: ".concat(message.method));
      }
      return promise;
    }
  }]);
  return WorkerDispatch;
}(SharedDispatch);
module.exports = new WorkerDispatch();

/***/ }),

/***/ "./node_modules/scratch-vm/src/extension-support/argument-type.js":
/*!************************************************************************!*\
  !*** ./node_modules/scratch-vm/src/extension-support/argument-type.js ***!
  \************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

/**
 * Block argument types
 * @enum {string}
 */
var ArgumentType = {
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

/***/ "./node_modules/scratch-vm/src/extension-support/block-type.js":
/*!*********************************************************************!*\
  !*** ./node_modules/scratch-vm/src/extension-support/block-type.js ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

/**
 * Types of block
 * @enum {string}
 */
var BlockType = {
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

/***/ "./node_modules/scratch-vm/src/extension-support/target-type.js":
/*!**********************************************************************!*\
  !*** ./node_modules/scratch-vm/src/extension-support/target-type.js ***!
  \**********************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

/**
 * Default types of Target supported by the VM
 * @enum {string}
 */
var TargetType = {
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

/***/ "./node_modules/scratch-vm/src/mlforkids-components/images/index.js":
/*!**************************************************************************!*\
  !*** ./node_modules/scratch-vm/src/mlforkids-components/images/index.js ***!
  \**************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var ML4KidsImageTraining = /*#__PURE__*/function () {
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

  function ML4KidsImageTraining(storageSupport) {
    _classCallCheck(this, ML4KidsImageTraining);
    this.PROJECTS = {};
    this.state = 'INIT';
    this._storageSupport = storageSupport;
  }

  // safe to call this multiple times, including calling it before the first call has completed
  _createClass(ML4KidsImageTraining, [{
    key: "init",
    value: function init() {
      var _this = this;
      if (!this.initPromise) {
        this.initPromise = new Promise(function (resolve, reject) {
          tf.enableProdMode();

          // const BASE_MODEL = 'https://storage.googleapis.com' +
          //                     '/tfjs-models/tfjs' +
          //                     '/mobilenet_v1_0.25_224' +
          //                     '/model.json';
          var BASE_MODEL = 'https://machinelearningforkids.co.uk/static/bower_components/tensorflow-models/image-recognition-scratch/model.json';
          tf.loadLayersModel(BASE_MODEL).then(function (pretrainedModel) {
            var activationLayer = pretrainedModel.getLayer('conv_pw_13_relu');
            _this.baseModel = tf.model({
              inputs: pretrainedModel.inputs,
              outputs: activationLayer.output
            });
            _this.state = 'READY';
            resolve();
          }).catch(function (err) {
            _this.state = 'ERROR';
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
  }, {
    key: "initProject",
    value: function initProject(encprojectdata, worker) {
      var _this2 = this;
      console.log('[mlforkids] ML4KidsImageTraining init');
      var projectData = typeof encprojectdata === 'string' ? JSON.parse(encprojectdata) : encprojectdata;
      var projectid = projectData.projectid;
      this.PROJECTS[projectid] = {};
      this.PROJECTS[projectid].state = 'INIT';
      this.PROJECTS[projectid].modelClasses = projectData.labels;
      this.PROJECTS[projectid].modelNumClasses = projectData.labels.length;
      this.PROJECTS[projectid].usingRestoredModel = false;
      return this._loadModel(projectid).then(function (model) {
        if (model) {
          _this2.PROJECTS[projectid].transferModel = model;
          _this2.PROJECTS[projectid].state = 'TRAINED';
          _this2.PROJECTS[projectid].usingRestoredModel = true;
          worker.postMessage({
            mlforkidsimage: 'modelready',
            data: {
              projectid: projectid
            }
          });
        } else {
          _this2.PROJECTS[projectid].transferModel = _this2.prepareTransferLearningModel(projectData.labels.length);
          _this2.PROJECTS[projectid].state = 'READY';
          worker.postMessage({
            mlforkidsimage: 'modelinit',
            data: {
              projectid: projectid
            }
          });
        }
        _this2._watchForNewModels(projectid, worker);
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsImageTraining failed init', err);
        _this2.PROJECTS[projectid].state = 'ERROR';
        worker.postMessage({
          mlforkidsimage: 'modelfailed',
          data: {
            projectid: projectid
          }
        });
      });
    }
  }, {
    key: "sortByConfidence",
    value: function sortByConfidence(a, b) {
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
  }, {
    key: "classifyImageData",
    value: function classifyImageData(encrequest, worker) {
      var requestData = JSON.parse(encrequest);
      var projectid = requestData.projectid;
      var requestid = requestData.requestid;
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
        imageElement.onerror = function (err) {
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
        imageElement.onload = function () {
          var imageDataTensor = tf.tidy(function () {
            return tf.browser.fromPixels(imageElement).expandDims(0).toFloat().div(127).sub(1);
          });
          var baseModelOutput = that.baseModel.predict(imageDataTensor);
          var transferModelOutput = that.PROJECTS[projectid].transferModel.predict(baseModelOutput);
          transferModelOutput.data().then(function (output) {
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
            var matches = that.PROJECTS[projectid].modelClasses.map(function (label, idx) {
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
  }, {
    key: "prepareTransferLearningModel",
    value: function prepareTransferLearningModel(numClasses) {
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
  }, {
    key: "_getModelDbLocation",
    value: function _getModelDbLocation(projectid) {
      return 'indexeddb://ml4k-models-images-' + projectid.toString().replaceAll('-', '');
    }
  }, {
    key: "_loadModel",
    value: function _loadModel(projectid) {
      console.log('[mlforkids] ML4KidsImageTraining loading model from browser storage');
      var savelocation = this._getModelDbLocation(projectid);
      return tf.loadLayersModel(savelocation).catch(function (err) {
        console.log('[mlforkids] ML4KidsImageTraining failed to load model from storage', err);
        return;
      });
    }
  }, {
    key: "_saveModel",
    value: function _saveModel(projectid) {
      var _this3 = this;
      console.log('[mlforkids] ML4KidsImageTraining saving model to browser storage');
      var savelocation = this._getModelDbLocation(projectid);
      return this.PROJECTS[projectid].transferModel.save(savelocation).then(function (results) {
        console.log('[mlforkids] ML4KidsImageTraining saved model', savelocation, results);
        _this3._storeModelSavedDate(savelocation);
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsImageTraining failed to save model', err);
      });
    }
  }, {
    key: "_storeModelSavedDate",
    value: function _storeModelSavedDate(modelid) {
      try {
        if (window.localStorage) {
          window.localStorage.setItem(modelid, Date.now());
        }
      } catch (err) {
        console.log('[mlforkids] ML4KidsImageTraining unable to save model date');
      }
    }
  }, {
    key: "_watchForNewModels",
    value: function _watchForNewModels(projectid, worker) {
      var _this4 = this;
      if (!this.PROJECTS[projectid].modelWatcher) {
        console.log('[mlforkids] ML4KidsImageTraining listening for model updates', projectid);
        this.PROJECTS[projectid].modelWatcher = true;
        var modellocation = this._getModelDbLocation(projectid);
        this._storageSupport.registerForModelStorageUpdates(modellocation, function () {
          console.log('[mlforkids] ML4KidsImageTraining new model was trained outside of Scratch');
          return _this4._loadModel(projectid).then(function (model) {
            if (model) {
              _this4.PROJECTS[projectid].transferModel = model;
              _this4.PROJECTS[projectid].state = 'TRAINED';
              _this4.PROJECTS[projectid].usingRestoredModel = true;
              worker.postMessage({
                mlforkidsimage: 'modelready',
                data: {
                  projectid: projectid
                }
              });
            } else {
              // we weren't able to load the model
              //  it may have been deleted outside of Scratch
              _this4.PROJECTS[projectid].state = 'ERROR';
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
  }, {
    key: "_getLocalImageData",
    value: function _getLocalImageData(projectid, trainingdataid) {
      var storedTrainingItem;
      return this._storageSupport.getTrainingDataItem(projectid, trainingdataid).then(function (trainingitem) {
        storedTrainingItem = trainingitem;
        if (!storedTrainingItem.imagedata) {
          var url = new URL('https://machinelearningforkids.co.uk/api/classes/' + tenant + '/students/' + userid + '/training/images');
          url.search = new URLSearchParams({
            imageurl: trainingitem.imageurl,
            label: trainingitem.label,
            option: 'prepare'
          });
          return fetch(url);
        }
      }).then(function (resp) {
        if (storedTrainingItem.imagedata) {
          return storedTrainingItem.imagedata;
        }
        return resp.arrayBuffer();
      }).then(function (imgdata) {
        return {
          imgdata: imgdata,
          metadata: storedTrainingItem
        };
      });
    }
  }, {
    key: "trainNewModelLocal",
    value: function trainNewModelLocal(projectinfo, worker) {
      var projectid = projectinfo.projectid;
      var that = this;
      return this._storageSupport.getTrainingData(projectid).then(function (trainingitems) {
        var data = {
          projectid: projectid,
          trainingdata: trainingitems.map(function (trainingitem) {
            return {
              metadata: trainingitem,
              imgdata: trainingitem.imagedata
            };
          })
        };
        that.trainNewModel(data, worker);
      });
    }
  }, {
    key: "trainNewModel",
    value: function trainNewModel(data, worker) {
      var _this5 = this;
      var projectid = data.projectid;
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
      var that = this;
      return Promise.all(data.trainingdata.map(this._getTensorForImageData)).then(function (trainingdata) {
        var xs;
        var ys;
        var _loop = function _loop() {
            var trainingdataitem = trainingdata[i];
            var labelIdx = that.PROJECTS[projectid].modelClasses.indexOf(trainingdataitem.metadata.label);
            var xval = that.baseModel.predict(trainingdataitem.data);
            var yval = tf.tidy(function () {
              return tf.oneHot(tf.tensor1d([labelIdx]).toInt(), that.PROJECTS[projectid].modelNumClasses);
            });
            if (i === 0) {
              xs = xval;
              ys = yval;
            } else {
              oldxs = xs;
              oldys = ys;
              xs = oldxs.concat(xval, 0);
              ys = oldys.concat(yval, 0);
              oldxs.dispose();
              oldys.dispose();
            }
          },
          oldxs,
          oldys;
        for (var i = 0; i < trainingdata.length; i++) {
          _loop();
        }
        var epochs = 10;
        if (trainingdata.length > 55) {
          epochs = 15;
        }
        that.PROJECTS[projectid].transferModel.fit(xs, ys, {
          batchSize: 10,
          epochs: epochs,
          callbacks: {
            onEpochEnd: function onEpochEnd(epoch, logs) {
              console.log('[mlforkids] ML4KidsImageTraining epoch ' + epoch + ' loss ' + logs.loss);
            },
            onTrainEnd: function onTrainEnd() {
              console.log('[mlforkids] ML4KidsImageTraining training complete');
              that._saveModel(projectid);
              that.PROJECTS[projectid].state = 'TRAINED';
              that.PROJECTS[projectid].usingRestoredModel = false;
              worker.postMessage({
                mlforkidsimage: 'modelready',
                data: {
                  projectid: projectid
                }
              });
            }
          }
        });
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsImageTraining failed to train model', err);
        _this5.PROJECTS[projectid].state = 'ERROR';
        worker.postMessage({
          mlforkidsimage: 'modelfailed',
          data: {
            projectid: projectid
          }
        });
      });
    }
  }, {
    key: "_getTensorForImageData",
    value: function _getTensorForImageData(_ref) {
      var imgdata = _ref.imgdata,
        metadata = _ref.metadata;
      return new Promise(function (resolve, reject) {
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
            metadata: metadata,
            data: imageData
          });
          URL.revokeObjectURL(imgDataBlob);
        };
        hiddenImg.src = imgDataBlob;
      });
    }
  }]);
  return ML4KidsImageTraining;
}();
module.exports = ML4KidsImageTraining;

/***/ }),

/***/ "./node_modules/scratch-vm/src/mlforkids-components/regression/index.js":
/*!******************************************************************************!*\
  !*** ./node_modules/scratch-vm/src/mlforkids-components/regression/index.js ***!
  \******************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var ML4KidsRegressionTraining = /*#__PURE__*/function () {
  function ML4KidsRegressionTraining(storageSupport) {
    _classCallCheck(this, ML4KidsRegressionTraining);
    this.PROJECTS = {};
    this.state = 'INIT';
    this._storageSupport = storageSupport;
  }
  _createClass(ML4KidsRegressionTraining, [{
    key: "init",
    value: function init() {
      var _this = this;
      if (!this.initPromise) {
        this.initPromise = new Promise(function (resolve) {
          tf.enableProdMode();
          _this.state = 'READY';
          resolve();
        });
      }
      return this.initPromise;
    }
  }, {
    key: "initProject",
    value: function initProject(project, worker) {
      var _this2 = this;
      this.PROJECTS[project.id] = {
        state: 'INIT',
        project: project
      };
      return this._loadModel(project.id).then(function (loaded) {
        if (loaded) {
          _this2.PROJECTS[project.id].state = 'TRAINED';
          worker.postMessage({
            mlforkidsregression: 'modelready',
            data: {
              projectid: project.id
            }
          });
        } else {
          _this2.PROJECTS[project.id].state = 'READY';
          worker.postMessage({
            mlforkidsregression: 'modelinit',
            data: {
              projectid: project.id
            }
          });
        }
        _this2._watchForNewModels(project.id, worker);
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsRegressionTraining failed init', err);
        _this2.PROJECTS[projectid].state = 'ERROR';
        worker.postMessage({
          mlforkidsregression: 'modelfailed',
          data: {
            projectid: project.id
          }
        });
      });
    }
  }, {
    key: "trainNewModel",
    value: function trainNewModel(projectid, worker) {
      var _this3 = this;
      if (this.PROJECTS[projectid].state === 'TRAINING') {
        console.log('[mlforkids] ML4KidsRegressionTraining training in progress for this model');
        return;
      }
      console.log('[mlforkids] ML4KidsRegressionTraining training new model');
      this.PROJECTS[projectid].state = 'TRAINING';
      var that = this;
      return this._storageSupport.getTrainingData(projectid).then(function (training) {
        var project = that.PROJECTS[projectid].project;

        // separate out columns into input and output values
        var inputColumns = project.columns.filter(function (col) {
          return col.output === false;
        }).map(function (col) {
          return col.label;
        });
        var targetColumns = project.columns.filter(function (col) {
          return col.output === true;
        }).map(function (col) {
          return col.label;
        });

        // turn array of JSON objects into array of raw numbers
        var inputFeatures = [];
        var targetFeatures = [];
        var _loop = function _loop() {
          var trainingitem = training[i];
          inputFeatures.push(inputColumns.map(function (col) {
            return trainingitem[col];
          }));
          targetFeatures.push(targetColumns.map(function (col) {
            return trainingitem[col];
          }));
        };
        for (var i = 0; i < training.length; i++) {
          _loop();
        }

        // normalize the input
        var inputFeaturesTensor = tf.tensor2d(inputFeatures);
        var mean = inputFeaturesTensor.mean(0);
        var standardDeviation = inputFeaturesTensor.sub(mean).square().mean(0).sqrt();
        that.PROJECTS[projectid].normalization = {
          mean: mean,
          standardDeviation: standardDeviation
        };
        var normalisedInputFeatures = inputFeaturesTensor.sub(that.PROJECTS[projectid].normalization.mean).div(that.PROJECTS[projectid].normalization.standardDeviation);

        // TODO store the normalization?

        // create the model
        that.PROJECTS[projectid].model = that._defineModel(inputColumns.length, targetColumns.length);

        // train the model
        that.PROJECTS[projectid].model.fit(normalisedInputFeatures, tf.tensor2d(targetFeatures), {
          batchSize: 40,
          epochs: 200,
          validationSplit: 0.2,
          callbacks: {
            onEpochEnd: function onEpochEnd(epoch, logs) {
              console.log('[mlforkids] ML4KidsRegressionTraining epoch ' + epoch + ' loss ' + logs.loss);
            },
            onTrainEnd: function onTrainEnd() {
              console.log('[mlforkids] ML4KidsRegressionTraining training complete');
              that._saveModel(projectid);
              that.PROJECTS[projectid].state = 'TRAINED';
              worker.postMessage({
                mlforkidsregression: 'modelready',
                data: {
                  projectid: projectid
                }
              });
            }
          }
        });
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsRegressionTraining failed to train model', err);
        _this3.PROJECTS[projectid].state = 'ERROR';
        worker.postMessage({
          mlforkidsregression: 'modelfailed',
          data: {
            projectid: projectid
          }
        });
      });
    }
  }, {
    key: "predict",
    value: function predict(requestdata, worker) {
      var requestid = requestdata.requestid;
      var projectid = requestdata.projectid;
      var project = this.PROJECTS[projectid].project;
      var normalization = this.PROJECTS[projectid].normalization;
      var testdata = requestdata.data;
      var testTensor = tf.tidy(function () {
        var inputValues = project.columns.filter(function (col) {
          return col.output === false;
        }).map(function (col) {
          return testdata[col.label];
        });
        var inputTensor = tf.tensor2d([inputValues]);
        var normalisedInputValues = inputTensor.sub(normalization.mean).div(normalization.standardDeviation);
        return normalisedInputValues;
      });
      var modelOutput = this.PROJECTS[projectid].model.predict(testTensor);
      modelOutput.data().then(function (output) {
        var targetColumns = project.columns.filter(function (col) {
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
  }, {
    key: "_defineModel",
    value: function _defineModel(numInputFeatures, numOutputLabels) {
      var regressionModel = tf.sequential();
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
  }, {
    key: "_getModelDbLocation",
    value: function _getModelDbLocation(projectid) {
      return 'indexeddb://ml4k-models-regression-' + projectid.toString().replaceAll('-', '');
    }
  }, {
    key: "_loadModel",
    value: function _loadModel(projectid) {
      var _this4 = this;
      console.log('[mlforkids] ML4KidsRegressionTraining loading model from browser storage');
      var loaded = false;
      if (this.PROJECTS[projectid].project.normalization) {
        var savelocation = this._getModelDbLocation(projectid);
        return tf.loadLayersModel(savelocation).then(function (storedModelInfo) {
          // TODO compare model with project info to check size is consistent
          if (storedModelInfo) {
            _this4.PROJECTS[projectid].normalization = {
              mean: tf.tensor(_this4.PROJECTS[projectid].project.normalization.mean),
              standardDeviation: tf.tensor(_this4.PROJECTS[projectid].project.normalization.standardDeviation)
            };
            _this4.PROJECTS[projectid].model = storedModelInfo.output;
            loaded = true;
          }
          return loaded;
        }).catch(function (err) {
          console.log('[mlforkids] ML4KidsRegressionTraining failed to load model from storage', err);
          return loaded;
        });
      } else {
        return Promise.resolve(loaded);
      }
    }
  }, {
    key: "_saveModel",
    value: function _saveModel(projectid) {
      console.log('[mlforkids] ML4KidsRegressionTraining saving model to browser storage');
      var savelocation = this._getModelDbLocation(projectid);
      return this.PROJECTS[projectid].model.save(savelocation).then(function (results) {
        console.log('[mlforkids] ML4KidsRegressionTraining saved model', savelocation, results);
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsRegressionTraining failed to save model', err);
      });
    }
  }, {
    key: "_watchForNewModels",
    value: function _watchForNewModels(projectid, worker) {
      if (!this.PROJECTS[projectid].modelWatcher) {
        console.log('[mlforkids] ML4KidsRegressionTraining listening for model updates', projectid);
        this.PROJECTS[projectid].modelWatcher = true;
        var modellocation = this._getModelDbLocation(projectid);
        this._storageSupport.registerForModelStorageUpdates(modellocation, function () {
          console.log('[mlforkids] ML4KidsRegressionTraining new model was trained');

          // worker.postMessage({
          //     mlforkidsregression: 'modelretrain',
          //     data: { projectid : projectid.toString() }
          // });
        });
      }
    }
  }]);
  return ML4KidsRegressionTraining;
}();
module.exports = ML4KidsRegressionTraining;

/***/ }),

/***/ "./node_modules/scratch-vm/src/mlforkids-components/sound/index.js":
/*!*************************************************************************!*\
  !*** ./node_modules/scratch-vm/src/mlforkids-components/sound/index.js ***!
  \*************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var ML4KidsSoundTraining = /*#__PURE__*/function () {
  // states:
  //   INIT - not ready yet
  //   READY - ready for training
  //   TRAINING - training in progress
  //   TRAINED - ML model ready for use
  //   LISTENING - ML model being used
  //   ERROR - something went wrong

  function ML4KidsSoundTraining(storageSupport) {
    _classCallCheck(this, ML4KidsSoundTraining);
    this.state = 'INIT';
    this.usingRestoredModel = false;
    this._storageSupport = storageSupport;
  }
  _createClass(ML4KidsSoundTraining, [{
    key: "init",
    value: function init(encprojectdata, worker) {
      var _this = this;
      // TODO this will break if there are multiple sound extensions open in Scratch - use multi-project approach from image-support class

      if (typeof encprojectdata === 'string') {
        if (encprojectdata[0] === '{') {
          // additional info for using indexeddb to store/load models
          var projectData = JSON.parse(encprojectdata);
          this.mlprojectid = projectData.projectid;
          this.mlprojectlabels = projectData.labels;
          this.mlprojectlabels.unshift('_background_noise_');
        } else {
          // project id only means new models can be created only
          this.mlprojectid = encprojectdata;
        }
      } else {
        // additional info for using indexeddb to store/load models
        this.mlprojectid = encprojectdata.projectid;
        this.mlprojectlabels = encprojectdata.labels;
        this.mlprojectlabels.unshift('_background_noise_');
      }
      tf.enableProdMode();
      this.stopListening = this.stopListening.bind(this);
      window.addEventListener('mlforkids-runtime-project-stop-all', this.stopListening);
      return this.loadSpeechCommands().then(function () {
        return _this.initSoundSupport(true, worker);
        // })
        // .then(() => {
        //     this._watchForNewModels(this.mlprojectid);
      });
    }
  }, {
    key: "loadSpeechCommands",
    value: function loadSpeechCommands() {
      var scriptid = 'mlforkids-script-speechcommands';
      var scripturl = 'https://machinelearningforkids.co.uk' + '/static/bower_components' + '/tensorflow-models/speech-commands-scratch' + '/speech-commands.min.js?v=117';
      return new Promise(function (resolve, reject) {
        if (document.getElementById(scriptid)) {
          return resolve();
        } else {
          var scriptObj = document.createElement('script');
          scriptObj.id = scriptid;
          scriptObj.type = 'text/javascript';
          scriptObj.src = scripturl;
          scriptObj.onload = resolve;
          scriptObj.onError = reject;
          document.head.appendChild(scriptObj);
        }
      });
    }
  }, {
    key: "prepareSoundService",
    value: function prepareSoundService(worker) {
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
  }, {
    key: "initSoundSupport",
    value: function initSoundSupport(loadModelIfAvailable, worker) {
      var _this2 = this;
      var siteUrl = 'https://machinelearningforkids.co.uk' + '/static/bower_components' + '/tensorflow-models/speech-commands-scratch';
      var vocab = null;
      var modelJson = siteUrl + '/model.json';
      var metadataJson = siteUrl + '/metadata.json';
      console.log('[mlforkids] Creating base recognizer');
      var baseRecognizer = speechCommands.create('BROWSER_FFT', vocab, modelJson, metadataJson);
      return baseRecognizer.ensureModelLoaded().then(function () {
        console.log('[mlforkids] Creating transfer learning model');
        _this2.transferRecognizer = baseRecognizer.createTransfer('project-' + _this2.mlprojectid);
        var modelInfo = _this2.transferRecognizer.modelInputShape();
        _this2.transferModelInfo = {
          numFrames: modelInfo[1],
          fftSize: modelInfo[2]
        };
        if (loadModelIfAvailable) {
          return _this2._loadModel(_this2.mlprojectid, _this2.mlprojectlabels, worker);
        }
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsSoundTraining failed init', err);
        _this2.state = 'ERROR';
        if (worker) {
          worker.postMessage({
            mlforkidssound: 'modelfailed'
          });
        }
      });
    }
  }, {
    key: "trainNewModelLocal",
    value: function trainNewModelLocal(projectinfo, worker) {
      var projectid = projectinfo.projectid;
      var that = this;
      return this._storageSupport.getTrainingData(projectid).then(function (data) {
        return that.trainNewModel(data, worker);
      });
    }
  }, {
    key: "trainNewModel",
    value: function trainNewModel(data, worker) {
      var _this3 = this;
      if (this.state === 'LISTENING') {
        this.stopListening();
      }
      if (this.state !== 'READY' && this.state !== 'TRAINED') {
        console.log('[mlforkids] ML4KidsSoundTraining not ready to train a new ML model - state : ' + this.state);
        return;
      }
      this.state = 'TRAINING';
      return this.prepareSoundService(worker).then(function () {
        _this3.transferRecognizer.dataset.clear();
        _this3.transferRecognizer.dataset.label2Ids = {};
        _this3.transferRecognizer.words = null;
        for (var i = 0; i < data.length; i++) {
          var trainingdataitem = data[i];
          _this3.transferRecognizer.dataset.addExample({
            label: trainingdataitem.label,
            spectrogram: {
              frameSize: _this3.transferModelInfo.fftSize,
              data: new Float32Array(trainingdataitem.audiodata)
            }
          });
        }
        _this3.transferRecognizer.collateTransferWords();
        return tf.nextFrame();
      }).then(function () {
        return _this3.transferRecognizer.train({
          epochs: 100
        });
      }).then(function () {
        _this3.state = 'TRAINED';
        _this3.usingRestoredModel = false;
        return _this3._saveModel(_this3.mlprojectid);
      }).then(function () {
        worker.postMessage({
          mlforkidssound: 'modelready'
        });
      }).catch(function (err) {
        _this3.state = 'ERROR';
        worker.postMessage({
          mlforkidssound: 'modelfailed'
        });
        console.log('[mlforkids] ML4KidsSoundTraining model training failed');
        console.log(err);
      });
    }
  }, {
    key: "startListening",
    value: function startListening(worker) {
      if (this.state !== 'TRAINED') {
        console.log('[mlforkids] ML4KidsSoundTraining not ready to listen - state : ' + this.state);
        return;
      }
      console.log('[mlforkids] startListening');
      try {
        var that = this;
        this.transferRecognizer.listen(function (result) {
          var matches = [];
          var labels = that.transferRecognizer.wordLabels();
          for (var i = 0; i < result.scores.length; i++) {
            matches.push({
              class_name: labels[i],
              confidence: result.scores[i] * 100
            });
          }
          matches.sort(function (a, b) {
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
  }, {
    key: "stopListening",
    value: function stopListening() {
      if (this.state !== 'LISTENING') {
        console.log('[mlforkids] ML4KidsSoundTraining not listening - state : ' + this.state);
        return;
      }
      console.log('[mlforkids] stopListening');
      try {
        this.transferRecognizer.stopListening();
        this.state = 'TRAINED';
      } catch (err) {
        this.state = 'ERROR';
        console.log('[mlforkids] ML4KidsSoundTraining failed to start listening');
        console.log(err);
      }
    }
  }, {
    key: "_getModelDbLocation",
    value: function _getModelDbLocation(projectid) {
      return 'indexeddb://ml4k-models-sounds-' + projectid.toString().replaceAll('-', '');
    }
  }, {
    key: "_saveModel",
    value: function _saveModel(projectid) {
      var _this4 = this;
      console.log('[mlforkids] ML4KidsSoundTraining saving model to browser storage');
      var savelocation = this._getModelDbLocation(projectid);
      this.transferRecognizer.save(savelocation).then(function (r) {
        console.log('[mlforkids] ML4KidsSoundTraining saved model', r);
        _this4._storeModelSavedDate(savelocation);
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsSoundTraining failed to save model', err);
      });
    }
  }, {
    key: "_storeModelSavedDate",
    value: function _storeModelSavedDate(modelid) {
      try {
        if (window.localStorage) {
          window.localStorage.setItem(modelid, Date.now());
        }
      } catch (err) {
        console.log('[mlforkids] ML4KidsSoundTraining unable to save model date');
      }
    }
  }, {
    key: "_loadModel",
    value: function _loadModel(projectid, labels, worker) {
      var _this5 = this;
      if (labels) {
        console.log('[mlforkids] ML4KidsSoundTraining loading model from browser storage');
        var savelocation = this._getModelDbLocation(projectid);
        return this.transferRecognizer.load(savelocation).then(function () {
          _this5.transferRecognizer.words = Array.from(labels).sort();
          console.log('[mlforkids] ML4KidsSoundTraining loaded model from storage');
          _this5.state = 'TRAINED';
          _this5.usingRestoredModel = true;
          if (worker) {
            worker.postMessage({
              mlforkidssound: 'modelready'
            });
          }
        }).catch(function (err) {
          console.log('[mlforkids] ML4KidsSoundTraining failed to load model from storage', err);
          _this5.state = 'READY';
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
  }]);
  return ML4KidsSoundTraining;
}();
module.exports = ML4KidsSoundTraining;

/***/ }),

/***/ "./node_modules/scratch-vm/src/mlforkids-components/storage/index.js":
/*!***************************************************************************!*\
  !*** ./node_modules/scratch-vm/src/mlforkids-components/storage/index.js ***!
  \***************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var ML4KidsLocalStorage = /*#__PURE__*/function () {
  function ML4KidsLocalStorage() {
    _classCallCheck(this, ML4KidsLocalStorage);
    // this.projectsDbHandle;
    this.PROJECTS_DB_NAME = 'mlforkidsLocalProjects';
    this.PROJECTS_TABLE = 'projects';
    this.trainingDataDatabases = {};
    this.TRAINING_DB_NAME_PREFIX = 'mlforkidsProject';
    this.TRAINING_TABLE = 'training';
  }

  //-----------------------------------------------------------
  //  common functions
  //-----------------------------------------------------------
  _createClass(ML4KidsLocalStorage, [{
    key: "promisifyIndexedDbRequest",
    value: function promisifyIndexedDbRequest(request) {
      return new Promise(function (resolve, reject) {
        request.onsuccess = resolve;
        request.onerror = reject;
      });
    }
  }, {
    key: "initProjectsDatabase",
    value: function initProjectsDatabase(event) {
      console.log('[ml4kstorage] initProjectsDatabase');
      event.target.result.createObjectStore(this.PROJECTS_TABLE, {
        keyPath: 'id',
        autoIncrement: true
      });
    }
  }, {
    key: "initTrainingDatabase",
    value: function initTrainingDatabase(event) {
      console.log('[ml4kstorage] initTrainingDatabase');
      var table = event.target.result.createObjectStore(this.TRAINING_TABLE, {
        keyPath: 'id',
        autoIncrement: true
      });
      table.createIndex('label', 'label', {
        unique: false
      });
    }
  }, {
    key: "getProjectsDatabase",
    value: function getProjectsDatabase() {
      console.log('[ml4kstorage] getProjectsDatabase');
      var request = window.indexedDB.open(this.PROJECTS_DB_NAME);
      request.onupgradeneeded = this.initProjectsDatabase;
      return this.promisifyIndexedDbRequest(request).then(function (event) {
        return event.target.result;
      });
    }
  }, {
    key: "getTrainingDatabase",
    value: function getTrainingDatabase(projectId) {
      console.log('[ml4kstorage] getTrainingDatabase');
      var request = window.indexedDB.open(this.TRAINING_DB_NAME_PREFIX + projectId);
      request.onupgradeneeded = this.initTrainingDatabase;
      return this.promisifyIndexedDbRequest(request).then(function (event) {
        return event.target.result;
      });
    }
  }, {
    key: "requiresProjectsDatabase",
    value: function () {
      var _requiresProjectsDatabase = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee() {
        var _this = this;
        return _regeneratorRuntime().wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              if (this.projectsDbHandle) {
                _context.next = 5;
                break;
              }
              _context.next = 3;
              return this.getProjectsDatabase();
            case 3:
              this.projectsDbHandle = _context.sent;
              this.projectsDbHandle.onclose = function () {
                console.log('[ml4kstorage] projects database closed');
                delete _this.projectsDbHandle;
              };
            case 5:
            case "end":
              return _context.stop();
          }
        }, _callee, this);
      }));
      function requiresProjectsDatabase() {
        return _requiresProjectsDatabase.apply(this, arguments);
      }
      return requiresProjectsDatabase;
    }()
  }, {
    key: "requiresTrainingDatabase",
    value: function () {
      var _requiresTrainingDatabase = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(projectId) {
        var _this2 = this;
        return _regeneratorRuntime().wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              if (this.trainingDataDatabases[projectId]) {
                _context2.next = 5;
                break;
              }
              _context2.next = 3;
              return this.getTrainingDatabase(projectId);
            case 3:
              this.trainingDataDatabases[projectId] = _context2.sent;
              this.trainingDataDatabases[projectId].onclose = function () {
                console.log('[ml4kstorage] training database closed', projectId);
                delete _this2.trainingDataDatabases[projectId];
              };
            case 5:
            case "end":
              return _context2.stop();
          }
        }, _callee2, this);
      }));
      function requiresTrainingDatabase(_x) {
        return _requiresTrainingDatabase.apply(this, arguments);
      }
      return requiresTrainingDatabase;
    }()
  }, {
    key: "requiresResult",
    value: function requiresResult(event) {
      if (event && event.target && event.target.result) {
        return event.target.result;
      }
      var notFoundErr = new Error('not found');
      notFoundErr.status = 404;
      notFoundErr.data = {
        error: 'not found'
      };
      throw notFoundErr;
    }
  }, {
    key: "requiresIntegerId",
    value: function requiresIntegerId(id) {
      return parseInt(id, 10);
    }

    //-----------------------------------------------------------
    //  PROJECTS database
    //-----------------------------------------------------------
  }, {
    key: "getProject",
    value: function () {
      var _getProject = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee3(projectId) {
        var _this3 = this;
        var transaction, request;
        return _regeneratorRuntime().wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              console.log('[ml4kstorage] getProject', projectId);
              _context3.next = 3;
              return this.requiresProjectsDatabase();
            case 3:
              transaction = this.projectsDbHandle.transaction([this.PROJECTS_TABLE], 'readonly');
              request = transaction.objectStore(this.PROJECTS_TABLE).get(this.requiresIntegerId(projectId));
              return _context3.abrupt("return", this.promisifyIndexedDbRequest(request).then(function (event) {
                return _this3.requiresResult(event);
              }));
            case 6:
            case "end":
              return _context3.stop();
          }
        }, _callee3, this);
      }));
      function getProject(_x2) {
        return _getProject.apply(this, arguments);
      }
      return getProject;
    }() //-----------------------------------------------------------
    //  TRAINING DATA store
    //-----------------------------------------------------------
  }, {
    key: "getTrainingData",
    value: function () {
      var _getTrainingData = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee4(projectId) {
        var transaction, request;
        return _regeneratorRuntime().wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              console.log('[ml4kstorage] getTrainingData', projectId);
              _context4.next = 3;
              return this.requiresTrainingDatabase(projectId);
            case 3:
              transaction = this.trainingDataDatabases[projectId].transaction([this.TRAINING_TABLE], 'readonly');
              request = transaction.objectStore(this.TRAINING_TABLE).getAll();
              return _context4.abrupt("return", this.promisifyIndexedDbRequest(request).then(function (event) {
                return event.target.result;
              }));
            case 6:
            case "end":
              return _context4.stop();
          }
        }, _callee4, this);
      }));
      function getTrainingData(_x3) {
        return _getTrainingData.apply(this, arguments);
      }
      return getTrainingData;
    }()
  }, {
    key: "addTrainingData",
    value: function () {
      var _addTrainingData = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee5(projectId, trainingObject) {
        var _this4 = this;
        var transaction, request;
        return _regeneratorRuntime().wrap(function _callee5$(_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              console.log('[ml4kstorage] addTrainingData');
              _context5.next = 3;
              return this.requiresTrainingDatabase(projectId);
            case 3:
              transaction = this.trainingDataDatabases[projectId].transaction([this.TRAINING_TABLE], 'readwrite');
              request = transaction.objectStore(this.TRAINING_TABLE).add(trainingObject);
              return _context5.abrupt("return", this.promisifyIndexedDbRequest(request).then(function (event) {
                trainingObject.id = event.target.result;
                if (trainingObject.label) {
                  _this4.addLabel(projectId, trainingObject.label);
                }
                return trainingObject;
              }));
            case 6:
            case "end":
              return _context5.stop();
          }
        }, _callee5, this);
      }));
      function addTrainingData(_x4, _x5) {
        return _addTrainingData.apply(this, arguments);
      }
      return addTrainingData;
    }() // update labels to meet WA requirements
  }, {
    key: "sanitizeLabel",
    value: function sanitizeLabel(proposedlabel) {
      return proposedlabel.replace(/[^\w.]/g, '_').substring(0, 30);
    }
  }, {
    key: "addLabel",
    value: function () {
      var _addLabel = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee6(projectId, newlabel) {
        var label, transaction, projectsTable, readRequest, readEvent, projectObject, updateRequest;
        return _regeneratorRuntime().wrap(function _callee6$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              console.log('[ml4kstorage] addLabel');
              _context6.next = 3;
              return this.requiresProjectsDatabase();
            case 3:
              label = newlabel;
              try {
                label = this.sanitizeLabel(newlabel);
              } catch (labelErr) {
                console.error('[ml4kstorage] Failed to sanitize label, leaving as-is');
              }
              transaction = this.projectsDbHandle.transaction([this.PROJECTS_TABLE], 'readwrite');
              projectsTable = transaction.objectStore(this.PROJECTS_TABLE);
              readRequest = projectsTable.get(this.requiresIntegerId(projectId));
              _context6.next = 10;
              return this.promisifyIndexedDbRequest(readRequest);
            case 10:
              readEvent = _context6.sent;
              projectObject = this.requiresResult(readEvent);
              if (projectObject.labels.includes(label)) {
                _context6.next = 17;
                break;
              }
              projectObject.labels.push(label);
              updateRequest = projectsTable.put(projectObject);
              _context6.next = 17;
              return this.promisifyIndexedDbRequest(updateRequest);
            case 17:
            case "end":
              return _context6.stop();
          }
        }, _callee6, this);
      }));
      function addLabel(_x6, _x7) {
        return _addLabel.apply(this, arguments);
      }
      return addLabel;
    }()
  }, {
    key: "getTrainingForWatsonAssistant",
    value: function getTrainingForWatsonAssistant(project) {
      return this.getTrainingData(project.id).then(function (allTraining) {
        var trainingByLabel = {};
        var _iterator = _createForOfIteratorHelper(allTraining),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var item = _step.value;
            var label = item.label;
            var text = item.textdata;
            if (!(label in trainingByLabel)) {
              trainingByLabel[label] = {
                intent: label.replace(/\s/g, '_'),
                examples: []
              };
            }
            trainingByLabel[label].examples.push({
              text: text
            });
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
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
      });
    }
  }, {
    key: "storeBase64EncodedImage",
    value: function storeBase64EncodedImage(projectid, label, b64imgdata) {
      var _that = this;
      return fetch("data:image/jpeg;base64,".concat(b64imgdata)).then(function (converted) {
        return converted.blob();
      }).then(function (imagedata) {
        _that.addTrainingData(projectid, {
          imagedata: imagedata,
          label: label,
          isstored: true
        });
      });
    }
  }, {
    key: "registerForModelStorageUpdates",
    value: function registerForModelStorageUpdates(modelid, callback) {
      window.addEventListener('storage', function (evt) {
        if (evt.key === modelid) {
          callback();
        }
      });
    }
  }]);
  return ML4KidsLocalStorage;
}();
module.exports = ML4KidsLocalStorage;

/***/ }),

/***/ "./node_modules/scratch-vm/src/mlforkids-components/tensorflow/index.js":
/*!******************************************************************************!*\
  !*** ./node_modules/scratch-vm/src/mlforkids-components/tensorflow/index.js ***!
  \******************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var ML4KidsTensorFlow = /*#__PURE__*/function () {
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

  function ML4KidsTensorFlow() {
    _classCallCheck(this, ML4KidsTensorFlow);
    this.PROJECTS = {};
    this.state = 'INIT';
    tf.enableProdMode();
  }

  // encprojectdata
  // JSON.stringify-ed version of
  //   { projectid : someprojectid, labels : [ labelA, labelB, labelC ], dataType : IMAGE, modelurl : http://somedomain... }
  _createClass(ML4KidsTensorFlow, [{
    key: "initProject",
    value: function initProject(encprojectdata, worker) {
      var _this = this;
      var projectData = JSON.parse(encprojectdata);
      var projectid = projectData.projectid;
      var modellocation = projectData.modelurl;
      console.log('[mlforkids] Initializing project', projectid, projectData);
      this.PROJECTS[projectid] = {};
      this.PROJECTS[projectid].state = 'INIT';
      this.PROJECTS[projectid].modelClasses = projectData.labels;
      this.PROJECTS[projectid].modelNumClasses = projectData.labels.length;
      this.PROJECTS[projectid].dataType = projectData.dataType;
      var loadModelPromise;
      if (this.PROJECTS[projectid].dataType === 'graphdefimage') {
        var loadModelOptions = {};
        if (modellocation.startsWith('https://tfhub.dev')) {
          loadModelOptions.fromTFHub = true;
        }
        if (this.urlEndsWith(modellocation, '/model.json')) {
          modellocation = modellocation.substr(0, modellocation.length - '/model.json'.length);
        }
        console.log('[mlforkids] loading graph model', modellocation, loadModelOptions);
        loadModelPromise = tf.loadGraphModel(modellocation, loadModelOptions);
      } else if (this.PROJECTS[projectid].dataType === 'teachablemachinepose') {
        console.log('[mlforkids] loading pose model iframe');
        loadModelPromise = this._loadPoseModelSupport().then(function (iframe) {
          _this.teachableMachinePoseIframe = iframe;
          var metadataJsonUrl = modellocation.replace(/model\.json$/, 'metadata.json');
          return iframe.contentWindow.initModel(projectid, modellocation, metadataJsonUrl);
        });
      } else {
        console.log('[mlforkids] loading layers model', modellocation);
        loadModelPromise = tf.loadLayersModel(modellocation);
      }
      return loadModelPromise.then(function (model) {
        _this.PROJECTS[projectid].model = model;
        _this.PROJECTS[projectid].state = 'TRAINED';
        worker.postMessage({
          mlforkidstensorflow: 'modelready',
          data: {
            projectid: projectid
          }
        });
      }).catch(function (err) {
        console.log('[mlforkids] ML4KidsTensorFlow failed init', err);
        _this.PROJECTS[projectid].state = 'ERROR';
        worker.postMessage({
          mlforkidstensorflow: 'modelfailed',
          data: {
            projectid: projectid
          }
        });
      });
    }
  }, {
    key: "urlEndsWith",
    value: function urlEndsWith(urlToCheck, stringToCheck) {
      return urlToCheck.length === urlToCheck.indexOf(stringToCheck) + stringToCheck.length;
    }
  }, {
    key: "sortByConfidence",
    value: function sortByConfidence(a, b) {
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
  }, {
    key: "classifyData",
    value: function classifyData(encrequest, worker) {
      var _this2 = this;
      var requestData = JSON.parse(encrequest);
      var projectid = requestData.projectid;
      var requestid = requestData.requestid;
      return this._prepareDataForClassification(projectid, requestData.requestdata).then(function (dataToClassify) {
        if (_this2.PROJECTS[projectid].dataType === 'teachablemachinepose') {
          return _this2.teachableMachinePoseIframe.contentWindow.predict(projectid, dataToClassify);
        } else {
          return _this2.PROJECTS[projectid].model.predict(dataToClassify).data();
        }
      }).then(function (output) {
        var matches;
        if (_this2.PROJECTS[projectid].dataType === 'teachablemachinepose') {
          matches = output.sort(_this2.sortByConfidence);
        } else {
          if (_this2.PROJECTS[projectid].modelNumClasses > 0) {
            matches = _this2.PROJECTS[projectid].modelClasses.map(function (label, idx) {
              return {
                class_name: label,
                confidence: 100 * output[idx]
              };
            }).sort(_this2.sortByConfidence);
          } else {
            // label names aren't known, so we just have to refer to them by idx
            var anonScores = new Array(output.length);
            for (var idx = 0; idx < output.length; idx++) {
              anonScores[idx] = {
                class_name: 'label ' + idx,
                confidence: 100 * output[idx]
              };
            }
            matches = anonScores.sort(_this2.sortByConfidence);
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
      }).catch(function (err) {
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
  }, {
    key: "_prepareDataForClassification",
    value: function _prepareDataForClassification(projectid, classifydata) {
      var _this3 = this;
      return new Promise(function (resolve, reject) {
        if (projectid in _this3.PROJECTS) {
          if (_this3.PROJECTS[projectid].state !== 'TRAINED') {
            console.log('[mlforkids] ML4KidsTensorFlow received classify request before a model is ready');
            return reject();
          }
          if (_this3.PROJECTS[projectid].dataType === 'teachablemachineimage' || _this3.PROJECTS[projectid].dataType === 'graphdefimage') {
            var imageElement = document.createElement('img');
            imageElement.width = 224;
            imageElement.height = 224;
            imageElement.onerror = function (err) {
              console.log('[mlforkids] ML4KidsTensorFlow failed to prepare image data for prediction', err);
              return reject();
            };
            imageElement.onload = function () {
              return resolve(tf.tidy(function () {
                return tf.browser.fromPixels(imageElement).expandDims(0).toFloat().div(127).sub(1);
              }));
            };
            imageElement.src = 'data:image/jpeg;base64,' + classifydata;
          } else if (_this3.PROJECTS[projectid].dataType === 'teachablemachinepose') {
            _this3.teachableMachinePoseIframe.contentWindow.createImage(classifydata, resolve);
          } else {
            return resolve(classifydata);
          }
        } else {
          console.log('[mlforkids] ML4KidsTensorFlow received request for unknown project');
          return reject();
        }
      });
    }
  }, {
    key: "_loadPoseModelSupport",
    value: function _loadPoseModelSupport() {
      return new Promise(function (resolve) {
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
          iframeObj.onload = function () {
            resolve(iframeObj);
          };
          document.head.appendChild(iframeObj);
        }
      });
    }
  }]);
  return ML4KidsTensorFlow;
}();
module.exports = ML4KidsTensorFlow;

/***/ }),

/***/ "./node_modules/scratch-vm/src/util/log.js":
/*!*************************************************!*\
  !*** ./node_modules/scratch-vm/src/util/log.js ***!
  \*************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var minilog = __webpack_require__(/*! minilog */ "./node_modules/scratch-vm/node_modules/minilog/lib/web/index.js");
minilog.enable();
module.exports = minilog('vm');

/***/ }),

/***/ "./node_modules/webpack/buildin/global.js":
/*!***********************************!*\
  !*** (webpack)/buildin/global.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || new Function("return this")();
} catch (e) {
	// This works if the window reference is available
	if (typeof window === "object") g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ })

/******/ });
//# sourceMappingURL=extension-worker.js.map