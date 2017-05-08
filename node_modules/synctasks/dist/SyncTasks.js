/**
 * SyncTasks.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * A very simple promise library that resolves all promises synchronously instead of
 * kicking them back to the main ticking thread.  This affirmatively rejects the A+
 * standard for promises, and is used for a combination of performance (wrapping
 * things back to the main thread is really slow) and because indexeddb loses
 * context for its calls if you send them around the event loop and transactions
 * automatically close.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = {
    // If we catch exceptions in success/fail blocks, it silently falls back to the fail case of the outer promise.
    // If this is global variable is true, it will also spit out a console.error with the exception for debugging.
    exceptionsToConsole: true,
    // Whether or not to actually attempt to catch exceptions with try/catch blocks inside the resolution cases.
    // Disable this for debugging when you'd rather the debugger caught the exception synchronously rather than
    // digging through a stack trace.
    catchExceptions: true,
    // Use this option in order to debug double resolution asserts locally.
    // Enabling this option in the release would have a negative impact on the application performance.
    traceEnabled: false,
    exceptionHandler: null,
    // If an ErrorFunc is not added to the task (then, catch, always) before the task rejects or synchonously
    // after that, then this function is called with the error. Default throws the error.
    unhandledErrorHandler: (function (err) { throw err; })
};
function fromThenable(thenable) {
    var deferred = Defer();
    // NOTE: The {} around the error handling is critical to ensure that
    // we do not trigger "Possible unhandled rejection" warnings. By adding
    // the braces, the error handler rejects the outer promise, but returns
    // void. If we remove the braces, it would *also* return something which
    // would be unhandled
    thenable.then(function (value) { deferred.resolve(value); return undefined; }, function (err) { deferred.reject(err); });
    return deferred.promise();
}
exports.fromThenable = fromThenable;
function isThenable(object) {
    return object !== null && object !== void 0 && typeof object.then === 'function';
}
function isCancelable(object) {
    return object !== null && object !== void 0 && typeof object.cancel === 'function';
}
// Runs trier(). If config.catchExceptions is set then any exception is caught and handed to catcher.
function run(trier, catcher) {
    if (exports.config.catchExceptions) {
        // Any try/catch/finally block in a function makes the entire function ineligible for optimization is most JS engines.
        // Make sure this stays in a small/quick function, or break out into its own function.
        try {
            return trier();
        }
        catch (e) {
            return catcher(e);
        }
    }
    else {
        return trier();
    }
}
var asyncCallbacks = [];
// Ideally, we use setImmediate, but that's only supported on some environments.
// Suggestion: Use the "setimmediate" NPM package to polyfill where it's not available.
var useSetImmediate = typeof setImmediate !== 'undefined';
/**
 * This function will defer callback of the specified callback lambda until the next JS tick, simulating standard A+ promise behavior
 */
function asyncCallback(callback) {
    asyncCallbacks.push(callback);
    if (asyncCallbacks.length === 1) {
        // Start a callback for the next tick
        if (useSetImmediate) {
            setImmediate(resolveAsyncCallbacks);
        }
        else {
            setTimeout(resolveAsyncCallbacks, 0);
        }
    }
}
exports.asyncCallback = asyncCallback;
function resolveAsyncCallbacks() {
    var savedCallbacks = asyncCallbacks;
    asyncCallbacks = [];
    for (var i = 0; i < savedCallbacks.length; i++) {
        savedCallbacks[i]();
    }
}
function Defer() {
    return new Internal.SyncTask();
}
exports.Defer = Defer;
function Resolved(val) {
    return new Internal.SyncTask().resolve(val).promise();
}
exports.Resolved = Resolved;
function Rejected(val) {
    return new Internal.SyncTask().reject(val).promise();
}
exports.Rejected = Rejected;
var Internal;
(function (Internal) {
    var SyncTask = (function () {
        function SyncTask() {
            this._completedSuccess = false;
            this._completedFail = false;
            this._traceEnabled = false;
            this._cancelCallbacks = [];
            this._wasCanceled = false;
            this._resolving = false;
            this._storedCallbackSets = [];
            // 'Handled' just means there was a callback set added.
            // Note: If that callback does not handle the error then that callback's task will be 'unhandled' instead of this one.
            this._mustHandleError = true;
        }
        SyncTask.prototype._addCallbackSet = function (set, callbackWillChain) {
            var task = new SyncTask();
            task.onCancel(this.cancel.bind(this));
            set.task = task;
            this._storedCallbackSets.push(set);
            if (callbackWillChain) {
                // The callback inherits responsibility for "handling" errors.
                this._mustHandleError = false;
            }
            else {
                // The callback can never "handle" errors since nothing can chain to it.
                task._mustHandleError = false;
            }
            // The _resolve* functions handle callbacks being added while they are running.
            if (!this._resolving) {
                if (this._completedSuccess) {
                    this._resolveSuccesses();
                }
                else if (this._completedFail) {
                    this._resolveFailures();
                }
            }
            return task.promise();
        };
        SyncTask.prototype.onCancel = function (callback) {
            // Only register cancel callback handler on promise that hasn't been completed
            if (!this._completedSuccess && !this._completedFail) {
                if (this._wasCanceled) {
                    callback(this._cancelContext);
                }
                else {
                    this._cancelCallbacks.push(callback);
                }
            }
            return this;
        };
        SyncTask.prototype.then = function (successFunc, errorFunc) {
            return this._addCallbackSet({
                successFunc: successFunc,
                failFunc: errorFunc
            }, true);
        };
        SyncTask.prototype.thenAsync = function (successFunc, errorFunc) {
            return this._addCallbackSet({
                successFunc: successFunc,
                failFunc: errorFunc,
                asyncCallback: true
            }, true);
        };
        SyncTask.prototype.catch = function (errorFunc) {
            return this._addCallbackSet({
                failFunc: errorFunc
            }, true);
        };
        SyncTask.prototype.always = function (func) {
            return this._addCallbackSet({
                successFunc: func,
                failFunc: func
            }, true);
        };
        SyncTask.prototype.setTracingEnabled = function (enabled) {
            this._traceEnabled = enabled;
            return this;
        };
        // Finally should let you inspect the value of the promise as it passes through without affecting the then chaining
        // i.e. a failed promise with a finally after it should then chain to the fail case of the next then
        SyncTask.prototype.finally = function (func) {
            this._addCallbackSet({
                successFunc: func,
                failFunc: func
            }, false);
            return this;
        };
        SyncTask.prototype.done = function (successFunc) {
            this._addCallbackSet({
                successFunc: successFunc
            }, false);
            return this;
        };
        SyncTask.prototype.fail = function (errorFunc) {
            this._addCallbackSet({
                failFunc: errorFunc
            }, false);
            return this;
        };
        SyncTask.prototype.resolve = function (obj) {
            this._checkState(true);
            this._completedSuccess = true;
            this._storedResolution = obj;
            this._resolveSuccesses();
            return this;
        };
        SyncTask.prototype.reject = function (obj) {
            this._checkState(false);
            this._completedFail = true;
            this._storedErrResolution = obj;
            this._resolveFailures();
            SyncTask._enforceErrorHandled(this);
            return this;
        };
        SyncTask.prototype._checkState = function (resolve) {
            if (this._completedSuccess || this._completedFail) {
                if (this._completeStack) {
                    console.error(this._completeStack.message, this._completeStack.stack);
                }
                var message = 'Failed to ' + (resolve ? 'resolve' : 'reject') +
                    ': the task is already ' + (this._completedSuccess ? 'resolved' : 'rejected');
                throw new Error(message);
            }
            if (exports.config.traceEnabled || this._traceEnabled) {
                this._completeStack = new Error('Initial ' + resolve ? 'resolve' : 'reject');
            }
        };
        // Make sure any rejected task has its failured handled.
        SyncTask._enforceErrorHandled = function (task) {
            if (!task._mustHandleError) {
                return;
            }
            SyncTask._rejectedTasks.push(task);
            // Wait for some async time in the future to check these tasks.
            if (!SyncTask._enforceErrorHandledTimer) {
                SyncTask._enforceErrorHandledTimer = setTimeout(function () {
                    SyncTask._enforceErrorHandledTimer = null;
                    var rejectedTasks = SyncTask._rejectedTasks;
                    SyncTask._rejectedTasks = [];
                    rejectedTasks.forEach(function (rejectedTask, i) {
                        if (rejectedTask._mustHandleError) {
                            // Unhandled!
                            exports.config.unhandledErrorHandler(rejectedTask._storedErrResolution);
                        }
                    });
                }, 0);
            }
        };
        SyncTask.prototype.cancel = function (context) {
            var _this = this;
            if (this._wasCanceled) {
                throw new Error('Already Canceled');
            }
            this._wasCanceled = true;
            this._cancelContext = context;
            if (this._cancelCallbacks.length > 0) {
                this._cancelCallbacks.forEach(function (callback) {
                    if (!_this._completedSuccess && !_this._completedFail) {
                        callback(_this._cancelContext);
                    }
                });
            }
        };
        SyncTask.prototype.promise = function () {
            return this;
        };
        SyncTask.prototype._resolveSuccesses = function () {
            var _this = this;
            this._resolving = true;
            // New callbacks can be added as the current callbacks run: use a loop to get through all of them.
            while (this._storedCallbackSets.length) {
                // Only iterate over the current list of callbacks.
                var callbacks = this._storedCallbackSets;
                this._storedCallbackSets = [];
                callbacks.forEach(function (callback) {
                    if (callback.asyncCallback) {
                        asyncCallback(_this._resolveCallback.bind(_this, callback));
                    }
                    else {
                        _this._resolveCallback(callback);
                    }
                });
            }
            this._resolving = false;
        };
        SyncTask.prototype._resolveCallback = function (callback) {
            var _this = this;
            if (callback.successFunc) {
                run(function () {
                    var ret = callback.successFunc(_this._storedResolution);
                    if (isCancelable(ret)) {
                        _this._cancelCallbacks.push(ret.cancel.bind(ret));
                        if (_this._wasCanceled) {
                            ret.cancel(_this._cancelContext);
                        }
                    }
                    if (isThenable(ret)) {
                        // The success block of a then returned a new promise, so
                        ret.then(function (r) { callback.task.resolve(r); }, function (e) { callback.task.reject(e); });
                    }
                    else {
                        callback.task.resolve(ret);
                    }
                }, function (e) {
                    _this._handleException(e, 'SyncTask caught exception in success block: ' + e.toString());
                    callback.task.reject(e);
                });
            }
            else {
                callback.task.resolve(this._storedResolution);
            }
        };
        SyncTask.prototype._resolveFailures = function () {
            var _this = this;
            this._resolving = true;
            // New callbacks can be added as the current callbacks run: use a loop to get through all of them.
            while (this._storedCallbackSets.length) {
                // Only iterate over the current list of callbacks.
                var callbacks = this._storedCallbackSets;
                this._storedCallbackSets = [];
                callbacks.forEach(function (callback) {
                    if (callback.failFunc) {
                        run(function () {
                            var ret = callback.failFunc(_this._storedErrResolution);
                            if (isCancelable(ret)) {
                                _this._cancelCallbacks.push(ret.cancel.bind(ret));
                                if (_this._wasCanceled) {
                                    ret.cancel(_this._cancelContext);
                                }
                            }
                            if (isThenable(ret)) {
                                ret.then(function (r) { callback.task.resolve(r); }, function (e) { callback.task.reject(e); });
                            }
                            else {
                                // The failure has been handled: ret is the resolved value.
                                callback.task.resolve(ret);
                            }
                        }, function (e) {
                            _this._handleException(e, 'SyncTask caught exception in failure block: ' + e.toString());
                            callback.task.reject(e);
                        });
                    }
                    else {
                        callback.task.reject(_this._storedErrResolution);
                    }
                });
            }
            this._resolving = false;
        };
        SyncTask.prototype._handleException = function (e, message) {
            if (exports.config.exceptionsToConsole) {
                console.error(message);
            }
            if (exports.config.exceptionHandler) {
                exports.config.exceptionHandler(e);
            }
        };
        return SyncTask;
    }());
    SyncTask._rejectedTasks = [];
    SyncTask._enforceErrorHandledTimer = null;
    Internal.SyncTask = SyncTask;
})(Internal || (Internal = {}));
function all(items) {
    if (items.length === 0) {
        return Resolved([]);
    }
    var outTask = Defer();
    var countRemaining = items.length;
    var foundError = null;
    var results = Array(items.length);
    outTask.onCancel(function (val) {
        items.forEach(function (item) {
            if (isCancelable(item)) {
                item.cancel(val);
            }
        });
    });
    var checkFinish = function () {
        if (--countRemaining === 0) {
            if (foundError !== null) {
                outTask.reject(foundError);
            }
            else {
                outTask.resolve(results);
            }
        }
    };
    items.forEach(function (item, index) {
        if (isThenable(item)) {
            var task = item;
            task.then(function (res) {
                results[index] = res;
                checkFinish();
            }, function (err) {
                if (foundError === null) {
                    foundError = (err !== null) ? err : true;
                }
                checkFinish();
            });
        }
        else {
            // Not a task, so resolve directly with the item
            results[index] = item;
            checkFinish();
        }
    });
    return outTask.promise();
}
exports.all = all;
function race(items) {
    var outTask = Defer();
    var hasSettled = false;
    outTask.onCancel(function (val) {
        items.forEach(function (item) {
            if (isCancelable(item)) {
                item.cancel(val);
            }
        });
    });
    items.forEach(function (item) {
        if (isThenable(item)) {
            var task = item;
            task.then(function (res) {
                if (!hasSettled) {
                    hasSettled = true;
                    outTask.resolve(res);
                }
            }, function (err) {
                if (!hasSettled) {
                    hasSettled = true;
                    outTask.reject(err);
                }
            });
        }
        else {
            // Not a task, so resolve directly with the item
            if (!hasSettled) {
                hasSettled = true;
                outTask.resolve(item);
            }
        }
    });
    return outTask.promise();
}
exports.race = race;
function raceTimer(promise, timeMs) {
    var timerDef = Defer();
    var token = setTimeout(function () {
        timerDef.resolve({ timedOut: true });
    }, timeMs);
    var adaptedPromise = promise.then(function (resp) {
        clearTimeout(token);
        return { timedOut: false, result: resp };
    });
    return race([adaptedPromise, timerDef.promise()]);
}
exports.raceTimer = raceTimer;
