(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ANIMUS Android App/node_modules/requires-port/index.js
  var require_requires_port = __commonJS({
    "ANIMUS Android App/node_modules/requires-port/index.js"(exports, module) {
      "use strict";
      module.exports = function required(port, protocol) {
        protocol = protocol.split(":")[0];
        port = +port;
        if (!port) return false;
        switch (protocol) {
          case "http":
          case "ws":
            return port !== 80;
          case "https":
          case "wss":
            return port !== 443;
          case "ftp":
            return port !== 21;
          case "gopher":
            return port !== 70;
          case "file":
            return false;
        }
        return port !== 0;
      };
    }
  });

  // ANIMUS Android App/node_modules/querystringify/index.js
  var require_querystringify = __commonJS({
    "ANIMUS Android App/node_modules/querystringify/index.js"(exports) {
      "use strict";
      var has = Object.prototype.hasOwnProperty;
      var undef;
      function decode2(input) {
        try {
          return decodeURIComponent(input.replace(/\+/g, " "));
        } catch (e) {
          return null;
        }
      }
      function encode2(input) {
        try {
          return encodeURIComponent(input);
        } catch (e) {
          return null;
        }
      }
      function querystring(query) {
        var parser = /([^=?#&]+)=?([^&]*)/g, result = {}, part;
        while (part = parser.exec(query)) {
          var key = decode2(part[1]), value = decode2(part[2]);
          if (key === null || value === null || key in result) continue;
          result[key] = value;
        }
        return result;
      }
      function querystringify(obj, prefix) {
        prefix = prefix || "";
        var pairs = [], value, key;
        if ("string" !== typeof prefix) prefix = "?";
        for (key in obj) {
          if (has.call(obj, key)) {
            value = obj[key];
            if (!value && (value === null || value === undef || isNaN(value))) {
              value = "";
            }
            key = encode2(key);
            value = encode2(value);
            if (key === null || value === null) continue;
            pairs.push(key + "=" + value);
          }
        }
        return pairs.length ? prefix + pairs.join("&") : "";
      }
      exports.stringify = querystringify;
      exports.parse = querystring;
    }
  });

  // ANIMUS Android App/node_modules/url-parse/index.js
  var require_url_parse = __commonJS({
    "ANIMUS Android App/node_modules/url-parse/index.js"(exports, module) {
      "use strict";
      var required = require_requires_port();
      var qs = require_querystringify();
      var controlOrWhitespace = /^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;
      var CRHTLF = /[\n\r\t]/g;
      var slashes = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//;
      var port = /:\d+$/;
      var protocolre = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\\/]+)?([\S\s]*)/i;
      var windowsDriveLetter = /^[a-zA-Z]:/;
      function trimLeft(str) {
        return (str ? str : "").toString().replace(controlOrWhitespace, "");
      }
      var rules = [
        ["#", "hash"],
        // Extract from the back.
        ["?", "query"],
        // Extract from the back.
        function sanitize(address, url) {
          return isSpecial(url.protocol) ? address.replace(/\\/g, "/") : address;
        },
        ["/", "pathname"],
        // Extract from the back.
        ["@", "auth", 1],
        // Extract from the front.
        [NaN, "host", void 0, 1, 1],
        // Set left over value.
        [/:(\d*)$/, "port", void 0, 1],
        // RegExp the back.
        [NaN, "hostname", void 0, 1, 1]
        // Set left over.
      ];
      var ignore = { hash: 1, query: 1 };
      function lolcation(loc) {
        var globalVar;
        if (typeof window !== "undefined") globalVar = window;
        else if (typeof global !== "undefined") globalVar = global;
        else if (typeof self !== "undefined") globalVar = self;
        else globalVar = {};
        var location = globalVar.location || {};
        loc = loc || location;
        var finaldestination = {}, type = typeof loc, key;
        if ("blob:" === loc.protocol) {
          finaldestination = new Url(unescape(loc.pathname), {});
        } else if ("string" === type) {
          finaldestination = new Url(loc, {});
          for (key in ignore) delete finaldestination[key];
        } else if ("object" === type) {
          for (key in loc) {
            if (key in ignore) continue;
            finaldestination[key] = loc[key];
          }
          if (finaldestination.slashes === void 0) {
            finaldestination.slashes = slashes.test(loc.href);
          }
        }
        return finaldestination;
      }
      function isSpecial(scheme) {
        return scheme === "file:" || scheme === "ftp:" || scheme === "http:" || scheme === "https:" || scheme === "ws:" || scheme === "wss:";
      }
      function extractProtocol(address, location) {
        address = trimLeft(address);
        address = address.replace(CRHTLF, "");
        location = location || {};
        var match = protocolre.exec(address);
        var protocol = match[1] ? match[1].toLowerCase() : "";
        var forwardSlashes = !!match[2];
        var otherSlashes = !!match[3];
        var slashesCount = 0;
        var rest;
        if (forwardSlashes) {
          if (otherSlashes) {
            rest = match[2] + match[3] + match[4];
            slashesCount = match[2].length + match[3].length;
          } else {
            rest = match[2] + match[4];
            slashesCount = match[2].length;
          }
        } else {
          if (otherSlashes) {
            rest = match[3] + match[4];
            slashesCount = match[3].length;
          } else {
            rest = match[4];
          }
        }
        if (protocol === "file:") {
          if (slashesCount >= 2) {
            rest = rest.slice(2);
          }
        } else if (isSpecial(protocol)) {
          rest = match[4];
        } else if (protocol) {
          if (forwardSlashes) {
            rest = rest.slice(2);
          }
        } else if (slashesCount >= 2 && isSpecial(location.protocol)) {
          rest = match[4];
        }
        return {
          protocol,
          slashes: forwardSlashes || isSpecial(protocol),
          slashesCount,
          rest
        };
      }
      function resolve(relative, base) {
        if (relative === "") return base;
        var path = (base || "/").split("/").slice(0, -1).concat(relative.split("/")), i = path.length, last = path[i - 1], unshift = false, up = 0;
        while (i--) {
          if (path[i] === ".") {
            path.splice(i, 1);
          } else if (path[i] === "..") {
            path.splice(i, 1);
            up++;
          } else if (up) {
            if (i === 0) unshift = true;
            path.splice(i, 1);
            up--;
          }
        }
        if (unshift) path.unshift("");
        if (last === "." || last === "..") path.push("");
        return path.join("/");
      }
      function Url(address, location, parser) {
        address = trimLeft(address);
        address = address.replace(CRHTLF, "");
        if (!(this instanceof Url)) {
          return new Url(address, location, parser);
        }
        var relative, extracted, parse, instruction, index, key, instructions = rules.slice(), type = typeof location, url = this, i = 0;
        if ("object" !== type && "string" !== type) {
          parser = location;
          location = null;
        }
        if (parser && "function" !== typeof parser) parser = qs.parse;
        location = lolcation(location);
        extracted = extractProtocol(address || "", location);
        relative = !extracted.protocol && !extracted.slashes;
        url.slashes = extracted.slashes || relative && location.slashes;
        url.protocol = extracted.protocol || location.protocol || "";
        address = extracted.rest;
        if (extracted.protocol === "file:" && (extracted.slashesCount !== 2 || windowsDriveLetter.test(address)) || !extracted.slashes && (extracted.protocol || extracted.slashesCount < 2 || !isSpecial(url.protocol))) {
          instructions[3] = [/(.*)/, "pathname"];
        }
        for (; i < instructions.length; i++) {
          instruction = instructions[i];
          if (typeof instruction === "function") {
            address = instruction(address, url);
            continue;
          }
          parse = instruction[0];
          key = instruction[1];
          if (parse !== parse) {
            url[key] = address;
          } else if ("string" === typeof parse) {
            index = parse === "@" ? address.lastIndexOf(parse) : address.indexOf(parse);
            if (~index) {
              if ("number" === typeof instruction[2]) {
                url[key] = address.slice(0, index);
                address = address.slice(index + instruction[2]);
              } else {
                url[key] = address.slice(index);
                address = address.slice(0, index);
              }
            }
          } else if (index = parse.exec(address)) {
            url[key] = index[1];
            address = address.slice(0, index.index);
          }
          url[key] = url[key] || (relative && instruction[3] ? location[key] || "" : "");
          if (instruction[4]) url[key] = url[key].toLowerCase();
        }
        if (parser) url.query = parser(url.query);
        if (relative && location.slashes && url.pathname.charAt(0) !== "/" && (url.pathname !== "" || location.pathname !== "")) {
          url.pathname = resolve(url.pathname, location.pathname);
        }
        if (url.pathname.charAt(0) !== "/" && isSpecial(url.protocol)) {
          url.pathname = "/" + url.pathname;
        }
        if (!required(url.port, url.protocol)) {
          url.host = url.hostname;
          url.port = "";
        }
        url.username = url.password = "";
        if (url.auth) {
          index = url.auth.indexOf(":");
          if (~index) {
            url.username = url.auth.slice(0, index);
            url.username = encodeURIComponent(decodeURIComponent(url.username));
            url.password = url.auth.slice(index + 1);
            url.password = encodeURIComponent(decodeURIComponent(url.password));
          } else {
            url.username = encodeURIComponent(decodeURIComponent(url.auth));
          }
          url.auth = url.password ? url.username + ":" + url.password : url.username;
        }
        url.origin = url.protocol !== "file:" && isSpecial(url.protocol) && url.host ? url.protocol + "//" + url.host : "null";
        url.href = url.toString();
      }
      function set(part, value, fn) {
        var url = this;
        switch (part) {
          case "query":
            if ("string" === typeof value && value.length) {
              value = (fn || qs.parse)(value);
            }
            url[part] = value;
            break;
          case "port":
            url[part] = value;
            if (!required(value, url.protocol)) {
              url.host = url.hostname;
              url[part] = "";
            } else if (value) {
              url.host = url.hostname + ":" + value;
            }
            break;
          case "hostname":
            url[part] = value;
            if (url.port) value += ":" + url.port;
            url.host = value;
            break;
          case "host":
            url[part] = value;
            if (port.test(value)) {
              value = value.split(":");
              url.port = value.pop();
              url.hostname = value.join(":");
            } else {
              url.hostname = value;
              url.port = "";
            }
            break;
          case "protocol":
            url.protocol = value.toLowerCase();
            url.slashes = !fn;
            break;
          case "pathname":
          case "hash":
            if (value) {
              var char = part === "pathname" ? "/" : "#";
              url[part] = value.charAt(0) !== char ? char + value : value;
            } else {
              url[part] = value;
            }
            break;
          case "username":
          case "password":
            url[part] = encodeURIComponent(value);
            break;
          case "auth":
            var index = value.indexOf(":");
            if (~index) {
              url.username = value.slice(0, index);
              url.username = encodeURIComponent(decodeURIComponent(url.username));
              url.password = value.slice(index + 1);
              url.password = encodeURIComponent(decodeURIComponent(url.password));
            } else {
              url.username = encodeURIComponent(decodeURIComponent(value));
            }
        }
        for (var i = 0; i < rules.length; i++) {
          var ins = rules[i];
          if (ins[4]) url[ins[1]] = url[ins[1]].toLowerCase();
        }
        url.auth = url.password ? url.username + ":" + url.password : url.username;
        url.origin = url.protocol !== "file:" && isSpecial(url.protocol) && url.host ? url.protocol + "//" + url.host : "null";
        url.href = url.toString();
        return url;
      }
      function toString(stringify) {
        if (!stringify || "function" !== typeof stringify) stringify = qs.stringify;
        var query, url = this, host = url.host, protocol = url.protocol;
        if (protocol && protocol.charAt(protocol.length - 1) !== ":") protocol += ":";
        var result = protocol + (url.protocol && url.slashes || isSpecial(url.protocol) ? "//" : "");
        if (url.username) {
          result += url.username;
          if (url.password) result += ":" + url.password;
          result += "@";
        } else if (url.password) {
          result += ":" + url.password;
          result += "@";
        } else if (url.protocol !== "file:" && isSpecial(url.protocol) && !host && url.pathname !== "/") {
          result += "@";
        }
        if (host[host.length - 1] === ":" || port.test(url.hostname) && !url.port) {
          host += ":";
        }
        result += host + url.pathname;
        query = "object" === typeof url.query ? stringify(url.query) : url.query;
        if (query) result += "?" !== query.charAt(0) ? "?" + query : query;
        if (url.hash) result += url.hash;
        return result;
      }
      Url.prototype = { set, toString };
      Url.extractProtocol = extractProtocol;
      Url.location = lolcation;
      Url.trimLeft = trimLeft;
      Url.qs = qs;
      module.exports = Url;
    }
  });

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/error.js
  function _typeof(o) {
    "@babel/helpers - typeof";
    return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof(o);
  }
  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey(t) {
    var i = _toPrimitive(t, "string");
    return "symbol" == _typeof(i) ? i : i + "";
  }
  function _toPrimitive(t, r) {
    if ("object" != _typeof(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _callSuper(t, o, e) {
    return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e));
  }
  function _possibleConstructorReturn(self2, call) {
    if (call && (_typeof(call) === "object" || typeof call === "function")) {
      return call;
    } else if (call !== void 0) {
      throw new TypeError("Derived constructors may only return object or undefined");
    }
    return _assertThisInitialized(self2);
  }
  function _assertThisInitialized(self2) {
    if (self2 === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self2;
  }
  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } });
    Object.defineProperty(subClass, "prototype", { writable: false });
    if (superClass) _setPrototypeOf(subClass, superClass);
  }
  function _wrapNativeSuper(Class) {
    var _cache = typeof Map === "function" ? /* @__PURE__ */ new Map() : void 0;
    _wrapNativeSuper = function _wrapNativeSuper2(Class2) {
      if (Class2 === null || !_isNativeFunction(Class2)) return Class2;
      if (typeof Class2 !== "function") {
        throw new TypeError("Super expression must either be null or a function");
      }
      if (typeof _cache !== "undefined") {
        if (_cache.has(Class2)) return _cache.get(Class2);
        _cache.set(Class2, Wrapper);
      }
      function Wrapper() {
        return _construct(Class2, arguments, _getPrototypeOf(this).constructor);
      }
      Wrapper.prototype = Object.create(Class2.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } });
      return _setPrototypeOf(Wrapper, Class2);
    };
    return _wrapNativeSuper(Class);
  }
  function _construct(t, e, r) {
    if (_isNativeReflectConstruct()) return Reflect.construct.apply(null, arguments);
    var o = [null];
    o.push.apply(o, e);
    var p = new (t.bind.apply(t, o))();
    return r && _setPrototypeOf(p, r.prototype), p;
  }
  function _isNativeReflectConstruct() {
    try {
      var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
      }));
    } catch (t2) {
    }
    return (_isNativeReflectConstruct = function _isNativeReflectConstruct3() {
      return !!t;
    })();
  }
  function _isNativeFunction(fn) {
    try {
      return Function.toString.call(fn).indexOf("[native code]") !== -1;
    } catch (e) {
      return typeof fn === "function";
    }
  }
  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf3(o2, p2) {
      o2.__proto__ = p2;
      return o2;
    };
    return _setPrototypeOf(o, p);
  }
  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf3(o2) {
      return o2.__proto__ || Object.getPrototypeOf(o2);
    };
    return _getPrototypeOf(o);
  }
  var DetailedError = /* @__PURE__ */ (function(_Error) {
    function DetailedError2(message2) {
      var _this;
      var causingErr = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
      var req = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : null;
      var res = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : null;
      _classCallCheck(this, DetailedError2);
      _this = _callSuper(this, DetailedError2, [message2]);
      _this.originalRequest = req;
      _this.originalResponse = res;
      _this.causingError = causingErr;
      if (causingErr != null) {
        message2 += ", caused by ".concat(causingErr.toString());
      }
      if (req != null) {
        var requestId = req.getHeader("X-Request-ID") || "n/a";
        var method = req.getMethod();
        var url = req.getURL();
        var status = res ? res.getStatus() : "n/a";
        var body = res ? res.getBody() || "" : "n/a";
        message2 += ", originated from request (method: ".concat(method, ", url: ").concat(url, ", response code: ").concat(status, ", response text: ").concat(body, ", request id: ").concat(requestId, ")");
      }
      _this.message = message2;
      return _this;
    }
    _inherits(DetailedError2, _Error);
    return _createClass(DetailedError2);
  })(/* @__PURE__ */ _wrapNativeSuper(Error));
  var error_default = DetailedError;

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/logger.js
  var isEnabled = false;
  function log(msg) {
    if (!isEnabled) return;
    console.log(msg);
  }

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/noopUrlStorage.js
  function _typeof2(o) {
    "@babel/helpers - typeof";
    return _typeof2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof2(o);
  }
  function _classCallCheck2(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties2(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey2(descriptor.key), descriptor);
    }
  }
  function _createClass2(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties2(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties2(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey2(t) {
    var i = _toPrimitive2(t, "string");
    return "symbol" == _typeof2(i) ? i : i + "";
  }
  function _toPrimitive2(t, r) {
    if ("object" != _typeof2(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof2(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var NoopUrlStorage = /* @__PURE__ */ (function() {
    function NoopUrlStorage2() {
      _classCallCheck2(this, NoopUrlStorage2);
    }
    return _createClass2(NoopUrlStorage2, [{
      key: "listAllUploads",
      value: function listAllUploads() {
        return Promise.resolve([]);
      }
    }, {
      key: "findUploadsByFingerprint",
      value: function findUploadsByFingerprint(_fingerprint) {
        return Promise.resolve([]);
      }
    }, {
      key: "removeUpload",
      value: function removeUpload(_urlStorageKey) {
        return Promise.resolve();
      }
    }, {
      key: "addUpload",
      value: function addUpload(_fingerprint, _upload) {
        return Promise.resolve(null);
      }
    }]);
  })();

  // ANIMUS Android App/node_modules/js-base64/base64.mjs
  var version = "3.9.4";
  var VERSION = version;
  var _TD = typeof TextDecoder === "function" ? new TextDecoder("utf-8", { ignoreBOM: true }) : void 0;
  var _TE = typeof TextEncoder === "function" ? new TextEncoder() : void 0;
  var b64ch = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var b64chs = Array.prototype.slice.call(b64ch);
  var b64tab = ((a) => {
    let tab = {};
    a.forEach((c, i) => tab[c] = i);
    return tab;
  })(b64chs);
  var b64re = /^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/;
  var _fromCC = String.fromCharCode.bind(String);
  var _U8Afrom = typeof Uint8Array.from === "function" ? Uint8Array.from.bind(Uint8Array) : (it) => new Uint8Array(Array.prototype.slice.call(it, 0));
  var _mkUriSafe = (src) => src.replace(/=/g, "").replace(/[+\/]/g, (m0) => m0 == "+" ? "-" : "_");
  var _tidyB64 = (s) => s.replace(/[^A-Za-z0-9\+\/]/g, "");
  var btoaPolyfill = (bin) => {
    let u32, c0, c1, c2, asc = "";
    const pad = bin.length % 3;
    for (let i = 0; i < bin.length; ) {
      if ((c0 = bin.charCodeAt(i++)) > 255 || (c1 = bin.charCodeAt(i++)) > 255 || (c2 = bin.charCodeAt(i++)) > 255)
        throw new TypeError("invalid character found");
      u32 = c0 << 16 | c1 << 8 | c2;
      asc += b64chs[u32 >> 18 & 63] + b64chs[u32 >> 12 & 63] + b64chs[u32 >> 6 & 63] + b64chs[u32 & 63];
    }
    return pad ? asc.slice(0, pad - 3) + "===".substring(pad) : asc;
  };
  var _btoa = typeof btoa === "function" ? (bin) => btoa(bin) : btoaPolyfill;
  var _fromUint8Array = typeof Uint8Array.prototype.toBase64 === "function" ? (u8a) => u8a.toBase64() : (u8a) => {
    const maxargs = 4096;
    let strs = [];
    for (let i = 0, l = u8a.length; i < l; i += maxargs) {
      strs.push(_fromCC.apply(null, u8a.subarray(i, i + maxargs)));
    }
    return _btoa(strs.join(""));
  };
  var fromUint8Array = (u8a, urlsafe = false) => urlsafe ? _mkUriSafe(_fromUint8Array(u8a)) : _fromUint8Array(u8a);
  var cb_utob = (c) => {
    if (c.length < 2) {
      var cc = c.charCodeAt(0);
      return cc < 128 ? c : cc < 2048 ? _fromCC(192 | cc >>> 6) + _fromCC(128 | cc & 63) : _fromCC(224 | cc >>> 12 & 15) + _fromCC(128 | cc >>> 6 & 63) + _fromCC(128 | cc & 63);
    } else {
      var cc = 65536 + (c.charCodeAt(0) - 55296) * 1024 + (c.charCodeAt(1) - 56320);
      return _fromCC(240 | cc >>> 18 & 7) + _fromCC(128 | cc >>> 12 & 63) + _fromCC(128 | cc >>> 6 & 63) + _fromCC(128 | cc & 63);
    }
  };
  var re_utob = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g;
  var utob = (u) => u.replace(re_utob, cb_utob);
  var _encode = _TE ? (s) => _fromUint8Array(_TE.encode(s)) : (s) => _btoa(utob(s));
  var encode = (src, urlsafe = false) => urlsafe ? _mkUriSafe(_encode(src)) : _encode(src);
  var encodeURI = (src) => encode(src, true);
  var re_btou = /[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g;
  var cb_btou = (cccc) => {
    switch (cccc.length) {
      case 4:
        var cp = (7 & cccc.charCodeAt(0)) << 18 | (63 & cccc.charCodeAt(1)) << 12 | (63 & cccc.charCodeAt(2)) << 6 | 63 & cccc.charCodeAt(3), offset = cp - 65536;
        return _fromCC((offset >>> 10) + 55296) + _fromCC((offset & 1023) + 56320);
      case 3:
        return _fromCC((15 & cccc.charCodeAt(0)) << 12 | (63 & cccc.charCodeAt(1)) << 6 | 63 & cccc.charCodeAt(2));
      default:
        return _fromCC((31 & cccc.charCodeAt(0)) << 6 | 63 & cccc.charCodeAt(1));
    }
  };
  var btou = (b) => b.replace(re_btou, cb_btou);
  var atobPolyfill = (asc) => {
    asc = asc.replace(/\s+/g, "");
    if (!b64re.test(asc))
      throw new TypeError("malformed base64.");
    asc += "==".slice(2 - (asc.length & 3));
    let u24, r1, r2;
    let binArray = [];
    for (let i = 0; i < asc.length; ) {
      u24 = b64tab[asc.charAt(i++)] << 18 | b64tab[asc.charAt(i++)] << 12 | (r1 = b64tab[asc.charAt(i++)]) << 6 | (r2 = b64tab[asc.charAt(i++)]);
      if (r1 === 64) {
        binArray.push(_fromCC(u24 >> 16 & 255));
      } else if (r2 === 64) {
        binArray.push(_fromCC(u24 >> 16 & 255, u24 >> 8 & 255));
      } else {
        binArray.push(_fromCC(u24 >> 16 & 255, u24 >> 8 & 255, u24 & 255));
      }
    }
    return binArray.join("");
  };
  var _atob = typeof atob === "function" ? (asc) => atob(_tidyB64(asc)) : atobPolyfill;
  var _toUint8Array = typeof Uint8Array.fromBase64 === "function" ? (a) => Uint8Array.fromBase64(a) : (a) => _U8Afrom(_atob(a).split("").map((c) => c.charCodeAt(0)));
  var toUint8Array = (a) => _toUint8Array(_unURI(a));
  var _decode = _TD ? (a) => _TD.decode(_toUint8Array(a)) : (a) => btou(_atob(a));
  var _unURI = (a) => _tidyB64(a.replace(/[-_]/g, (m0) => m0 == "-" ? "+" : "/"));
  var decode = (src) => _decode(_unURI(src));
  var isValid = (src) => {
    if (typeof src !== "string")
      return false;
    const s = src.replace(/\s+/g, "").replace(/={0,2}$/, "");
    return !/[^\s0-9a-zA-Z\+/]/.test(s) || !/[^\s0-9a-zA-Z\-_]/.test(s);
  };
  var _noEnum = (v) => {
    return {
      value: v,
      enumerable: false,
      writable: true,
      configurable: true
    };
  };
  var extendString = function() {
    const _add = (name, body) => Object.defineProperty(String.prototype, name, _noEnum(body));
    _add("fromBase64", function() {
      return decode(this);
    });
    _add("toBase64", function(urlsafe) {
      return encode(this, urlsafe);
    });
    _add("toBase64URI", function() {
      return encode(this, true);
    });
    _add("toBase64URL", function() {
      return encode(this, true);
    });
    _add("toUint8Array", function() {
      return toUint8Array(this);
    });
  };
  var extendUint8Array = function() {
    const _add = (name, body) => Object.defineProperty(Uint8Array.prototype, name, _noEnum(body));
    _add("toBase64", function(urlsafe) {
      return fromUint8Array(this, urlsafe);
    });
    _add("toBase64URI", function() {
      return fromUint8Array(this, true);
    });
    _add("toBase64URL", function() {
      return fromUint8Array(this, true);
    });
  };
  var extendBuiltins = () => {
    extendString();
    extendUint8Array();
  };
  var gBase64 = {
    version,
    VERSION,
    atob: _atob,
    atobPolyfill,
    btoa: _btoa,
    btoaPolyfill,
    fromBase64: decode,
    toBase64: encode,
    encode,
    encodeURI,
    encodeURL: encodeURI,
    utob,
    btou,
    decode,
    isValid,
    fromUint8Array,
    toUint8Array,
    extendString,
    extendUint8Array,
    extendBuiltins
  };

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/upload.js
  var import_url_parse = __toESM(require_url_parse());

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/uuid.js
  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/upload.js
  function _regeneratorRuntime() {
    "use strict";
    _regeneratorRuntime = function _regeneratorRuntime3() {
      return e;
    };
    var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function(t2, e2, r2) {
      t2[e2] = r2.value;
    }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag";
    function define(t2, e2, r2) {
      return Object.defineProperty(t2, e2, { value: r2, enumerable: true, configurable: true, writable: true }), t2[e2];
    }
    try {
      define({}, "");
    } catch (t2) {
      define = function define2(t3, e2, r2) {
        return t3[e2] = r2;
      };
    }
    function wrap(t2, e2, r2, n2) {
      var i2 = e2 && e2.prototype instanceof Generator ? e2 : Generator, a2 = Object.create(i2.prototype), c2 = new Context(n2 || []);
      return o(a2, "_invoke", { value: makeInvokeMethod(t2, r2, c2) }), a2;
    }
    function tryCatch(t2, e2, r2) {
      try {
        return { type: "normal", arg: t2.call(e2, r2) };
      } catch (t3) {
        return { type: "throw", arg: t3 };
      }
    }
    e.wrap = wrap;
    var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {};
    function Generator() {
    }
    function GeneratorFunction() {
    }
    function GeneratorFunctionPrototype() {
    }
    var p = {};
    define(p, a, function() {
      return this;
    });
    var d = Object.getPrototypeOf, v = d && d(d(values([])));
    v && v !== r && n.call(v, a) && (p = v);
    var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p);
    function defineIteratorMethods(t2) {
      ["next", "throw", "return"].forEach(function(e2) {
        define(t2, e2, function(t3) {
          return this._invoke(e2, t3);
        });
      });
    }
    function AsyncIterator(t2, e2) {
      function invoke(r3, o2, i2, a2) {
        var c2 = tryCatch(t2[r3], t2, o2);
        if ("throw" !== c2.type) {
          var u2 = c2.arg, h2 = u2.value;
          return h2 && "object" == _typeof3(h2) && n.call(h2, "__await") ? e2.resolve(h2.__await).then(function(t3) {
            invoke("next", t3, i2, a2);
          }, function(t3) {
            invoke("throw", t3, i2, a2);
          }) : e2.resolve(h2).then(function(t3) {
            u2.value = t3, i2(u2);
          }, function(t3) {
            return invoke("throw", t3, i2, a2);
          });
        }
        a2(c2.arg);
      }
      var r2;
      o(this, "_invoke", { value: function value(t3, n2) {
        function callInvokeWithMethodAndArg() {
          return new e2(function(e3, r3) {
            invoke(t3, n2, e3, r3);
          });
        }
        return r2 = r2 ? r2.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
      } });
    }
    function makeInvokeMethod(e2, r2, n2) {
      var o2 = h;
      return function(i2, a2) {
        if (o2 === f) throw Error("Generator is already running");
        if (o2 === s) {
          if ("throw" === i2) throw a2;
          return { value: t, done: true };
        }
        for (n2.method = i2, n2.arg = a2; ; ) {
          var c2 = n2.delegate;
          if (c2) {
            var u2 = maybeInvokeDelegate(c2, n2);
            if (u2) {
              if (u2 === y) continue;
              return u2;
            }
          }
          if ("next" === n2.method) n2.sent = n2._sent = n2.arg;
          else if ("throw" === n2.method) {
            if (o2 === h) throw o2 = s, n2.arg;
            n2.dispatchException(n2.arg);
          } else "return" === n2.method && n2.abrupt("return", n2.arg);
          o2 = f;
          var p2 = tryCatch(e2, r2, n2);
          if ("normal" === p2.type) {
            if (o2 = n2.done ? s : l, p2.arg === y) continue;
            return { value: p2.arg, done: n2.done };
          }
          "throw" === p2.type && (o2 = s, n2.method = "throw", n2.arg = p2.arg);
        }
      };
    }
    function maybeInvokeDelegate(e2, r2) {
      var n2 = r2.method, o2 = e2.iterator[n2];
      if (o2 === t) return r2.delegate = null, "throw" === n2 && e2.iterator["return"] && (r2.method = "return", r2.arg = t, maybeInvokeDelegate(e2, r2), "throw" === r2.method) || "return" !== n2 && (r2.method = "throw", r2.arg = new TypeError("The iterator does not provide a '" + n2 + "' method")), y;
      var i2 = tryCatch(o2, e2.iterator, r2.arg);
      if ("throw" === i2.type) return r2.method = "throw", r2.arg = i2.arg, r2.delegate = null, y;
      var a2 = i2.arg;
      return a2 ? a2.done ? (r2[e2.resultName] = a2.value, r2.next = e2.nextLoc, "return" !== r2.method && (r2.method = "next", r2.arg = t), r2.delegate = null, y) : a2 : (r2.method = "throw", r2.arg = new TypeError("iterator result is not an object"), r2.delegate = null, y);
    }
    function pushTryEntry(t2) {
      var e2 = { tryLoc: t2[0] };
      1 in t2 && (e2.catchLoc = t2[1]), 2 in t2 && (e2.finallyLoc = t2[2], e2.afterLoc = t2[3]), this.tryEntries.push(e2);
    }
    function resetTryEntry(t2) {
      var e2 = t2.completion || {};
      e2.type = "normal", delete e2.arg, t2.completion = e2;
    }
    function Context(t2) {
      this.tryEntries = [{ tryLoc: "root" }], t2.forEach(pushTryEntry, this), this.reset(true);
    }
    function values(e2) {
      if (e2 || "" === e2) {
        var r2 = e2[a];
        if (r2) return r2.call(e2);
        if ("function" == typeof e2.next) return e2;
        if (!isNaN(e2.length)) {
          var o2 = -1, i2 = function next() {
            for (; ++o2 < e2.length; ) if (n.call(e2, o2)) return next.value = e2[o2], next.done = false, next;
            return next.value = t, next.done = true, next;
          };
          return i2.next = i2;
        }
      }
      throw new TypeError(_typeof3(e2) + " is not iterable");
    }
    return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: true }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: true }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function(t2) {
      var e2 = "function" == typeof t2 && t2.constructor;
      return !!e2 && (e2 === GeneratorFunction || "GeneratorFunction" === (e2.displayName || e2.name));
    }, e.mark = function(t2) {
      return Object.setPrototypeOf ? Object.setPrototypeOf(t2, GeneratorFunctionPrototype) : (t2.__proto__ = GeneratorFunctionPrototype, define(t2, u, "GeneratorFunction")), t2.prototype = Object.create(g), t2;
    }, e.awrap = function(t2) {
      return { __await: t2 };
    }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function() {
      return this;
    }), e.AsyncIterator = AsyncIterator, e.async = function(t2, r2, n2, o2, i2) {
      void 0 === i2 && (i2 = Promise);
      var a2 = new AsyncIterator(wrap(t2, r2, n2, o2), i2);
      return e.isGeneratorFunction(r2) ? a2 : a2.next().then(function(t3) {
        return t3.done ? t3.value : a2.next();
      });
    }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function() {
      return this;
    }), define(g, "toString", function() {
      return "[object Generator]";
    }), e.keys = function(t2) {
      var e2 = Object(t2), r2 = [];
      for (var n2 in e2) r2.push(n2);
      return r2.reverse(), function next() {
        for (; r2.length; ) {
          var t3 = r2.pop();
          if (t3 in e2) return next.value = t3, next.done = false, next;
        }
        return next.done = true, next;
      };
    }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e2) {
      if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = false, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e2) for (var r2 in this) "t" === r2.charAt(0) && n.call(this, r2) && !isNaN(+r2.slice(1)) && (this[r2] = t);
    }, stop: function stop() {
      this.done = true;
      var t2 = this.tryEntries[0].completion;
      if ("throw" === t2.type) throw t2.arg;
      return this.rval;
    }, dispatchException: function dispatchException(e2) {
      if (this.done) throw e2;
      var r2 = this;
      function handle(n2, o3) {
        return a2.type = "throw", a2.arg = e2, r2.next = n2, o3 && (r2.method = "next", r2.arg = t), !!o3;
      }
      for (var o2 = this.tryEntries.length - 1; o2 >= 0; --o2) {
        var i2 = this.tryEntries[o2], a2 = i2.completion;
        if ("root" === i2.tryLoc) return handle("end");
        if (i2.tryLoc <= this.prev) {
          var c2 = n.call(i2, "catchLoc"), u2 = n.call(i2, "finallyLoc");
          if (c2 && u2) {
            if (this.prev < i2.catchLoc) return handle(i2.catchLoc, true);
            if (this.prev < i2.finallyLoc) return handle(i2.finallyLoc);
          } else if (c2) {
            if (this.prev < i2.catchLoc) return handle(i2.catchLoc, true);
          } else {
            if (!u2) throw Error("try statement without catch or finally");
            if (this.prev < i2.finallyLoc) return handle(i2.finallyLoc);
          }
        }
      }
    }, abrupt: function abrupt(t2, e2) {
      for (var r2 = this.tryEntries.length - 1; r2 >= 0; --r2) {
        var o2 = this.tryEntries[r2];
        if (o2.tryLoc <= this.prev && n.call(o2, "finallyLoc") && this.prev < o2.finallyLoc) {
          var i2 = o2;
          break;
        }
      }
      i2 && ("break" === t2 || "continue" === t2) && i2.tryLoc <= e2 && e2 <= i2.finallyLoc && (i2 = null);
      var a2 = i2 ? i2.completion : {};
      return a2.type = t2, a2.arg = e2, i2 ? (this.method = "next", this.next = i2.finallyLoc, y) : this.complete(a2);
    }, complete: function complete(t2, e2) {
      if ("throw" === t2.type) throw t2.arg;
      return "break" === t2.type || "continue" === t2.type ? this.next = t2.arg : "return" === t2.type ? (this.rval = this.arg = t2.arg, this.method = "return", this.next = "end") : "normal" === t2.type && e2 && (this.next = e2), y;
    }, finish: function finish(t2) {
      for (var e2 = this.tryEntries.length - 1; e2 >= 0; --e2) {
        var r2 = this.tryEntries[e2];
        if (r2.finallyLoc === t2) return this.complete(r2.completion, r2.afterLoc), resetTryEntry(r2), y;
      }
    }, "catch": function _catch(t2) {
      for (var e2 = this.tryEntries.length - 1; e2 >= 0; --e2) {
        var r2 = this.tryEntries[e2];
        if (r2.tryLoc === t2) {
          var n2 = r2.completion;
          if ("throw" === n2.type) {
            var o2 = n2.arg;
            resetTryEntry(r2);
          }
          return o2;
        }
      }
      throw Error("illegal catch attempt");
    }, delegateYield: function delegateYield(e2, r2, n2) {
      return this.delegate = { iterator: values(e2), resultName: r2, nextLoc: n2 }, "next" === this.method && (this.arg = t), y;
    } }, e;
  }
  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }
    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }
  function _asyncToGenerator(fn) {
    return function() {
      var self2 = this, args = arguments;
      return new Promise(function(resolve, reject) {
        var gen = fn.apply(self2, args);
        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
        }
        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
        }
        _next(void 0);
      });
    };
  }
  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e, n, i, u, a = [], f = true, o = false;
      try {
        if (i = (t = t.call(r)).next, 0 === l) {
          if (Object(t) !== t) return;
          f = false;
        } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
      } catch (r2) {
        o = true, n = r2;
      } finally {
        try {
          if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }
  function _typeof3(o) {
    "@babel/helpers - typeof";
    return _typeof3 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof3(o);
  }
  function _createForOfIteratorHelper(o, allowArrayLike) {
    var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
    if (!it) {
      if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
        if (it) o = it;
        var i = 0;
        var F = function F2() {
        };
        return { s: F, n: function n() {
          if (i >= o.length) return { done: true };
          return { done: false, value: o[i++] };
        }, e: function e(_e) {
          throw _e;
        }, f: F };
      }
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    var normalCompletion = true, didErr = false, err;
    return { s: function s() {
      it = it.call(o);
    }, n: function n() {
      var step = it.next();
      normalCompletion = step.done;
      return step;
    }, e: function e(_e2) {
      didErr = true;
      err = _e2;
    }, f: function f() {
      try {
        if (!normalCompletion && it["return"] != null) it["return"]();
      } finally {
        if (didErr) throw err;
      }
    } };
  }
  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }
  function _arrayLikeToArray(arr, len2) {
    if (len2 == null || len2 > arr.length) len2 = arr.length;
    for (var i = 0, arr2 = new Array(len2); i < len2; i++) arr2[i] = arr[i];
    return arr2;
  }
  function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function(r2) {
        return Object.getOwnPropertyDescriptor(e, r2).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys(Object(t), true).forEach(function(r2) {
        _defineProperty(e, r2, t[r2]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r2) {
        Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
      });
    }
    return e;
  }
  function _defineProperty(obj, key, value) {
    key = _toPropertyKey3(key);
    if (key in obj) {
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _classCallCheck3(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties3(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey3(descriptor.key), descriptor);
    }
  }
  function _createClass3(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties3(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties3(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey3(t) {
    var i = _toPrimitive3(t, "string");
    return "symbol" == _typeof3(i) ? i : i + "";
  }
  function _toPrimitive3(t, r) {
    if ("object" != _typeof3(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof3(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var PROTOCOL_TUS_V1 = "tus-v1";
  var PROTOCOL_IETF_DRAFT_03 = "ietf-draft-03";
  var PROTOCOL_IETF_DRAFT_05 = "ietf-draft-05";
  var defaultOptions = {
    endpoint: null,
    uploadUrl: null,
    metadata: {},
    metadataForPartialUploads: {},
    fingerprint: null,
    uploadSize: null,
    onProgress: null,
    onChunkComplete: null,
    onSuccess: null,
    onError: null,
    onUploadUrlAvailable: null,
    overridePatchMethod: false,
    headers: {},
    addRequestId: false,
    onBeforeRequest: null,
    onAfterResponse: null,
    onShouldRetry: defaultOnShouldRetry,
    chunkSize: Number.POSITIVE_INFINITY,
    retryDelays: [0, 1e3, 3e3, 5e3],
    parallelUploads: 1,
    parallelUploadBoundaries: null,
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: false,
    uploadLengthDeferred: false,
    uploadDataDuringCreation: false,
    urlStorage: null,
    fileReader: null,
    httpStack: null,
    protocol: PROTOCOL_TUS_V1
  };
  var BaseUpload = /* @__PURE__ */ (function() {
    function BaseUpload2(file, options) {
      _classCallCheck3(this, BaseUpload2);
      if ("resume" in options) {
        console.log("tus: The `resume` option has been removed in tus-js-client v2. Please use the URL storage API instead.");
      }
      this.options = options;
      this.options.chunkSize = Number(this.options.chunkSize);
      this._urlStorage = this.options.urlStorage;
      this.file = file;
      this.url = null;
      this._req = null;
      this._fingerprint = null;
      this._urlStorageKey = null;
      this._offset = null;
      this._aborted = false;
      this._size = null;
      this._source = null;
      this._retryAttempt = 0;
      this._retryTimeout = null;
      this._offsetBeforeRetry = 0;
      this._parallelUploads = null;
      this._parallelUploadUrls = null;
    }
    return _createClass3(BaseUpload2, [{
      key: "findPreviousUploads",
      value: function findPreviousUploads() {
        var _this = this;
        return this.options.fingerprint(this.file, this.options).then(function(fingerprint2) {
          return _this._urlStorage.findUploadsByFingerprint(fingerprint2);
        });
      }
    }, {
      key: "resumeFromPreviousUpload",
      value: function resumeFromPreviousUpload(previousUpload) {
        this.url = previousUpload.uploadUrl || null;
        this._parallelUploadUrls = previousUpload.parallelUploadUrls || null;
        this._urlStorageKey = previousUpload.urlStorageKey;
      }
    }, {
      key: "start",
      value: function start() {
        var _this2 = this;
        var file = this.file;
        if (!file) {
          this._emitError(new Error("tus: no file or stream to upload provided"));
          return;
        }
        if (![PROTOCOL_TUS_V1, PROTOCOL_IETF_DRAFT_03, PROTOCOL_IETF_DRAFT_05].includes(this.options.protocol)) {
          this._emitError(new Error("tus: unsupported protocol ".concat(this.options.protocol)));
          return;
        }
        if (!this.options.endpoint && !this.options.uploadUrl && !this.url) {
          this._emitError(new Error("tus: neither an endpoint or an upload URL is provided"));
          return;
        }
        var retryDelays = this.options.retryDelays;
        if (retryDelays != null && Object.prototype.toString.call(retryDelays) !== "[object Array]") {
          this._emitError(new Error("tus: the `retryDelays` option must either be an array or null"));
          return;
        }
        if (this.options.parallelUploads > 1) {
          for (var _i = 0, _arr = ["uploadUrl", "uploadSize", "uploadLengthDeferred"]; _i < _arr.length; _i++) {
            var optionName = _arr[_i];
            if (this.options[optionName]) {
              this._emitError(new Error("tus: cannot use the ".concat(optionName, " option when parallelUploads is enabled")));
              return;
            }
          }
        }
        if (this.options.parallelUploadBoundaries) {
          if (this.options.parallelUploads <= 1) {
            this._emitError(new Error("tus: cannot use the `parallelUploadBoundaries` option when `parallelUploads` is disabled"));
            return;
          }
          if (this.options.parallelUploads !== this.options.parallelUploadBoundaries.length) {
            this._emitError(new Error("tus: the `parallelUploadBoundaries` must have the same length as the value of `parallelUploads`"));
            return;
          }
        }
        this.options.fingerprint(file, this.options).then(function(fingerprint2) {
          if (fingerprint2 == null) {
            log("No fingerprint was calculated meaning that the upload cannot be stored in the URL storage.");
          } else {
            log("Calculated fingerprint: ".concat(fingerprint2));
          }
          _this2._fingerprint = fingerprint2;
          if (_this2._source) {
            return _this2._source;
          }
          return _this2.options.fileReader.openFile(file, _this2.options.chunkSize);
        }).then(function(source) {
          _this2._source = source;
          if (_this2.options.uploadLengthDeferred) {
            _this2._size = null;
          } else if (_this2.options.uploadSize != null) {
            _this2._size = Number(_this2.options.uploadSize);
            if (Number.isNaN(_this2._size)) {
              _this2._emitError(new Error("tus: cannot convert `uploadSize` option into a number"));
              return;
            }
          } else {
            _this2._size = _this2._source.size;
            if (_this2._size == null) {
              _this2._emitError(new Error("tus: cannot automatically derive upload's size from input. Specify it manually using the `uploadSize` option or use the `uploadLengthDeferred` option"));
              return;
            }
          }
          if (_this2.options.parallelUploads > 1 || _this2._parallelUploadUrls != null) {
            _this2._startParallelUpload();
          } else {
            _this2._startSingleUpload();
          }
        })["catch"](function(err) {
          _this2._emitError(err);
        });
      }
      /**
       * Initiate the uploading procedure for a parallelized upload, where one file is split into
       * multiple request which are run in parallel.
       *
       * @api private
       */
    }, {
      key: "_startParallelUpload",
      value: function _startParallelUpload() {
        var _this$options$paralle, _this3 = this;
        var totalSize = this._size;
        var totalProgress = 0;
        this._parallelUploads = [];
        var partCount = this._parallelUploadUrls != null ? this._parallelUploadUrls.length : this.options.parallelUploads;
        var parts = (_this$options$paralle = this.options.parallelUploadBoundaries) !== null && _this$options$paralle !== void 0 ? _this$options$paralle : splitSizeIntoParts(this._source.size, partCount);
        if (this._parallelUploadUrls) {
          parts.forEach(function(part, index) {
            part.uploadUrl = _this3._parallelUploadUrls[index] || null;
          });
        }
        this._parallelUploadUrls = new Array(parts.length);
        var uploads = parts.map(function(part, index) {
          var lastPartProgress = 0;
          return _this3._source.slice(part.start, part.end).then(function(_ref) {
            var value = _ref.value;
            return new Promise(function(resolve, reject) {
              var options = _objectSpread(_objectSpread({}, _this3.options), {}, {
                // If available, the partial upload should be resumed from a previous URL.
                uploadUrl: part.uploadUrl || null,
                // We take manually care of resuming for partial uploads, so they should
                // not be stored in the URL storage.
                storeFingerprintForResuming: false,
                removeFingerprintOnSuccess: false,
                // Reset the parallelUploads option to not cause recursion.
                parallelUploads: 1,
                // Reset this option as we are not doing a parallel upload.
                parallelUploadBoundaries: null,
                metadata: _this3.options.metadataForPartialUploads,
                // Add the header to indicate the this is a partial upload.
                headers: _objectSpread(_objectSpread({}, _this3.options.headers), {}, {
                  "Upload-Concat": "partial"
                }),
                // Reject or resolve the promise if the upload errors or completes.
                onSuccess: resolve,
                onError: reject,
                // Based in the progress for this partial upload, calculate the progress
                // for the entire final upload.
                onProgress: function onProgress(newPartProgress) {
                  totalProgress = totalProgress - lastPartProgress + newPartProgress;
                  lastPartProgress = newPartProgress;
                  _this3._emitProgress(totalProgress, totalSize);
                },
                // Wait until every partial upload has an upload URL, so we can add
                // them to the URL storage.
                onUploadUrlAvailable: function onUploadUrlAvailable() {
                  _this3._parallelUploadUrls[index] = upload2.url;
                  if (_this3._parallelUploadUrls.filter(function(u) {
                    return Boolean(u);
                  }).length === parts.length) {
                    _this3._saveUploadInUrlStorage();
                  }
                }
              });
              var upload2 = new BaseUpload2(value, options);
              upload2.start();
              _this3._parallelUploads.push(upload2);
            });
          });
        });
        var req;
        Promise.all(uploads).then(function() {
          req = _this3._openRequest("POST", _this3.options.endpoint);
          req.setHeader("Upload-Concat", "final;".concat(_this3._parallelUploadUrls.join(" ")));
          var metadata = encodeMetadata(_this3.options.metadata);
          if (metadata !== "") {
            req.setHeader("Upload-Metadata", metadata);
          }
          return _this3._sendRequest(req, null);
        }).then(function(res) {
          if (!inStatusCategory(res.getStatus(), 200)) {
            _this3._emitHttpError(req, res, "tus: unexpected response while creating upload");
            return;
          }
          var location = res.getHeader("Location");
          if (location == null) {
            _this3._emitHttpError(req, res, "tus: invalid or missing Location header");
            return;
          }
          _this3.url = resolveUrl(_this3.options.endpoint, location);
          log("Created upload at ".concat(_this3.url));
          _this3._emitSuccess(res);
        })["catch"](function(err) {
          _this3._emitError(err);
        });
      }
      /**
       * Initiate the uploading procedure for a non-parallel upload. Here the entire file is
       * uploaded in a sequential matter.
       *
       * @api private
       */
    }, {
      key: "_startSingleUpload",
      value: function _startSingleUpload() {
        this._aborted = false;
        if (this.url != null) {
          log("Resuming upload from previous URL: ".concat(this.url));
          this._resumeUpload();
          return;
        }
        if (this.options.uploadUrl != null) {
          log("Resuming upload from provided URL: ".concat(this.options.uploadUrl));
          this.url = this.options.uploadUrl;
          this._resumeUpload();
          return;
        }
        log("Creating a new upload");
        this._createUpload();
      }
      /**
       * Abort any running request and stop the current upload. After abort is called, no event
       * handler will be invoked anymore. You can use the `start` method to resume the upload
       * again.
       * If `shouldTerminate` is true, the `terminate` function will be called to remove the
       * current upload from the server.
       *
       * @param {boolean} shouldTerminate True if the upload should be deleted from the server.
       * @return {Promise} The Promise will be resolved/rejected when the requests finish.
       */
    }, {
      key: "abort",
      value: function abort(shouldTerminate) {
        var _this4 = this;
        if (this._parallelUploads != null) {
          var _iterator = _createForOfIteratorHelper(this._parallelUploads), _step;
          try {
            for (_iterator.s(); !(_step = _iterator.n()).done; ) {
              var upload2 = _step.value;
              upload2.abort(shouldTerminate);
            }
          } catch (err) {
            _iterator.e(err);
          } finally {
            _iterator.f();
          }
        }
        if (this._req !== null) {
          this._req.abort();
        }
        this._aborted = true;
        if (this._retryTimeout != null) {
          clearTimeout(this._retryTimeout);
          this._retryTimeout = null;
        }
        if (!shouldTerminate || this.url == null) {
          return Promise.resolve();
        }
        return BaseUpload2.terminate(this.url, this.options).then(function() {
          return _this4._removeFromUrlStorage();
        });
      }
    }, {
      key: "_emitHttpError",
      value: function _emitHttpError(req, res, message2, causingErr) {
        this._emitError(new error_default(message2, causingErr, req, res));
      }
    }, {
      key: "_emitError",
      value: function _emitError(err) {
        var _this5 = this;
        if (this._aborted) return;
        if (this.options.retryDelays != null) {
          var shouldResetDelays = this._offset != null && this._offset > this._offsetBeforeRetry;
          if (shouldResetDelays) {
            this._retryAttempt = 0;
          }
          if (shouldRetry(err, this._retryAttempt, this.options)) {
            var delay = this.options.retryDelays[this._retryAttempt++];
            this._offsetBeforeRetry = this._offset;
            this._retryTimeout = setTimeout(function() {
              _this5.start();
            }, delay);
            return;
          }
        }
        if (typeof this.options.onError === "function") {
          this.options.onError(err);
        } else {
          throw err;
        }
      }
      /**
       * Publishes notification if the upload has been successfully completed.
       *
       * @param {object} lastResponse Last HTTP response.
       * @api private
       */
    }, {
      key: "_emitSuccess",
      value: function _emitSuccess(lastResponse) {
        if (this.options.removeFingerprintOnSuccess) {
          this._removeFromUrlStorage();
        }
        if (typeof this.options.onSuccess === "function") {
          this.options.onSuccess({
            lastResponse
          });
        }
      }
      /**
       * Publishes notification when data has been sent to the server. This
       * data may not have been accepted by the server yet.
       *
       * @param {number} bytesSent  Number of bytes sent to the server.
       * @param {number} bytesTotal Total number of bytes to be sent to the server.
       * @api private
       */
    }, {
      key: "_emitProgress",
      value: function _emitProgress(bytesSent, bytesTotal) {
        if (typeof this.options.onProgress === "function") {
          this.options.onProgress(bytesSent, bytesTotal);
        }
      }
      /**
       * Publishes notification when a chunk of data has been sent to the server
       * and accepted by the server.
       * @param {number} chunkSize  Size of the chunk that was accepted by the server.
       * @param {number} bytesAccepted Total number of bytes that have been
       *                                accepted by the server.
       * @param {number} bytesTotal Total number of bytes to be sent to the server.
       * @api private
       */
    }, {
      key: "_emitChunkComplete",
      value: function _emitChunkComplete(chunkSize, bytesAccepted, bytesTotal) {
        if (typeof this.options.onChunkComplete === "function") {
          this.options.onChunkComplete(chunkSize, bytesAccepted, bytesTotal);
        }
      }
      /**
       * Create a new upload using the creation extension by sending a POST
       * request to the endpoint. After successful creation the file will be
       * uploaded
       *
       * @api private
       */
    }, {
      key: "_createUpload",
      value: function _createUpload() {
        var _this6 = this;
        if (!this.options.endpoint) {
          this._emitError(new Error("tus: unable to create upload because no endpoint is provided"));
          return;
        }
        var req = this._openRequest("POST", this.options.endpoint);
        if (this.options.uploadLengthDeferred) {
          req.setHeader("Upload-Defer-Length", "1");
        } else {
          req.setHeader("Upload-Length", "".concat(this._size));
        }
        var metadata = encodeMetadata(this.options.metadata);
        if (metadata !== "") {
          req.setHeader("Upload-Metadata", metadata);
        }
        var promise;
        if (this.options.uploadDataDuringCreation && !this.options.uploadLengthDeferred) {
          this._offset = 0;
          promise = this._addChunkToRequest(req);
        } else {
          if (this.options.protocol === PROTOCOL_IETF_DRAFT_03 || this.options.protocol === PROTOCOL_IETF_DRAFT_05) {
            req.setHeader("Upload-Complete", "?0");
          }
          promise = this._sendRequest(req, null);
        }
        promise.then(function(res) {
          if (!inStatusCategory(res.getStatus(), 200)) {
            _this6._emitHttpError(req, res, "tus: unexpected response while creating upload");
            return;
          }
          var location = res.getHeader("Location");
          if (location == null) {
            _this6._emitHttpError(req, res, "tus: invalid or missing Location header");
            return;
          }
          _this6.url = resolveUrl(_this6.options.endpoint, location);
          log("Created upload at ".concat(_this6.url));
          if (typeof _this6.options.onUploadUrlAvailable === "function") {
            _this6.options.onUploadUrlAvailable();
          }
          if (_this6._size === 0) {
            _this6._emitSuccess(res);
            _this6._source.close();
            return;
          }
          _this6._saveUploadInUrlStorage().then(function() {
            if (_this6.options.uploadDataDuringCreation) {
              _this6._handleUploadResponse(req, res);
            } else {
              _this6._offset = 0;
              _this6._performUpload();
            }
          });
        })["catch"](function(err) {
          _this6._emitHttpError(req, null, "tus: failed to create upload", err);
        });
      }
      /*
       * Try to resume an existing upload. First a HEAD request will be sent
       * to retrieve the offset. If the request fails a new upload will be
       * created. In the case of a successful response the file will be uploaded.
       *
       * @api private
       */
    }, {
      key: "_resumeUpload",
      value: function _resumeUpload() {
        var _this7 = this;
        var req = this._openRequest("HEAD", this.url);
        var promise = this._sendRequest(req, null);
        promise.then(function(res) {
          var status = res.getStatus();
          if (!inStatusCategory(status, 200)) {
            if (status === 423) {
              _this7._emitHttpError(req, res, "tus: upload is currently locked; retry later");
              return;
            }
            if (inStatusCategory(status, 400)) {
              _this7._removeFromUrlStorage();
            }
            if (!_this7.options.endpoint) {
              _this7._emitHttpError(req, res, "tus: unable to resume upload (new upload cannot be created without an endpoint)");
              return;
            }
            _this7.url = null;
            _this7._createUpload();
            return;
          }
          var offset = Number.parseInt(res.getHeader("Upload-Offset"), 10);
          if (Number.isNaN(offset)) {
            _this7._emitHttpError(req, res, "tus: invalid or missing offset value");
            return;
          }
          var length = Number.parseInt(res.getHeader("Upload-Length"), 10);
          if (Number.isNaN(length) && !_this7.options.uploadLengthDeferred && _this7.options.protocol === PROTOCOL_TUS_V1) {
            _this7._emitHttpError(req, res, "tus: invalid or missing length value");
            return;
          }
          if (typeof _this7.options.onUploadUrlAvailable === "function") {
            _this7.options.onUploadUrlAvailable();
          }
          _this7._saveUploadInUrlStorage().then(function() {
            if (offset === length) {
              _this7._emitProgress(length, length);
              _this7._emitSuccess(res);
              return;
            }
            _this7._offset = offset;
            _this7._performUpload();
          });
        })["catch"](function(err) {
          _this7._emitHttpError(req, null, "tus: failed to resume upload", err);
        });
      }
      /**
       * Start uploading the file using PATCH requests. The file will be divided
       * into chunks as specified in the chunkSize option. During the upload
       * the onProgress event handler may be invoked multiple times.
       *
       * @api private
       */
    }, {
      key: "_performUpload",
      value: function _performUpload() {
        var _this8 = this;
        if (this._aborted) {
          return;
        }
        var req;
        if (this.options.overridePatchMethod) {
          req = this._openRequest("POST", this.url);
          req.setHeader("X-HTTP-Method-Override", "PATCH");
        } else {
          req = this._openRequest("PATCH", this.url);
        }
        req.setHeader("Upload-Offset", "".concat(this._offset));
        var promise = this._addChunkToRequest(req);
        promise.then(function(res) {
          if (!inStatusCategory(res.getStatus(), 200)) {
            _this8._emitHttpError(req, res, "tus: unexpected response while uploading chunk");
            return;
          }
          _this8._handleUploadResponse(req, res);
        })["catch"](function(err) {
          if (_this8._aborted) {
            return;
          }
          _this8._emitHttpError(req, null, "tus: failed to upload chunk at offset ".concat(_this8._offset), err);
        });
      }
      /**
       * _addChunktoRequest reads a chunk from the source and sends it using the
       * supplied request object. It will not handle the response.
       *
       * @api private
       */
    }, {
      key: "_addChunkToRequest",
      value: function _addChunkToRequest(req) {
        var _this9 = this;
        var start = this._offset;
        var end = this._offset + this.options.chunkSize;
        req.setProgressHandler(function(bytesSent) {
          _this9._emitProgress(start + bytesSent, _this9._size);
        });
        if (this.options.protocol === PROTOCOL_TUS_V1) {
          req.setHeader("Content-Type", "application/offset+octet-stream");
        } else if (this.options.protocol === PROTOCOL_IETF_DRAFT_05) {
          req.setHeader("Content-Type", "application/partial-upload");
        }
        if ((end === Number.POSITIVE_INFINITY || end > this._size) && !this.options.uploadLengthDeferred) {
          end = this._size;
        }
        return this._source.slice(start, end).then(function(_ref2) {
          var value = _ref2.value, done = _ref2.done;
          var valueSize = value !== null && value !== void 0 && value.size ? value.size : 0;
          if (_this9.options.uploadLengthDeferred && done) {
            _this9._size = _this9._offset + valueSize;
            req.setHeader("Upload-Length", "".concat(_this9._size));
          }
          var newSize = _this9._offset + valueSize;
          if (!_this9.options.uploadLengthDeferred && done && newSize !== _this9._size) {
            return Promise.reject(new Error("upload was configured with a size of ".concat(_this9._size, " bytes, but the source is done after ").concat(newSize, " bytes")));
          }
          if (value === null) {
            return _this9._sendRequest(req);
          }
          if (_this9.options.protocol === PROTOCOL_IETF_DRAFT_03 || _this9.options.protocol === PROTOCOL_IETF_DRAFT_05) {
            req.setHeader("Upload-Complete", done ? "?1" : "?0");
          }
          _this9._emitProgress(_this9._offset, _this9._size);
          return _this9._sendRequest(req, value);
        });
      }
      /**
       * _handleUploadResponse is used by requests that haven been sent using _addChunkToRequest
       * and already have received a response.
       *
       * @api private
       */
    }, {
      key: "_handleUploadResponse",
      value: function _handleUploadResponse(req, res) {
        var offset = Number.parseInt(res.getHeader("Upload-Offset"), 10);
        if (Number.isNaN(offset)) {
          this._emitHttpError(req, res, "tus: invalid or missing offset value");
          return;
        }
        this._emitProgress(offset, this._size);
        this._emitChunkComplete(offset - this._offset, offset, this._size);
        this._offset = offset;
        if (offset === this._size) {
          this._emitSuccess(res);
          this._source.close();
          return;
        }
        this._performUpload();
      }
      /**
       * Create a new HTTP request object with the given method and URL.
       *
       * @api private
       */
    }, {
      key: "_openRequest",
      value: function _openRequest(method, url) {
        var req = openRequest(method, url, this.options);
        this._req = req;
        return req;
      }
      /**
       * Remove the entry in the URL storage, if it has been saved before.
       *
       * @api private
       */
    }, {
      key: "_removeFromUrlStorage",
      value: function _removeFromUrlStorage() {
        var _this10 = this;
        if (!this._urlStorageKey) return;
        this._urlStorage.removeUpload(this._urlStorageKey)["catch"](function(err) {
          _this10._emitError(err);
        });
        this._urlStorageKey = null;
      }
      /**
       * Add the upload URL to the URL storage, if possible.
       *
       * @api private
       */
    }, {
      key: "_saveUploadInUrlStorage",
      value: function _saveUploadInUrlStorage() {
        var _this11 = this;
        if (!this.options.storeFingerprintForResuming || !this._fingerprint || this._urlStorageKey !== null) {
          return Promise.resolve();
        }
        var storedUpload = {
          size: this._size,
          metadata: this.options.metadata,
          creationTime: (/* @__PURE__ */ new Date()).toString()
        };
        if (this._parallelUploads) {
          storedUpload.parallelUploadUrls = this._parallelUploadUrls;
        } else {
          storedUpload.uploadUrl = this.url;
        }
        return this._urlStorage.addUpload(this._fingerprint, storedUpload).then(function(urlStorageKey) {
          _this11._urlStorageKey = urlStorageKey;
        });
      }
      /**
       * Send a request with the provided body.
       *
       * @api private
       */
    }, {
      key: "_sendRequest",
      value: function _sendRequest(req) {
        var body = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
        return sendRequest(req, body, this.options);
      }
    }], [{
      key: "terminate",
      value: function terminate(url) {
        var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        var req = openRequest("DELETE", url, options);
        return sendRequest(req, null, options).then(function(res) {
          if (res.getStatus() === 204) {
            return;
          }
          throw new error_default("tus: unexpected response while terminating upload", null, req, res);
        })["catch"](function(err) {
          if (!(err instanceof error_default)) {
            err = new error_default("tus: failed to terminate upload", err, req, null);
          }
          if (!shouldRetry(err, 0, options)) {
            throw err;
          }
          var delay = options.retryDelays[0];
          var remainingDelays = options.retryDelays.slice(1);
          var newOptions = _objectSpread(_objectSpread({}, options), {}, {
            retryDelays: remainingDelays
          });
          return new Promise(function(resolve) {
            return setTimeout(resolve, delay);
          }).then(function() {
            return BaseUpload2.terminate(url, newOptions);
          });
        });
      }
    }]);
  })();
  function encodeMetadata(metadata) {
    return Object.entries(metadata).map(function(_ref3) {
      var _ref4 = _slicedToArray(_ref3, 2), key = _ref4[0], value = _ref4[1];
      return "".concat(key, " ").concat(gBase64.encode(String(value)));
    }).join(",");
  }
  function inStatusCategory(status, category) {
    return status >= category && status < category + 100;
  }
  function openRequest(method, url, options) {
    var req = options.httpStack.createRequest(method, url);
    if (options.protocol === PROTOCOL_IETF_DRAFT_03) {
      req.setHeader("Upload-Draft-Interop-Version", "5");
    } else if (options.protocol === PROTOCOL_IETF_DRAFT_05) {
      req.setHeader("Upload-Draft-Interop-Version", "6");
    } else {
      req.setHeader("Tus-Resumable", "1.0.0");
    }
    var headers = options.headers || {};
    for (var _i2 = 0, _Object$entries = Object.entries(headers); _i2 < _Object$entries.length; _i2++) {
      var _Object$entries$_i = _slicedToArray(_Object$entries[_i2], 2), name = _Object$entries$_i[0], value = _Object$entries$_i[1];
      req.setHeader(name, value);
    }
    if (options.addRequestId) {
      var requestId = uuid();
      req.setHeader("X-Request-ID", requestId);
    }
    return req;
  }
  function sendRequest(_x, _x2, _x3) {
    return _sendRequest2.apply(this, arguments);
  }
  function _sendRequest2() {
    _sendRequest2 = _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee(req, body, options) {
      var res;
      return _regeneratorRuntime().wrap(function _callee$(_context) {
        while (1) switch (_context.prev = _context.next) {
          case 0:
            if (!(typeof options.onBeforeRequest === "function")) {
              _context.next = 3;
              break;
            }
            _context.next = 3;
            return options.onBeforeRequest(req);
          case 3:
            _context.next = 5;
            return req.send(body);
          case 5:
            res = _context.sent;
            if (!(typeof options.onAfterResponse === "function")) {
              _context.next = 9;
              break;
            }
            _context.next = 9;
            return options.onAfterResponse(req, res);
          case 9:
            return _context.abrupt("return", res);
          case 10:
          case "end":
            return _context.stop();
        }
      }, _callee);
    }));
    return _sendRequest2.apply(this, arguments);
  }
  function isOnline() {
    var online = true;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      online = false;
    }
    return online;
  }
  function shouldRetry(err, retryAttempt, options) {
    if (options.retryDelays == null || retryAttempt >= options.retryDelays.length || err.originalRequest == null) {
      return false;
    }
    if (options && typeof options.onShouldRetry === "function") {
      return options.onShouldRetry(err, retryAttempt, options);
    }
    return defaultOnShouldRetry(err);
  }
  function defaultOnShouldRetry(err) {
    var status = err.originalResponse ? err.originalResponse.getStatus() : 0;
    return (!inStatusCategory(status, 400) || status === 409 || status === 423) && isOnline();
  }
  function resolveUrl(origin, link) {
    return new import_url_parse.default(link, origin).toString();
  }
  function splitSizeIntoParts(totalSize, partCount) {
    var partSize = Math.floor(totalSize / partCount);
    var parts = [];
    for (var i = 0; i < partCount; i++) {
      parts.push({
        start: partSize * i,
        end: partSize * (i + 1)
      });
    }
    parts[partCount - 1].end = totalSize;
    return parts;
  }
  BaseUpload.defaultOptions = defaultOptions;
  var upload_default = BaseUpload;

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/isReactNative.js
  var isReactNative = function isReactNative2() {
    return typeof navigator !== "undefined" && typeof navigator.product === "string" && navigator.product.toLowerCase() === "reactnative";
  };
  var isReactNative_default = isReactNative;

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/uriToBlob.js
  function uriToBlob(uri) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.responseType = "blob";
      xhr.onload = function() {
        var blob = xhr.response;
        resolve(blob);
      };
      xhr.onerror = function(err) {
        reject(err);
      };
      xhr.open("GET", uri);
      xhr.send();
    });
  }

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/sources/isCordova.js
  var isCordova = function isCordova2() {
    return typeof window !== "undefined" && (typeof window.PhoneGap !== "undefined" || typeof window.Cordova !== "undefined" || typeof window.cordova !== "undefined");
  };
  var isCordova_default = isCordova;

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/sources/readAsByteArray.js
  function readAsByteArray(chunk) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        var value = new Uint8Array(reader.result);
        resolve({
          value
        });
      };
      reader.onerror = function(err) {
        reject(err);
      };
      reader.readAsArrayBuffer(chunk);
    });
  }

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/sources/FileSource.js
  function _typeof4(o) {
    "@babel/helpers - typeof";
    return _typeof4 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof4(o);
  }
  function _classCallCheck4(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties4(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey4(descriptor.key), descriptor);
    }
  }
  function _createClass4(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties4(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties4(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey4(t) {
    var i = _toPrimitive4(t, "string");
    return "symbol" == _typeof4(i) ? i : i + "";
  }
  function _toPrimitive4(t, r) {
    if ("object" != _typeof4(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof4(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var FileSource = /* @__PURE__ */ (function() {
    function FileSource2(file) {
      _classCallCheck4(this, FileSource2);
      this._file = file;
      this.size = file.size;
    }
    return _createClass4(FileSource2, [{
      key: "slice",
      value: function slice(start, end) {
        if (isCordova_default()) {
          return readAsByteArray(this._file.slice(start, end));
        }
        var value = this._file.slice(start, end);
        var done = end >= this.size;
        return Promise.resolve({
          value,
          done
        });
      }
    }, {
      key: "close",
      value: function close() {
      }
    }]);
  })();

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/sources/StreamSource.js
  function _typeof5(o) {
    "@babel/helpers - typeof";
    return _typeof5 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof5(o);
  }
  function _classCallCheck5(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties5(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey5(descriptor.key), descriptor);
    }
  }
  function _createClass5(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties5(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties5(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey5(t) {
    var i = _toPrimitive5(t, "string");
    return "symbol" == _typeof5(i) ? i : i + "";
  }
  function _toPrimitive5(t, r) {
    if ("object" != _typeof5(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof5(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  function len(blobOrArray) {
    if (blobOrArray === void 0) return 0;
    if (blobOrArray.size !== void 0) return blobOrArray.size;
    return blobOrArray.length;
  }
  function concat(a, b) {
    if (a.concat) {
      return a.concat(b);
    }
    if (a instanceof Blob) {
      return new Blob([a, b], {
        type: a.type
      });
    }
    if (a.set) {
      var c = new a.constructor(a.length + b.length);
      c.set(a);
      c.set(b, a.length);
      return c;
    }
    throw new Error("Unknown data type");
  }
  var StreamSource = /* @__PURE__ */ (function() {
    function StreamSource2(reader) {
      _classCallCheck5(this, StreamSource2);
      this._buffer = void 0;
      this._bufferOffset = 0;
      this._reader = reader;
      this._done = false;
    }
    return _createClass5(StreamSource2, [{
      key: "slice",
      value: function slice(start, end) {
        if (start < this._bufferOffset) {
          return Promise.reject(new Error("Requested data is before the reader's current offset"));
        }
        return this._readUntilEnoughDataOrDone(start, end);
      }
    }, {
      key: "_readUntilEnoughDataOrDone",
      value: function _readUntilEnoughDataOrDone(start, end) {
        var _this = this;
        var hasEnoughData = end <= this._bufferOffset + len(this._buffer);
        if (this._done || hasEnoughData) {
          var value = this._getDataFromBuffer(start, end);
          var done = value == null ? this._done : false;
          return Promise.resolve({
            value,
            done
          });
        }
        return this._reader.read().then(function(_ref) {
          var value2 = _ref.value, done2 = _ref.done;
          if (done2) {
            _this._done = true;
          } else if (_this._buffer === void 0) {
            _this._buffer = value2;
          } else {
            _this._buffer = concat(_this._buffer, value2);
          }
          return _this._readUntilEnoughDataOrDone(start, end);
        });
      }
    }, {
      key: "_getDataFromBuffer",
      value: function _getDataFromBuffer(start, end) {
        if (start > this._bufferOffset) {
          this._buffer = this._buffer.slice(start - this._bufferOffset);
          this._bufferOffset = start;
        }
        var hasAllDataBeenRead = len(this._buffer) === 0;
        if (this._done && hasAllDataBeenRead) {
          return null;
        }
        return this._buffer.slice(0, end - start);
      }
    }, {
      key: "close",
      value: function close() {
        if (this._reader.cancel) {
          this._reader.cancel();
        }
      }
    }]);
  })();

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/fileReader.js
  function _typeof6(o) {
    "@babel/helpers - typeof";
    return _typeof6 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof6(o);
  }
  function _regeneratorRuntime2() {
    "use strict";
    _regeneratorRuntime2 = function _regeneratorRuntime3() {
      return e;
    };
    var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function(t2, e2, r2) {
      t2[e2] = r2.value;
    }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag";
    function define(t2, e2, r2) {
      return Object.defineProperty(t2, e2, { value: r2, enumerable: true, configurable: true, writable: true }), t2[e2];
    }
    try {
      define({}, "");
    } catch (t2) {
      define = function define2(t3, e2, r2) {
        return t3[e2] = r2;
      };
    }
    function wrap(t2, e2, r2, n2) {
      var i2 = e2 && e2.prototype instanceof Generator ? e2 : Generator, a2 = Object.create(i2.prototype), c2 = new Context(n2 || []);
      return o(a2, "_invoke", { value: makeInvokeMethod(t2, r2, c2) }), a2;
    }
    function tryCatch(t2, e2, r2) {
      try {
        return { type: "normal", arg: t2.call(e2, r2) };
      } catch (t3) {
        return { type: "throw", arg: t3 };
      }
    }
    e.wrap = wrap;
    var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {};
    function Generator() {
    }
    function GeneratorFunction() {
    }
    function GeneratorFunctionPrototype() {
    }
    var p = {};
    define(p, a, function() {
      return this;
    });
    var d = Object.getPrototypeOf, v = d && d(d(values([])));
    v && v !== r && n.call(v, a) && (p = v);
    var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p);
    function defineIteratorMethods(t2) {
      ["next", "throw", "return"].forEach(function(e2) {
        define(t2, e2, function(t3) {
          return this._invoke(e2, t3);
        });
      });
    }
    function AsyncIterator(t2, e2) {
      function invoke(r3, o2, i2, a2) {
        var c2 = tryCatch(t2[r3], t2, o2);
        if ("throw" !== c2.type) {
          var u2 = c2.arg, h2 = u2.value;
          return h2 && "object" == _typeof6(h2) && n.call(h2, "__await") ? e2.resolve(h2.__await).then(function(t3) {
            invoke("next", t3, i2, a2);
          }, function(t3) {
            invoke("throw", t3, i2, a2);
          }) : e2.resolve(h2).then(function(t3) {
            u2.value = t3, i2(u2);
          }, function(t3) {
            return invoke("throw", t3, i2, a2);
          });
        }
        a2(c2.arg);
      }
      var r2;
      o(this, "_invoke", { value: function value(t3, n2) {
        function callInvokeWithMethodAndArg() {
          return new e2(function(e3, r3) {
            invoke(t3, n2, e3, r3);
          });
        }
        return r2 = r2 ? r2.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
      } });
    }
    function makeInvokeMethod(e2, r2, n2) {
      var o2 = h;
      return function(i2, a2) {
        if (o2 === f) throw Error("Generator is already running");
        if (o2 === s) {
          if ("throw" === i2) throw a2;
          return { value: t, done: true };
        }
        for (n2.method = i2, n2.arg = a2; ; ) {
          var c2 = n2.delegate;
          if (c2) {
            var u2 = maybeInvokeDelegate(c2, n2);
            if (u2) {
              if (u2 === y) continue;
              return u2;
            }
          }
          if ("next" === n2.method) n2.sent = n2._sent = n2.arg;
          else if ("throw" === n2.method) {
            if (o2 === h) throw o2 = s, n2.arg;
            n2.dispatchException(n2.arg);
          } else "return" === n2.method && n2.abrupt("return", n2.arg);
          o2 = f;
          var p2 = tryCatch(e2, r2, n2);
          if ("normal" === p2.type) {
            if (o2 = n2.done ? s : l, p2.arg === y) continue;
            return { value: p2.arg, done: n2.done };
          }
          "throw" === p2.type && (o2 = s, n2.method = "throw", n2.arg = p2.arg);
        }
      };
    }
    function maybeInvokeDelegate(e2, r2) {
      var n2 = r2.method, o2 = e2.iterator[n2];
      if (o2 === t) return r2.delegate = null, "throw" === n2 && e2.iterator["return"] && (r2.method = "return", r2.arg = t, maybeInvokeDelegate(e2, r2), "throw" === r2.method) || "return" !== n2 && (r2.method = "throw", r2.arg = new TypeError("The iterator does not provide a '" + n2 + "' method")), y;
      var i2 = tryCatch(o2, e2.iterator, r2.arg);
      if ("throw" === i2.type) return r2.method = "throw", r2.arg = i2.arg, r2.delegate = null, y;
      var a2 = i2.arg;
      return a2 ? a2.done ? (r2[e2.resultName] = a2.value, r2.next = e2.nextLoc, "return" !== r2.method && (r2.method = "next", r2.arg = t), r2.delegate = null, y) : a2 : (r2.method = "throw", r2.arg = new TypeError("iterator result is not an object"), r2.delegate = null, y);
    }
    function pushTryEntry(t2) {
      var e2 = { tryLoc: t2[0] };
      1 in t2 && (e2.catchLoc = t2[1]), 2 in t2 && (e2.finallyLoc = t2[2], e2.afterLoc = t2[3]), this.tryEntries.push(e2);
    }
    function resetTryEntry(t2) {
      var e2 = t2.completion || {};
      e2.type = "normal", delete e2.arg, t2.completion = e2;
    }
    function Context(t2) {
      this.tryEntries = [{ tryLoc: "root" }], t2.forEach(pushTryEntry, this), this.reset(true);
    }
    function values(e2) {
      if (e2 || "" === e2) {
        var r2 = e2[a];
        if (r2) return r2.call(e2);
        if ("function" == typeof e2.next) return e2;
        if (!isNaN(e2.length)) {
          var o2 = -1, i2 = function next() {
            for (; ++o2 < e2.length; ) if (n.call(e2, o2)) return next.value = e2[o2], next.done = false, next;
            return next.value = t, next.done = true, next;
          };
          return i2.next = i2;
        }
      }
      throw new TypeError(_typeof6(e2) + " is not iterable");
    }
    return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: true }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: true }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function(t2) {
      var e2 = "function" == typeof t2 && t2.constructor;
      return !!e2 && (e2 === GeneratorFunction || "GeneratorFunction" === (e2.displayName || e2.name));
    }, e.mark = function(t2) {
      return Object.setPrototypeOf ? Object.setPrototypeOf(t2, GeneratorFunctionPrototype) : (t2.__proto__ = GeneratorFunctionPrototype, define(t2, u, "GeneratorFunction")), t2.prototype = Object.create(g), t2;
    }, e.awrap = function(t2) {
      return { __await: t2 };
    }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function() {
      return this;
    }), e.AsyncIterator = AsyncIterator, e.async = function(t2, r2, n2, o2, i2) {
      void 0 === i2 && (i2 = Promise);
      var a2 = new AsyncIterator(wrap(t2, r2, n2, o2), i2);
      return e.isGeneratorFunction(r2) ? a2 : a2.next().then(function(t3) {
        return t3.done ? t3.value : a2.next();
      });
    }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function() {
      return this;
    }), define(g, "toString", function() {
      return "[object Generator]";
    }), e.keys = function(t2) {
      var e2 = Object(t2), r2 = [];
      for (var n2 in e2) r2.push(n2);
      return r2.reverse(), function next() {
        for (; r2.length; ) {
          var t3 = r2.pop();
          if (t3 in e2) return next.value = t3, next.done = false, next;
        }
        return next.done = true, next;
      };
    }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e2) {
      if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = false, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e2) for (var r2 in this) "t" === r2.charAt(0) && n.call(this, r2) && !isNaN(+r2.slice(1)) && (this[r2] = t);
    }, stop: function stop() {
      this.done = true;
      var t2 = this.tryEntries[0].completion;
      if ("throw" === t2.type) throw t2.arg;
      return this.rval;
    }, dispatchException: function dispatchException(e2) {
      if (this.done) throw e2;
      var r2 = this;
      function handle(n2, o3) {
        return a2.type = "throw", a2.arg = e2, r2.next = n2, o3 && (r2.method = "next", r2.arg = t), !!o3;
      }
      for (var o2 = this.tryEntries.length - 1; o2 >= 0; --o2) {
        var i2 = this.tryEntries[o2], a2 = i2.completion;
        if ("root" === i2.tryLoc) return handle("end");
        if (i2.tryLoc <= this.prev) {
          var c2 = n.call(i2, "catchLoc"), u2 = n.call(i2, "finallyLoc");
          if (c2 && u2) {
            if (this.prev < i2.catchLoc) return handle(i2.catchLoc, true);
            if (this.prev < i2.finallyLoc) return handle(i2.finallyLoc);
          } else if (c2) {
            if (this.prev < i2.catchLoc) return handle(i2.catchLoc, true);
          } else {
            if (!u2) throw Error("try statement without catch or finally");
            if (this.prev < i2.finallyLoc) return handle(i2.finallyLoc);
          }
        }
      }
    }, abrupt: function abrupt(t2, e2) {
      for (var r2 = this.tryEntries.length - 1; r2 >= 0; --r2) {
        var o2 = this.tryEntries[r2];
        if (o2.tryLoc <= this.prev && n.call(o2, "finallyLoc") && this.prev < o2.finallyLoc) {
          var i2 = o2;
          break;
        }
      }
      i2 && ("break" === t2 || "continue" === t2) && i2.tryLoc <= e2 && e2 <= i2.finallyLoc && (i2 = null);
      var a2 = i2 ? i2.completion : {};
      return a2.type = t2, a2.arg = e2, i2 ? (this.method = "next", this.next = i2.finallyLoc, y) : this.complete(a2);
    }, complete: function complete(t2, e2) {
      if ("throw" === t2.type) throw t2.arg;
      return "break" === t2.type || "continue" === t2.type ? this.next = t2.arg : "return" === t2.type ? (this.rval = this.arg = t2.arg, this.method = "return", this.next = "end") : "normal" === t2.type && e2 && (this.next = e2), y;
    }, finish: function finish(t2) {
      for (var e2 = this.tryEntries.length - 1; e2 >= 0; --e2) {
        var r2 = this.tryEntries[e2];
        if (r2.finallyLoc === t2) return this.complete(r2.completion, r2.afterLoc), resetTryEntry(r2), y;
      }
    }, "catch": function _catch(t2) {
      for (var e2 = this.tryEntries.length - 1; e2 >= 0; --e2) {
        var r2 = this.tryEntries[e2];
        if (r2.tryLoc === t2) {
          var n2 = r2.completion;
          if ("throw" === n2.type) {
            var o2 = n2.arg;
            resetTryEntry(r2);
          }
          return o2;
        }
      }
      throw Error("illegal catch attempt");
    }, delegateYield: function delegateYield(e2, r2, n2) {
      return this.delegate = { iterator: values(e2), resultName: r2, nextLoc: n2 }, "next" === this.method && (this.arg = t), y;
    } }, e;
  }
  function asyncGeneratorStep2(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }
    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }
  function _asyncToGenerator2(fn) {
    return function() {
      var self2 = this, args = arguments;
      return new Promise(function(resolve, reject) {
        var gen = fn.apply(self2, args);
        function _next(value) {
          asyncGeneratorStep2(gen, resolve, reject, _next, _throw, "next", value);
        }
        function _throw(err) {
          asyncGeneratorStep2(gen, resolve, reject, _next, _throw, "throw", err);
        }
        _next(void 0);
      });
    };
  }
  function _classCallCheck6(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties6(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey6(descriptor.key), descriptor);
    }
  }
  function _createClass6(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties6(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties6(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey6(t) {
    var i = _toPrimitive6(t, "string");
    return "symbol" == _typeof6(i) ? i : i + "";
  }
  function _toPrimitive6(t, r) {
    if ("object" != _typeof6(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof6(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var FileReader2 = /* @__PURE__ */ (function() {
    function FileReader3() {
      _classCallCheck6(this, FileReader3);
    }
    return _createClass6(FileReader3, [{
      key: "openFile",
      value: (function() {
        var _openFile = _asyncToGenerator2(/* @__PURE__ */ _regeneratorRuntime2().mark(function _callee(input, chunkSize) {
          var blob;
          return _regeneratorRuntime2().wrap(function _callee$(_context) {
            while (1) switch (_context.prev = _context.next) {
              case 0:
                if (!(isReactNative_default() && input && typeof input.uri !== "undefined")) {
                  _context.next = 11;
                  break;
                }
                _context.prev = 1;
                _context.next = 4;
                return uriToBlob(input.uri);
              case 4:
                blob = _context.sent;
                return _context.abrupt("return", new FileSource(blob));
              case 8:
                _context.prev = 8;
                _context.t0 = _context["catch"](1);
                throw new Error("tus: cannot fetch `file.uri` as Blob, make sure the uri is correct and accessible. ".concat(_context.t0));
              case 11:
                if (!(typeof input.slice === "function" && typeof input.size !== "undefined")) {
                  _context.next = 13;
                  break;
                }
                return _context.abrupt("return", Promise.resolve(new FileSource(input)));
              case 13:
                if (!(typeof input.read === "function")) {
                  _context.next = 18;
                  break;
                }
                chunkSize = Number(chunkSize);
                if (Number.isFinite(chunkSize)) {
                  _context.next = 17;
                  break;
                }
                return _context.abrupt("return", Promise.reject(new Error("cannot create source for stream without a finite value for the `chunkSize` option")));
              case 17:
                return _context.abrupt("return", Promise.resolve(new StreamSource(input, chunkSize)));
              case 18:
                return _context.abrupt("return", Promise.reject(new Error("source object may only be an instance of File, Blob, or Reader in this environment")));
              case 19:
              case "end":
                return _context.stop();
            }
          }, _callee, null, [[1, 8]]);
        }));
        function openFile(_x, _x2) {
          return _openFile.apply(this, arguments);
        }
        return openFile;
      })()
    }]);
  })();

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/fileSignature.js
  function fingerprint(file, options) {
    if (isReactNative_default()) {
      return Promise.resolve(reactNativeFingerprint(file, options));
    }
    return Promise.resolve(["tus-br", file.name, file.type, file.size, file.lastModified, options.endpoint].join("-"));
  }
  function reactNativeFingerprint(file, options) {
    var exifHash = file.exif ? hashCode(JSON.stringify(file.exif)) : "noexif";
    return ["tus-rn", file.name || "noname", file.size || "nosize", exifHash, options.endpoint].join("/");
  }
  function hashCode(str) {
    var hash = 0;
    if (str.length === 0) {
      return hash;
    }
    for (var i = 0; i < str.length; i++) {
      var _char = str.charCodeAt(i);
      hash = (hash << 5) - hash + _char;
      hash &= hash;
    }
    return hash;
  }

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/httpStack.js
  function _typeof7(o) {
    "@babel/helpers - typeof";
    return _typeof7 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof7(o);
  }
  function _classCallCheck7(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties7(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey7(descriptor.key), descriptor);
    }
  }
  function _createClass7(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties7(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties7(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey7(t) {
    var i = _toPrimitive7(t, "string");
    return "symbol" == _typeof7(i) ? i : i + "";
  }
  function _toPrimitive7(t, r) {
    if ("object" != _typeof7(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof7(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var XHRHttpStack = /* @__PURE__ */ (function() {
    function XHRHttpStack2() {
      _classCallCheck7(this, XHRHttpStack2);
    }
    return _createClass7(XHRHttpStack2, [{
      key: "createRequest",
      value: function createRequest(method, url) {
        return new Request(method, url);
      }
    }, {
      key: "getName",
      value: function getName() {
        return "XHRHttpStack";
      }
    }]);
  })();
  var Request = /* @__PURE__ */ (function() {
    function Request2(method, url) {
      _classCallCheck7(this, Request2);
      this._xhr = new XMLHttpRequest();
      this._xhr.open(method, url, true);
      this._method = method;
      this._url = url;
      this._headers = {};
    }
    return _createClass7(Request2, [{
      key: "getMethod",
      value: function getMethod() {
        return this._method;
      }
    }, {
      key: "getURL",
      value: function getURL() {
        return this._url;
      }
    }, {
      key: "setHeader",
      value: function setHeader(header, value) {
        this._xhr.setRequestHeader(header, value);
        this._headers[header] = value;
      }
    }, {
      key: "getHeader",
      value: function getHeader(header) {
        return this._headers[header];
      }
    }, {
      key: "setProgressHandler",
      value: function setProgressHandler(progressHandler) {
        if (!("upload" in this._xhr)) {
          return;
        }
        this._xhr.upload.onprogress = function(e) {
          if (!e.lengthComputable) {
            return;
          }
          progressHandler(e.loaded);
        };
      }
    }, {
      key: "send",
      value: function send() {
        var _this = this;
        var body = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : null;
        return new Promise(function(resolve, reject) {
          _this._xhr.onload = function() {
            resolve(new Response(_this._xhr));
          };
          _this._xhr.onerror = function(err) {
            reject(err);
          };
          _this._xhr.send(body);
        });
      }
    }, {
      key: "abort",
      value: function abort() {
        this._xhr.abort();
        return Promise.resolve();
      }
    }, {
      key: "getUnderlyingObject",
      value: function getUnderlyingObject() {
        return this._xhr;
      }
    }]);
  })();
  var Response = /* @__PURE__ */ (function() {
    function Response2(xhr) {
      _classCallCheck7(this, Response2);
      this._xhr = xhr;
    }
    return _createClass7(Response2, [{
      key: "getStatus",
      value: function getStatus() {
        return this._xhr.status;
      }
    }, {
      key: "getHeader",
      value: function getHeader(header) {
        return this._xhr.getResponseHeader(header);
      }
    }, {
      key: "getBody",
      value: function getBody() {
        return this._xhr.responseText;
      }
    }, {
      key: "getUnderlyingObject",
      value: function getUnderlyingObject() {
        return this._xhr;
      }
    }]);
  })();

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/urlStorage.js
  function _typeof8(o) {
    "@babel/helpers - typeof";
    return _typeof8 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof8(o);
  }
  function _classCallCheck8(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties8(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey8(descriptor.key), descriptor);
    }
  }
  function _createClass8(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties8(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties8(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey8(t) {
    var i = _toPrimitive8(t, "string");
    return "symbol" == _typeof8(i) ? i : i + "";
  }
  function _toPrimitive8(t, r) {
    if ("object" != _typeof8(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof8(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var hasStorage = false;
  try {
    hasStorage = "localStorage" in window;
    key = "tusSupport";
    originalValue = localStorage.getItem(key);
    localStorage.setItem(key, originalValue);
    if (originalValue === null) localStorage.removeItem(key);
  } catch (e) {
    if (e.code === e.SECURITY_ERR || e.code === e.QUOTA_EXCEEDED_ERR) {
      hasStorage = false;
    } else {
      throw e;
    }
  }
  var key;
  var originalValue;
  var canStoreURLs = hasStorage;
  var WebStorageUrlStorage = /* @__PURE__ */ (function() {
    function WebStorageUrlStorage2() {
      _classCallCheck8(this, WebStorageUrlStorage2);
    }
    return _createClass8(WebStorageUrlStorage2, [{
      key: "findAllUploads",
      value: function findAllUploads() {
        var results = this._findEntries("tus::");
        return Promise.resolve(results);
      }
    }, {
      key: "findUploadsByFingerprint",
      value: function findUploadsByFingerprint(fingerprint2) {
        var results = this._findEntries("tus::".concat(fingerprint2, "::"));
        return Promise.resolve(results);
      }
    }, {
      key: "removeUpload",
      value: function removeUpload(urlStorageKey) {
        localStorage.removeItem(urlStorageKey);
        return Promise.resolve();
      }
    }, {
      key: "addUpload",
      value: function addUpload(fingerprint2, upload2) {
        var id = Math.round(Math.random() * 1e12);
        var key = "tus::".concat(fingerprint2, "::").concat(id);
        localStorage.setItem(key, JSON.stringify(upload2));
        return Promise.resolve(key);
      }
    }, {
      key: "_findEntries",
      value: function _findEntries(prefix) {
        var results = [];
        for (var i = 0; i < localStorage.length; i++) {
          var _key = localStorage.key(i);
          if (_key.indexOf(prefix) !== 0) continue;
          try {
            var upload2 = JSON.parse(localStorage.getItem(_key));
            upload2.urlStorageKey = _key;
            results.push(upload2);
          } catch (_e) {
          }
        }
        return results;
      }
    }]);
  })();

  // ANIMUS Android App/node_modules/tus-js-client/lib.esm/browser/index.js
  function _typeof9(o) {
    "@babel/helpers - typeof";
    return _typeof9 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof9(o);
  }
  function _classCallCheck9(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties9(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey9(descriptor.key), descriptor);
    }
  }
  function _createClass9(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties9(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties9(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _callSuper2(t, o, e) {
    return o = _getPrototypeOf2(o), _possibleConstructorReturn2(t, _isNativeReflectConstruct2() ? Reflect.construct(o, e || [], _getPrototypeOf2(t).constructor) : o.apply(t, e));
  }
  function _possibleConstructorReturn2(self2, call) {
    if (call && (_typeof9(call) === "object" || typeof call === "function")) {
      return call;
    } else if (call !== void 0) {
      throw new TypeError("Derived constructors may only return object or undefined");
    }
    return _assertThisInitialized2(self2);
  }
  function _assertThisInitialized2(self2) {
    if (self2 === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self2;
  }
  function _isNativeReflectConstruct2() {
    try {
      var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
      }));
    } catch (t2) {
    }
    return (_isNativeReflectConstruct2 = function _isNativeReflectConstruct3() {
      return !!t;
    })();
  }
  function _getPrototypeOf2(o) {
    _getPrototypeOf2 = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf3(o2) {
      return o2.__proto__ || Object.getPrototypeOf(o2);
    };
    return _getPrototypeOf2(o);
  }
  function _inherits2(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } });
    Object.defineProperty(subClass, "prototype", { writable: false });
    if (superClass) _setPrototypeOf2(subClass, superClass);
  }
  function _setPrototypeOf2(o, p) {
    _setPrototypeOf2 = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf3(o2, p2) {
      o2.__proto__ = p2;
      return o2;
    };
    return _setPrototypeOf2(o, p);
  }
  function ownKeys2(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function(r2) {
        return Object.getOwnPropertyDescriptor(e, r2).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread2(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys2(Object(t), true).forEach(function(r2) {
        _defineProperty2(e, r2, t[r2]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys2(Object(t)).forEach(function(r2) {
        Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
      });
    }
    return e;
  }
  function _defineProperty2(obj, key, value) {
    key = _toPropertyKey9(key);
    if (key in obj) {
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _toPropertyKey9(t) {
    var i = _toPrimitive9(t, "string");
    return "symbol" == _typeof9(i) ? i : i + "";
  }
  function _toPrimitive9(t, r) {
    if ("object" != _typeof9(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof9(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var defaultOptions2 = _objectSpread2(_objectSpread2({}, upload_default.defaultOptions), {}, {
    httpStack: new XHRHttpStack(),
    fileReader: new FileReader2(),
    urlStorage: canStoreURLs ? new WebStorageUrlStorage() : new NoopUrlStorage(),
    fingerprint
  });
  var Upload = /* @__PURE__ */ (function(_BaseUpload) {
    function Upload2() {
      var file = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : null;
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      _classCallCheck9(this, Upload2);
      options = _objectSpread2(_objectSpread2({}, defaultOptions2), options);
      return _callSuper2(this, Upload2, [file, options]);
    }
    _inherits2(Upload2, _BaseUpload);
    return _createClass9(Upload2, null, [{
      key: "terminate",
      value: function terminate(url) {
        var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        options = _objectSpread2(_objectSpread2({}, defaultOptions2), options);
        return upload_default.terminate(url, options);
      }
    }]);
  })(upload_default);
  var isSupported = typeof XMLHttpRequest === "function" && typeof Blob === "function" && typeof Blob.prototype.slice === "function";

  // portal-session.js
  var portalEndpoint = () => globalThis.window?.ANIMUS_APP_CONFIG ? "https://animus-v-1.pages.dev/api/customer-portal" : "/api/customer-portal";
  function createPortalTransport(snapshot, fetcher = fetch) {
    return async (action2, payload = {}, raw = false) => {
      const scope = snapshot();
      if (!scope.fileId) throw Error("Open a workfile before changing its portal.");
      const response = await fetcher(portalEndpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, fileId: scope.fileId, revision: scope.revision, action: action2 }), cache: "no-store", signal: AbortSignal.timeout(9e4) });
      const current = () => {
        const next = snapshot();
        if (next.fileId !== scope.fileId || next.generation !== scope.generation) throw Error("The workfile changed. Reopen its portal to refresh.");
      };
      current();
      if (!response.ok) {
        let result2;
        try {
          result2 = await response.json();
        } catch {
        }
        current();
        throw Object.assign(Error(result2?.error || "The portal operation did not finish."), { status: response.status });
      }
      if (raw) return response;
      const result = await response.json();
      current();
      return result;
    };
  }

  // portal-management.js
  var esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var when = (v) => v ? new Date(v).toLocaleString() : "Not recorded";
  var money = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);
  var field = (name, label, type = "text", extra = "") => `<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
  var area = (name, label, required = false) => `<label>${label}<textarea name="${name}" rows="4" maxlength="8000" ${required ? "required" : ""}></textarea></label>`;
  var check = (name, label, checked = false) => `<label class="pm-check"><input name="${name}" type="checkbox" ${checked ? "checked" : ""}>${label}</label>`;
  var button = (label, action2, attrs = "") => `<button type="button" data-pm="${action2}" ${attrs}>${label}</button>`;
  var assetOptions = (type) => context.state.assets.filter((a) => !a.archivedAt && (!type || a.type === type)).map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
  var fileId = "";
  var selectedFileId = "";
  var context = null;
  var section = "overview";
  var modal = null;
  var formModal = null;
  var upload = null;
  var cancelUpload = null;
  var lastSummary = 0;
  var summaryBusy = false;
  var openGeneration = 0;
  var sections = [["overview", "Overview"], ["estimates", "Estimates"], ["design", "Design Studio"], ["videos", "Videos"], ["messages", "Messages"], ["requests", "Requests"], ["updates", "Updates"], ["schedule", "Schedule"], ["payments", "Payments"], ["documents", "Documents"], ["aftercare", "Aftercare & Reviews"], ["settings", "Portal Settings"]];
  var api = createPortalTransport(() => ({ fileId, revision: context?.state.revision, generation: openGeneration }));
  function scopeGuard() {
    const id = fileId, generation = openGeneration;
    return () => {
      if (fileId !== id || generation !== openGeneration) throw Error("The workfile changed. Reopen its portal to continue.");
    };
  }
  function message(text, error = false) {
    const output = modal?.querySelector("#pmStatus");
    if (output) {
      output.textContent = text;
      output.classList.toggle("error", error);
    }
  }
  async function load(render = true) {
    context = await api("workspace");
    if (render) draw();
  }
  async function mutate(action2, payload = {}) {
    const result = await api(action2, payload);
    await load();
    await refreshSummary(true);
    return result;
  }
  function row(title, detail, actions = "") {
    return `<article class="pm-row"><div><strong>${esc(title)}</strong><p>${detail}</p></div><div class="pm-actions">${actions}</div></article>`;
  }
  function overview() {
    const s = context.state, p = context.project, lastVisit = s.events.filter((e) => e.type === "estimate.viewed").at(-1), viewCount = s.versions.filter((v) => v.kind === "estimate").reduce((sum, v) => sum + (s.stats?.views?.[v.id]?.count || 0), 0), views = { length: viewCount };
    return `<div class="pm-summary"><article><small>Last document access</small><strong>${when(lastVisit?.at)}</strong></article><article><small>Estimate access events</small><strong>${views.length}</strong></article><article><small>Unread messages</small><strong>${s.messages.filter((m) => m.from === "customer" && !m.readAt).length}</strong></article><article><small>Pending requests</small><strong>${s.requests.filter((r) => !["Resolved", "Declined", "Acknowledged"].includes(r.status)).length}</strong></article><article><small>Approved estimate</small><strong>${p.approvedAmount == null ? "Not approved" : money(p.approvedAmount)}</strong></article><article><small>Invoice balance</small><strong>${p.balance == null ? "No published invoice" : money(p.balance)}</strong></article></div><div class="pm-actions">${button("Publish current estimate & create project link", "publishEstimate")}${button("Manage private links", "links")}${button("Publish update", "update")}${button("Send message", "message")}</div><h3>Recent portal activity</h3>${s.events.slice(-20).reverse().map((e) => row(e.label, esc(when(e.at)))).join("") || "<p>No portal activity yet.</p>"}<p class="pm-muted">Access counts record actual successful document/video access events. Link possession and a typed name are recorded for approvals; this is not a verified-identity account service.</p>`;
  }
  function documents() {
    return `<div class="pm-actions">${button("Upload document / photo", "upload")}${button("Publish invoice / agreement / change order", "document")}</div>${context.state.assets.map((a) => row(a.name, `${esc(a.category)} \xB7 ${esc(a.uploadedBy)} \xB7 ${a.archivedAt ? "Archived" : a.publishedAt ? "Published" : "Private draft"}`, button("Preview / download", "asset", `data-id="${a.id}"`) + button(a.publishedAt ? "Unpublish" : "Publish", "publishAsset", `data-id="${a.id}" data-publish="${!a.publishedAt}"`) + button(a.archivedAt ? "Restore" : "Archive", "archive", `data-id="${a.id}" data-collection="assets" data-restore="${!!a.archivedAt}"`))).join("") || "<p>No portal attachments.</p>"}`;
  }
  function videos() {
    const archive = context.archive || {}, status = !archive.connected ? "Google Drive not connected" : !archive.enabled ? "Automatic archive paused" : archive.deletionEnabled ? "Archive and verified cleanup enabled" : "Copy-only testing; Cloudflare originals retained";
    return `<div class="pm-actions">${button("Upload MP4 walkthrough", "r2VideoUpload", 'class="portal-primary"')}${context.streamConfigured ? button("Upload with Stream", "videoUpload") : ""}</div><p class="pm-muted">${esc(status)}. Archive eligibility starts when the file is Closed / Paid and its final invoice is fully paid. Videos stay available for at least 30 days. Restored videos are held until you release the hold.</p>${context.state.videos.map((v) => {
      const r2 = v.provider === "r2", archived = !!v.storageArchivedAt;
      const status2 = v.deletedAt ? "Deleted" : archived ? "Archived to Google Drive" : v.ready ? "Ready" : v.status || "Upload incomplete";
      const actions = v.deletedAt ? "" : (r2 ? archived ? button(v.restoreRequestedAt ? "Restoration queued" : "Restore to portal", "videoRestore", `data-id="${v.id}" ${v.restoreRequestedAt ? "disabled" : ""}`) : button("Preview", "r2VideoPreview", `data-id="${v.id}"`) + button(v.archiveHold ? "Release archive hold" : "Keep on portal", "videoArchiveHold", `data-id="${v.id}" data-hold="${!v.archiveHold}"`) : button("Refresh processing", "streamStatus", `data-id="${v.id}"`) + button("Preview", "streamPreview", `data-id="${v.id}"`)) + (!archived && v.ready ? button(v.publishedAt ? "Unpublish" : "Publish", "publishVideo", `data-id="${v.id}" data-publish="${!v.publishedAt}"`) : "") + (!r2 ? button(v.archivedAt ? "Restore" : "Archive", "archive", `data-id="${v.id}" data-collection="videos" data-restore="${!!v.archivedAt}"`) + button("Delete permanently", "streamDelete", `data-id="${v.id}"`) : !v.ready ? button("Cancel upload", "r2VideoCancel", `data-id="${v.id}"`) : "");
      return row(v.title, `${esc(v.description)}<br>${esc(status2)} \xB7 ${v.publishedAt ? "Published" : "Private draft"}${v.archiveHold ? " \xB7 Archive held" : ""}${v.bytes ? " \xB7 " + (v.bytes / 1024 / 1024).toFixed(1) + " MB" : ""}`, actions);
    }).join("") || "<p>No walkthrough videos yet.</p>"}`;
  }
  function requests() {
    return context.state.requests.slice().reverse().map((r) => `<article class="pm-request"><header><div><small>${esc(r.kind)} \xB7 ${esc(r.category || "")} \xB7 ${when(r.createdAt)}</small><h3>${esc(r.title)} ${r.urgent ? '<span class="pm-urgent">Before next visit</span>' : ""}</h3></div><strong>${esc(r.status)}</strong></header><p class="pm-body-text">${esc(r.description)}</p>${r.rating ? `<p>Private feedback rating: ${r.rating}/5</p>` : ""}<div class="pm-actions">${(r.attachments || []).map((id) => button("Open attachment", "asset", `data-id="${id}"`)).join("")}${button("Reply", "reply", `data-id="${r.id}"`)}${button("Status / assign", "requestStatus", `data-id="${r.id}"`)}${button("Prepare workfile task", "workflow", `data-flow="task"`)}${["revision", "design", "special"].includes(r.kind) ? button("Prepare supplement", "workflow", 'data-flow="supplement"') : ""}</div>${(r.replies || []).map((reply) => `<blockquote>${esc(reply.text)}<small>${when(reply.at)}</small></blockquote>`).join("")}</article>`).join("") || "<p>No customer requests.</p>";
  }
  function draw() {
    if (!modal?.open || !context) return;
    const s = context.state, p = context.project;
    let content = "";
    if (section === "overview") content = overview();
    if (section === "estimates") content = `<div class="pm-actions">${button("Publish saved estimate", "publishEstimate")}${button("Open estimator", "workflow", 'data-flow="estimate"')}</div>${s.versions.map((v) => row(v.title, `V${v.sequence} \xB7 ${esc(v.kind)} \xB7 ${money(v.amount)} \xB7 ${when(v.publishedAt)}<br>${s.approvals.filter((a) => a.versionId === v.id).map((a) => `${esc(a.decision)} by ${esc(a.customerName)} \xB7 ${when(a.at)}`).join("") || "Awaiting response"}${v.kind === "change-order" ? "<br>Approval does not automatically change the CRM estimate. Apply the approved change using the existing supplement workflow." : ""}`, button("View snapshot", "version", `data-id="${v.id}"`))).join("")}`;
    if (section === "design") content = `<div class="pm-actions">${button("Upload GLB / drawing", "upload")}${button("Create design version", "design")}${button("Add material / finish selection", "selection")}</div><p>Export from SketchUp as a self-contained GLB 2.0 model. SKP files and externally linked glTF resources are not accepted.</p>${s.designs.map((d) => row(d.title, `V${d.version} \xB7 ${esc(d.status)} \xB7 ${esc(d.description)}`, button(d.publishedAt ? "Unpublish" : "Publish", "publishRecord", `data-id="${d.id}" data-collection="designs" data-publish="${!d.publishedAt}"`) + button(d.archivedAt ? "Restore" : "Archive", "archive", `data-id="${d.id}" data-collection="designs" data-restore="${!!d.archivedAt}"`))).join("")}${s.selections.map((selection) => row(selection.title, selection.response ? `Customer selection: ${esc(selection.options.find((o) => o.id === selection.response.optionId)?.label || "")} \xB7 ${when(selection.response.at)}` : "No customer selection yet")).join("")}`;
    if (section === "videos") content = videos();
    if (section === "messages") content = `<div class="pm-actions">${button("Send message", "message")}${button("Mark messages read", "markRead")}</div>${s.messages.slice().reverse().map((m) => row(m.from === "staff" ? "D2 team" : "Customer", `${esc(when(m.at))}${m.versionId ? " \xB7 Document version " + esc(s.versions.find((v) => v.id === m.versionId)?.title || m.versionId) : ""}${m.videoId ? " \xB7 Video " + esc(m.videoId) + " at " + m.seconds + " seconds" : ""}<br><span class="pm-body-text">${esc(m.text)}</span>`, (m.attachments || []).map((id) => button("Attachment", "asset", `data-id="${id}"`)).join(""))).join("")}`;
    if (section === "requests") content = requests();
    if (section === "updates") content = `<div class="pm-actions">${button("New update", "update")}${button("Upload photo", "upload")}</div>${s.updates.slice().reverse().map((u) => row(u.title, `${esc(u.description)}<br>${u.publishedAt ? "Published " + when(u.publishedAt) : "Private draft"}`, button(u.publishedAt ? "Unpublish" : "Publish", "publishRecord", `data-id="${u.id}" data-collection="updates" data-publish="${!u.publishedAt}"`) + button(u.archivedAt ? "Restore" : "Archive", "archive", `data-id="${u.id}" data-collection="updates" data-restore="${!!u.archivedAt}"`))).join("")}`;
    if (section === "schedule") content = `<div class="pm-actions">${button("Add milestone", "milestone")}${button("Add preparation item", "checklist")}${button("Open workfile schedule", "workflow", 'data-flow="schedule"')}</div><h3>CRM schedule</h3>${p.appointments.map((a) => row(a.title, `${esc(a.date)} ${esc(a.time)}${a.estimated ? " \xB7 Estimated" : ""}`)).join("") || "<p>No current dates recorded.</p>"}<h3>Milestones</h3>${s.milestones.map((m) => row(m.title, `${m.completedAt ? "Completed" : "Pending"} \xB7 ${m.published ? "Published" : "Private"}`, button(m.completedAt ? "Mark pending" : "Complete", "milestoneComplete", `data-id="${m.id}" data-completed="${!m.completedAt}" data-publish="${m.published}"`))).join("")}<h3>Customer preparation</h3>${s.checklist.map((i) => row(i.title, i.completed ? "Completed " + when(i.completedAt) : "Not completed")).join("")}`;
    if (section === "payments") content = `<div class="pm-summary"><article><small>Verified paid in CRM</small><strong>${money(p.paid)}</strong></article><article><small>Published invoice</small><strong>${p.invoiceAmount == null ? "Not published" : money(p.invoiceAmount)}</strong></article><article><small>Outstanding invoice balance</small><strong>${p.balance == null ? "No invoice" : money(p.balance)}</strong></article></div><div class="pm-actions">${button("Open invoice editor", "workflow", 'data-flow="invoice"')}${button("Publish invoice PDF", "document")}${button("Verify / update financials", "workflow", 'data-flow="financials"')}</div><p>Customer payment confirmations remain requests until staff verifies and records payment in the existing workfile financials. No card details are collected here.</p>`;
    if (section === "documents") content = documents();
    if (section === "aftercare") content = `<div class="pm-actions">${button("Upload warranty / care document", "upload")}${button("Add learning resource", "resource")}${button("Prepare review invitation", "reviewInvitation")}</div><p>Publish the actual warranty and care documents for this project. No coverage terms or effective dates are inferred.</p><h3>Review invitation</h3><p>${esc(s.reviewInvitation?.status || "Not prepared")}</p><h3>Service, completion & feedback</h3>${requests()}<p>Google review links are available to every customer, regardless of private feedback.</p>`;
    if (section === "settings") content = `<form id="pmSettings">${field("website", "Company website", "url")}${field("reviewUrl", "Verified Google Business Profile review link", "url")}${field("supportEmail", "Support email", "email")}${field("supportPhone", "Support phone", "tel")}${area("paymentInstructions", "Verified payment instructions")}${field("paymentUrl", "Existing Stripe / Square hosted payment link", "url")}<button class="portal-primary">Save portal settings</button></form><p>Automated SMS/email delivery is not configured. Communication preferences are recorded, but no message is falsely marked sent.</p>`;
    modal.innerHTML = `<header><div><h2>Customer Portal</h2><p>${esc(p.customerName)} \xB7 ${esc(p.fileNumber)}</p></div><div class="pm-actions">${button("Refresh", "refresh")}${button("Close", "close")}</div></header><nav class="pm-nav" aria-label="Portal management">${sections.map(([id, label]) => `<button data-pm-section="${id}" aria-current="${section === id ? "page" : "false"}">${label}</button>`).join("")}</nav><p id="pmStatus" role="status"></p><section class="pm-content">${content}</section>`;
    modal.querySelectorAll("[data-pm-section]").forEach((b) => b.onclick = () => {
      section = b.dataset.pmSection;
      draw();
    });
    modal.querySelectorAll("[data-pm]").forEach((b) => b.onclick = () => action(b).catch((error) => message(error.message, true)));
    const settings = modal.querySelector("#pmSettings");
    if (settings) {
      for (const [name, value] of Object.entries(s.settings)) if (settings.elements[name]) settings.elements[name].value = value;
      settings.onsubmit = async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(settings));
        try {
          await mutate("settings", payload);
          message("Portal settings saved.");
        } catch (error) {
          message(error.message, true);
        }
      };
    }
  }
  function editor(title, body, save) {
    if (upload) throw Error("Finish or cancel the active upload before opening another editor.");
    formModal?.remove();
    const form = document.createElement("dialog");
    form.className = "portal-admin pm-editor";
    formModal = form;
    form.innerHTML = `<header><h2>${esc(title)}</h2><button type="button" data-pm-close aria-label="Close">\xD7</button></header><form>${body}<p role="alert"></p>${save ? '<button class="portal-primary" type="submit">Save</button>' : ""}</form>`;
    document.body.append(form);
    form.querySelector("[data-pm-close]").onclick = () => form.close();
    form.addEventListener("close", () => {
      cancelUpload?.();
      form.remove();
    });
    if (save) form.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const el = event.currentTarget, submit = el.querySelector("[type=submit]");
      submit.disabled = true;
      el.querySelector("[role=alert]").textContent = "";
      try {
        await save(new FormData(el), el);
        form.close();
      } catch (error) {
        el.querySelector("[role=alert]").textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    };
    form.showModal();
    return form;
  }
  async function encodedFile(file) {
    if (file.size > 25 * 1024 * 1024) throw Error("Use a file under 25 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  async function uploadAttachment(file, category) {
    const checkScope = scopeGuard(), content = await encodedFile(file);
    checkScope();
    const result = await api("uploadAsset", { name: file.name, type: file.name.toLowerCase().endsWith(".glb") ? "model/gltf-binary" : file.type, category, content });
    await load(false);
    return result;
  }
  async function publishEstimate() {
    const sourceId = fileId, generation = openGeneration, checkScope = () => {
      if (fileId !== sourceId || generation !== openGeneration) throw Error("The workfile changed. Reopen its portal before publishing.");
    };
    const response = await fetch(`${portalEndpoint()}?fileId=${encodeURIComponent(sourceId)}`, { cache: "no-store" }), saved = await response.json();
    checkScope();
    if (!response.ok) throw Error(saved.error || "Saved estimate unavailable.");
    let pdf;
    if (!saved.file.hasAttachedPdf) {
      if (!saved.file.editableEstimate) throw Error("Attach an estimate first.");
      const blob = await window.AnimusPortalPdf.create(saved.file.editableEstimate);
      pdf = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    checkScope();
    const created = await api("create", { estimateHash: saved.estimateHash, expiresDays: 30, pdf, projectAccess: true });
    await load();
    editor("Private project link", `<p>The current saved estimate is published. Existing project links can see this version; estimate-only links remain unchanged.</p>${field("link", "Private customer link", "text", "readonly")}<div class="pm-actions"><button type="button" data-preview-link>View customer portal</button><button type="button" data-copy-link>Copy link</button><button type="button" data-share-link>Share link</button></div><p role="status" data-link-status></p><p>Expires ${when(created.expiresAt)}. Share only with the intended customer.</p>`);
    const linkForm = formModal;
    linkForm.querySelector("[name=link]").value = created.url;
    linkForm.querySelector("[data-preview-link]").onclick = () => window.open(created.url, "_blank", "noopener,noreferrer");
    linkForm.querySelector("[data-copy-link]").onclick = async () => {
      const input = linkForm.querySelector("[name=link]");
      try {
        await navigator.clipboard.writeText(created.url);
        linkForm.querySelector("[data-link-status]").textContent = "Link copied.";
      } catch {
        input.focus();
        input.select();
        linkForm.querySelector("[data-link-status]").textContent = "Select and copy the private link.";
      }
    };
    linkForm.querySelector("[data-share-link]").onclick = async () => {
      try {
        if (navigator.share) await navigator.share({ title: "Your D2 project portal", url: created.url });
        else linkForm.querySelector("[data-copy-link]").click();
      } catch (error) {
        if (error.name !== "AbortError") linkForm.querySelector("[data-link-status]").textContent = "Sharing could not finish. Use Copy link.";
      }
    };
  }
  async function action(button2) {
    const op = button2.dataset.pm, recordId = button2.dataset.id;
    if (op === "close") {
      modal.close();
      return;
    }
    if (op === "refresh") {
      await load();
      return;
    }
    if (op === "links") {
      modal.close();
      window.AnimusCustomerPortal.open(fileId);
      return;
    }
    if (op === "publishEstimate") {
      button2.disabled = true;
      try {
        await publishEstimate();
      } finally {
        button2.disabled = false;
      }
      return;
    }
    if (op === "workflow") {
      const flow = button2.dataset.flow;
      modal.close();
      formModal?.close();
      if (window.AnimusMobilePortalWorkflow) {
        window.AnimusMobilePortalWorkflow(flow, fileId);
        return;
      }
      if (flow === "task") document.querySelector('#animusWorkFile [data-animus-edit="action"]')?.click();
      else if (["financials", "schedule"].includes(flow)) document.querySelector(`#animusWorkFile [data-animus-edit="${flow === "financials" ? "financials" : "details"}"]`)?.click();
      else document.getElementById({ estimate: "crmOpenEstimate", supplement: "crmCreateSupplement", invoice: "crmOpenInvoice" }[flow])?.click();
      return;
    }
    if (op === "upload") {
      editor("Upload portal attachment", `${field("file", "PDF, image, or self-contained GLB", "file", 'accept=".pdf,.jpg,.jpeg,.png,.webp,.glb" required')}<label>Category<select name="category">${["Documents", "Drawings", "Warranty", "Care Instructions", "Receipt", "Project Photos", "Material Specifications", "Learning Center"].map((c) => `<option>${c}</option>`).join("")}</select></label><p>Uploads are private drafts until you publish them.</p>`, async (data, form) => {
        await uploadAttachment(form.file.files[0], data.get("category"));
        await load();
      });
      return;
    }
    if (op === "message" || op === "reply") {
      editor(op === "reply" ? "Reply to customer request" : "Send customer message", area("message", "Customer-visible message", true), async (data) => mutate("reply", { message: data.get("message"), ...op === "reply" ? { requestId: recordId } : {} }));
      return;
    }
    if (op === "requestStatus") {
      const request = context.state.requests.find((r) => r.id === recordId);
      editor("Request status & assignment", `<p>${esc(request.title)}</p><label>Status<select name="status">${["Submitted", "Under Review", "Acknowledged", "Resolved", "Declined"].map((s) => `<option ${request.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>${field("assignedTo", "Assigned staff / team", "text", `value="${esc(request.assignedTo || "")}"`)}`, async (data) => mutate("requestStatus", { requestId: recordId, ...Object.fromEntries(data) }));
      return;
    }
    if (op === "update") {
      editor("Project update", field("title", "Title", "text", 'required maxlength="180"') + area("description", "Customer-visible update", true) + check("publish", "Publish to customer now") + `<label>Attach published photos / documents<select name="assets" multiple>${assetOptions()}</select></label>`, async (data) => mutate("publishUpdate", { title: data.get("title"), description: data.get("description"), publish: data.has("publish"), attachments: data.getAll("assets") }));
      return;
    }
    if (op === "design") {
      editor("New design version", field("title", "Design title", "text", "required") + area("description", "Design description") + `<label>Uploaded GLB<select name="assetId" required>${assetOptions("model/gltf-binary")}</select></label>` + check("publish", "Publish for customer review"), async (data) => mutate("publishDesign", { title: data.get("title"), description: data.get("description"), assetId: data.get("assetId"), publish: data.has("publish") }));
      return;
    }
    if (op === "document") {
      editor("Publish original PDF", `<label>Kind<select name="kind"><option value="invoice">Invoice</option><option value="agreement">Agreement</option><option value="change-order">Change order</option></select></label><label>Original uploaded PDF<select name="assetId" required>${assetOptions("application/pdf")}</select></label>${field("title", "Document title", "text", "required")}${field("amount", "Proposed amount (change order / agreement)", "number", 'step="0.01"')}${field("dueDate", "Payment due date", "date")}${area("scheduleImpact", "Schedule implications")}<p>Invoice amounts use the current CRM invoice/estimate amount. Publishing a PDF never edits CRM finances.</p>`, async (data) => mutate("publishDocument", Object.fromEntries(data)));
      return;
    }
    if (op === "selection") {
      editor("Material / finish selection", field("title", "Selection title", "text", "required") + area("description", "Description") + area("options", "Options, one per line: label | proposed price difference", true) + check("publish", "Publish selection"), async (data) => mutate("selectionOption", { title: data.get("title"), description: data.get("description"), publish: data.has("publish"), options: String(data.get("options")).split("\n").filter((s) => s.trim()).map((s) => {
        const [label, amount] = s.split("|");
        return { label: label.trim(), priceDifference: Number(amount) || 0 };
      }) }));
      return;
    }
    if (op === "milestone") {
      editor("Project milestone", field("title", "Milestone title", "text", "required") + area("description", "Description") + field("estimatedDate", "Estimated date", "date") + field("confirmedDate", "Confirmed date", "date") + check("completed", "Completed") + check("publish", "Visible to customer"), async (data) => mutate("milestone", { ...Object.fromEntries(data), completed: data.has("completed"), publish: data.has("publish") }));
      return;
    }
    if (op === "checklist") {
      editor("Preparation checklist item", field("title", "Customer preparation task", "text", "required"), async (data) => mutate("checklistItem", { title: data.get("title") }));
      return;
    }
    if (op === "resource") {
      editor("Learning resource", field("title", "Title", "text", "required") + field("url", "Resource URL", "url", "required") + field("projectType", "Relevant project type") + area("description", "Description") + check("publish", "Publish resource"), async (data) => mutate("learningResource", { ...Object.fromEntries(data), publish: data.has("publish") }));
      return;
    }
    if (op === "r2VideoUpload") {
      if (!context.r2VideosConfigured) throw Error("MP4 uploads are not enabled in this environment.");
      editor("Upload MP4 walkthrough", field("file", "MP4 recording", "file", 'accept="video/mp4,.mp4" required') + field("title", "Video title", "text", 'required maxlength="180"') + area("description", "Description") + field("designVersion", "Design version") + '<p id="pmVideoProgress" role="status"></p>', async (data, form) => {
        const guard = scopeGuard(), file = form.file.files[0];
        if (!file || file.size > 500 * 1024 * 1024) throw Error("Choose an MP4 up to 500 MB.");
        let cancelled = false, created;
        upload = {};
        cancelUpload = () => {
          cancelled = true;
        };
        try {
          created = await api("videoUploadStart", { bytes: file.size, type: "video/mp4", name: file.name, title: data.get("title"), description: data.get("description"), designVersion: data.get("designVersion") });
          for (let offset = 0, partNumber = 1; offset < file.size; offset += created.partBytes, partNumber++) {
            guard();
            if (cancelled || !form.isConnected) throw Error("Video upload cancelled.");
            const content = await encodedFile(file.slice(offset, offset + created.partBytes));
            await api("videoUploadPart", { videoId: created.id, partNumber, content });
            form.querySelector("#pmVideoProgress").textContent = `${Math.min(100, Math.round((offset + created.partBytes) / file.size * 100))}% uploaded`;
          }
          guard();
          if (cancelled) throw Error("Video upload cancelled.");
          await api("videoUploadComplete", { videoId: created.id });
        } catch (error) {
          if (created) await api("videoUploadCancel", { videoId: created.id }).catch(() => {
          });
          throw error;
        } finally {
          upload = null;
          cancelUpload = null;
        }
        await load();
      });
      return;
    }
    if (op === "r2VideoPreview") {
      const guard = scopeGuard(), response = await api("videoPreview", { videoId: recordId }, true), blob = await response.blob();
      guard();
      const url = URL.createObjectURL(blob), preview = editor("Walkthrough preview", `<video controls playsinline preload="metadata" src="${url}" aria-label="Walkthrough preview"></video>`);
      preview.addEventListener("close", () => URL.revokeObjectURL(url));
      return;
    }
    if (op === "r2VideoCancel") {
      await api("videoUploadCancel", { videoId: recordId });
      await load();
      return;
    }
    if (op === "videoArchiveHold") {
      await mutate("videoArchiveHold", { videoId: recordId, hold: button2.dataset.hold === "true" });
      return;
    }
    if (op === "videoRestore") {
      await mutate("videoRestore", { videoId: recordId });
      return;
    }
    if (op === "videoUpload") {
      if (!context.streamConfigured) throw Error("Connect Cloudflare Stream before uploading.");
      editor("Upload walkthrough", field("file", "Video recording", "file", 'accept="video/*" required') + field("title", "Video title", "text", "required") + area("description", "Description") + field("designVersion", "Design version") + '<p id="pmTusStatus" role="status"></p><button type="button" id="pmPause" hidden>Pause</button><button type="button" id="pmResume" hidden>Resume</button>', async (data, form) => {
        const file = form.file.files[0], created = await api("streamUpload", { bytes: file.size, title: data.get("title"), description: data.get("description"), designVersion: data.get("designVersion") });
        if (!form.isConnected) throw Error("Upload cancelled before transfer started.");
        try {
          await new Promise((resolve, reject) => {
            const transfer = new Upload(file, { uploadUrl: created.uploadUrl, chunkSize: 10 * 1024 * 1024, retryDelays: [0, 1e3, 3e3, 5e3, 1e4], storeFingerprintForResuming: false, onError: reject, onProgress: (sent, total) => {
              form.querySelector("#pmTusStatus").textContent = `${Math.round(sent / total * 100)}% uploaded`;
            }, onSuccess: resolve });
            upload = transfer;
            cancelUpload = () => {
              transfer.abort().catch(() => {
              });
              reject(Error("Upload cancelled. The unpublished video remains private."));
            };
            const pause = form.querySelector("#pmPause"), resume = form.querySelector("#pmResume");
            pause.hidden = false;
            pause.onclick = async () => {
              try {
                await transfer.abort();
                pause.hidden = true;
                resume.hidden = false;
                form.querySelector("#pmTusStatus").textContent = "Paused. Resume here or close to cancel.";
              } catch (error) {
                reject(error);
              }
            };
            resume.onclick = () => {
              transfer.start();
              resume.hidden = true;
              pause.hidden = false;
            };
            transfer.start();
          });
        } finally {
          upload = null;
          cancelUpload = null;
        }
        await load();
      });
      return;
    }
    if (op === "streamPreview") {
      const result = await api("streamPreview", { videoId: recordId });
      editor("Private video preview", `<iframe title="Walkthrough preview" src="${esc(result.url)}" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe>`);
      return;
    }
    if (op === "streamStatus") {
      await api("streamStatus", { videoId: recordId });
      await load();
      return;
    }
    if (op === "streamDelete") {
      const video = context.state.videos.find((v) => v.id === recordId);
      editor("Permanently delete video", `<p>This permanently deletes the Cloudflare Stream video. Published playback will stop. Type the video title to confirm.</p>${field("confirm", "Video title", "text", "required")}`, async (data) => {
        if (data.get("confirm") !== video.title) throw Error("The title does not match.");
        await api("streamDelete", { videoId: video.id, confirmUid: video.uid });
        await load();
      });
      return;
    }
    if (op === "asset" || op === "version") {
      const checkScope = scopeGuard();
      let response, label;
      if (op === "asset") {
        label = context.state.assets.find((a2) => a2.id === recordId)?.name || "D2-document";
        response = await api("adminAsset", { assetId: recordId }, true);
      } else {
        const v = context.state.versions.find((v2) => v2.id === recordId);
        response = await api("adminDocument", { versionId: recordId }, true);
        const blob2 = await response.blob();
        checkScope();
        const url2 = URL.createObjectURL(blob2);
        const preview = editor("Published document", `<p>${esc(v.title)} \xB7 ${money(v.amount)}</p><iframe title="Published PDF" src="${url2}"></iframe><a href="${url2}" download="D2-document.pdf">Download original PDF</a>`);
        preview.addEventListener("close", () => URL.revokeObjectURL(url2));
        return;
      }
      const blob = await response.blob();
      checkScope();
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url;
      a.download = label;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3e4);
      return;
    }
    if (op === "markRead" || op === "reviewInvitation") {
      await mutate(op);
      return;
    }
    if (op === "publishAsset") {
      await mutate("publishAsset", { assetId: recordId, publish: button2.dataset.publish === "true" });
      return;
    }
    if (op === "publishVideo") {
      await mutate("publishVideo", { videoId: recordId, publish: button2.dataset.publish === "true" });
      return;
    }
    if (op === "publishRecord") {
      await mutate("publishRecord", { id: recordId, collection: button2.dataset.collection, publish: button2.dataset.publish === "true" });
      return;
    }
    if (op === "milestoneComplete") {
      await mutate("updateMilestone", { id: recordId, completed: button2.dataset.completed === "true", publish: button2.dataset.publish === "true" });
      return;
    }
    if (op === "archive") {
      await mutate("archive", { id: recordId, collection: button2.dataset.collection, restore: button2.dataset.restore === "true" });
      return;
    }
  }
  async function open(id, selected = "overview") {
    if (upload || formModal?.open) throw Error("Finish or close the active editor before switching workfiles.");
    fileId = id;
    context = null;
    section = selected;
    const generation = ++openGeneration;
    if (!modal) {
      modal = document.createElement("dialog");
      modal.className = "portal-admin portal-management";
      document.body.append(modal);
      modal.addEventListener("cancel", (event) => {
        if (upload) event.preventDefault();
      });
    }
    modal.innerHTML = '<p role="status">Loading private project workspace\u2026</p>';
    if (!modal.open) modal.showModal();
    try {
      await load(false);
      if (generation === openGeneration) draw();
    } catch (error) {
      if (generation !== openGeneration) return;
      modal.innerHTML = `<p role="alert">${esc(error.message)}</p><button type="button">Close</button>`;
      modal.querySelector("button").onclick = () => modal.close();
    }
  }
  window.AnimusPortalManagement = { open };
  window.addEventListener("animus-portal-file", (event) => {
    selectedFileId = event.detail.fileId;
  });
  function attach() {
    const host = document.getElementById("customerPortalAdmin");
    if (!host?.querySelector("#createPortalLink") || host.querySelector("[data-pm-entry]")) return;
    const label = document.createElement("label");
    label.className = "pm-check";
    label.innerHTML = '<input id="portalProjectAccess" type="checkbox" checked>Include customer project portal';
    host.querySelector("#createPortalLink").before(label);
    const entry = document.createElement("button");
    entry.type = "button";
    entry.dataset.pmEntry = "";
    entry.textContent = "Manage project content";
    entry.onclick = () => {
      host.close();
      open(selectedFileId).catch((error) => {
        host.showModal();
        const output = host.querySelector("[role=status]");
        if (output) output.textContent = error.message;
      });
    };
    host.querySelector("header").after(entry);
  }
  new MutationObserver(attach).observe(document.getElementById("customerPortalAdmin") || document.body, { childList: true, subtree: true });
  attach();
  async function refreshSummary(force = false) {
    if (summaryBusy || !force && Date.now() - lastSummary < 6e4 || typeof crmCloudAuthoritativeLoaded !== "undefined" && !crmCloudAuthoritativeLoaded) return;
    summaryBusy = true;
    try {
      const response = await fetch(`${portalEndpoint()}?summary=1`, { cache: "no-store" });
      if (!response.ok) throw Error();
      window.animusPortalSummary = await response.json();
      lastSummary = Date.now();
      window.animusDashboardRender?.();
    } catch {
      window.animusPortalSummaryUnavailable = true;
    } finally {
      summaryBusy = false;
    }
  }
  window.animusRefreshPortalSummary = refreshSummary;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && document.body.dataset.animusView === "dashboard") refreshSummary();
  });
  setInterval(() => {
    if (!document.hidden && document.body.dataset.animusView === "dashboard") refreshSummary();
  }, 12e4);
})();
/*! Bundled license information:

tus-js-client/lib.esm/upload.js:
tus-js-client/lib.esm/browser/fileReader.js:
  (*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE *)
*/
