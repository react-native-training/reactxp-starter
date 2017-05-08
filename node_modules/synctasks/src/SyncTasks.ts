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

export const config = {
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

    exceptionHandler: <(ex: Error) => void>null,

    // If an ErrorFunc is not added to the task (then, catch, always) before the task rejects or synchonously
    // after that, then this function is called with the error. Default throws the error.
    unhandledErrorHandler: <(err: any) => void>((err: any) => { throw err; })
};

export interface Es6Thenable<R> {
    then<U>(onFulfilled?: (value: R) => U | Es6Thenable<U>, onRejected?: (error: any) => U | Es6Thenable<U>): Es6Thenable<U>;
    then<U>(onFulfilled?: (value: R) => U | Es6Thenable<U>, onRejected?: (error: any) => void): Es6Thenable<U>;
}

export function fromThenable<T>(thenable: Es6Thenable<T>): Promise<T> {
    const deferred = Defer<T>();
    // NOTE: The {} around the error handling is critical to ensure that
    // we do not trigger "Possible unhandled rejection" warnings. By adding
    // the braces, the error handler rejects the outer promise, but returns
    // void. If we remove the braces, it would *also* return something which
    // would be unhandled
    thenable.then<T>(
        value => { deferred.resolve(value); return undefined; },
        (err: any) => { deferred.reject(err); });
    return deferred.promise();
}

function isThenable(object: any): object is Thenable<any> {
    return object !== null && object !== void 0 && typeof object.then === 'function';
}

function isCancelable(object: any): object is Cancelable {
    return object !== null && object !== void 0 && typeof object.cancel === 'function';
}

// Runs trier(). If config.catchExceptions is set then any exception is caught and handed to catcher.
function run<T, C extends any>(trier: () => T, catcher?: (e: Error) => C): T | C {
    if (config.catchExceptions) {
        // Any try/catch/finally block in a function makes the entire function ineligible for optimization is most JS engines.
        // Make sure this stays in a small/quick function, or break out into its own function.
        try {
            return trier();
        } catch (e) {
            return catcher(e);
        }
    } else {
        return trier();
    }
}

let asyncCallbacks: (() => void)[] = [];

// Ideally, we use setImmediate, but that's only supported on some environments.
// Suggestion: Use the "setimmediate" NPM package to polyfill where it's not available.
const useSetImmediate = typeof setImmediate !== 'undefined';

/**
 * This function will defer callback of the specified callback lambda until the next JS tick, simulating standard A+ promise behavior
 */
export function asyncCallback(callback: () => void) {
    asyncCallbacks.push(callback);

    if (asyncCallbacks.length === 1) {
        // Start a callback for the next tick
        if (useSetImmediate) {
            setImmediate(resolveAsyncCallbacks);
        } else {
            setTimeout(resolveAsyncCallbacks, 0);
        }
    }
}

function resolveAsyncCallbacks() {
    const savedCallbacks = asyncCallbacks;
    asyncCallbacks = [];
    for (let i = 0; i < savedCallbacks.length; i++) {
        savedCallbacks[i]();
    }
}

export type SuccessFunc<T, U> = (value: T) => U | Thenable<U> | void;
export type ErrorFunc<U> = (error: any) => U | Thenable<U> | void;
export type CancelFunc = (context: any) => void;

export function Defer<T>(): Deferred<T> {
    return new Internal.SyncTask<T>();
}

export function Resolved<T>(val?: T): Promise<T> {
    return new Internal.SyncTask<T>().resolve(val).promise();
}

export function Rejected<T>(val?: any): Promise<T> {
    return new Internal.SyncTask<T>().reject(val).promise();
}

export interface Deferred<T> {
    resolve(obj?: T): Deferred<T>;

    reject(obj?: any): Deferred<T>;

    promise(): Promise<T>;

    onCancel(callback: CancelFunc): Deferred<T>;
}

export interface Thenable<T> {
    then<U>(successFunc: SuccessFunc<T, U>, errorFunc?: ErrorFunc<U>): Promise<U>;
}

export interface Cancelable {
    // Will call any cancellation lambdas up the call chain, and reject a chain up the fail blocks
    cancel(context?: any): void;
}

export interface Promise<T> extends Thenable<T>, Cancelable {
    catch<U>(errorFunc: ErrorFunc<U>): Promise<U>;

    finally(func: (value: T|any) => void): Promise<T>;

    always<U>(func: (value: T|any) => U | Thenable<U>): Promise<U>;

    done(successFunc: (value: T) => void): Promise<T>;

    fail(errorFunc: (error: any) => void): Promise<T>;

    // Defer the resolution of the then until the next event loop, simulating standard A+ promise behavior
    thenAsync<U>(successFunc: SuccessFunc<T, U>, errorFunc?: ErrorFunc<U>): Promise<U>;

    setTracingEnabled(enabled: boolean): Promise<T>;
}

module Internal {
    export interface CallbackSet<T, U> {
        successFunc?: SuccessFunc<T, U>;
        failFunc?: ErrorFunc<U>;
        task?: Deferred<any>;
        asyncCallback?: boolean;
    }

    export class SyncTask<T> implements Deferred<T>, Promise<T> {
        private _storedResolution: T;
        private _storedErrResolution: any;
        private _completedSuccess = false;
        private _completedFail = false;
        private _traceEnabled = false;
        // If _traceEnabled is true we save stacktrace of the first resolution of the task in the _completeStack
        // we are storing the Error instead of stack because it would be faster in standard scenario.
        private _completeStack: Error;

        private _cancelCallbacks: CancelFunc[] = [];
        private _cancelContext: any;
        private _wasCanceled = false;

        private _resolving = false;

        private _storedCallbackSets: CallbackSet<T, any>[] = [];

        // 'Handled' just means there was a callback set added.
        // Note: If that callback does not handle the error then that callback's task will be 'unhandled' instead of this one.
        private _mustHandleError = true;

        private static _rejectedTasks: SyncTask<any>[] = [];
        private static _enforceErrorHandledTimer: number = null;

        private _addCallbackSet<U>(set: CallbackSet<T, U>, callbackWillChain: boolean): Promise<U> {
            const task = new SyncTask<U>();
            task.onCancel(this.cancel.bind(this));
            set.task = task;
            this._storedCallbackSets.push(set);

            if (callbackWillChain) {
                // The callback inherits responsibility for "handling" errors.
                this._mustHandleError = false;
            } else {
                // The callback can never "handle" errors since nothing can chain to it.
                task._mustHandleError = false;
            }

            // The _resolve* functions handle callbacks being added while they are running.
            if (!this._resolving) {
                if (this._completedSuccess) {
                    this._resolveSuccesses();
                } else if (this._completedFail) {
                    this._resolveFailures();
                }
            }

            return task.promise();
        }

        onCancel(callback: CancelFunc): Deferred<T> {
            // Only register cancel callback handler on promise that hasn't been completed
            if (!this._completedSuccess && !this._completedFail) {
                if (this._wasCanceled) {
                    callback(this._cancelContext);
                } else {
                    this._cancelCallbacks.push(callback);
                }
            }

            return this;
        }

        then<U>(successFunc: SuccessFunc<T, U>, errorFunc?: ErrorFunc<U>): Promise<U> {
            return this._addCallbackSet<U>({
                successFunc: successFunc,
                failFunc: errorFunc
            }, true);
        }

        thenAsync<U>(successFunc: SuccessFunc<T, U>, errorFunc?: ErrorFunc<U>): Promise<U> {
            return this._addCallbackSet<U>({
                successFunc: successFunc,
                failFunc: errorFunc,
                asyncCallback: true
            }, true);
        }

        catch<U>(errorFunc: ErrorFunc<U>): Promise<U> {
            return this._addCallbackSet<U>({
                failFunc: errorFunc
            }, true);
        }

        always<U>(func: (value: T|any) => U | Promise<U>): Promise<U> {
            return this._addCallbackSet<U>({
                successFunc: func,
                failFunc: func
            }, true);
        }

        setTracingEnabled(enabled: boolean) : Promise<T> {
            this._traceEnabled = enabled;
            return this;
        }

        // Finally should let you inspect the value of the promise as it passes through without affecting the then chaining
        // i.e. a failed promise with a finally after it should then chain to the fail case of the next then
        finally(func: (value: T|any) => void): Promise<T> {
            this._addCallbackSet<T|any>({
                successFunc: func,
                failFunc: func
            }, false);
            return this;
        }

        done(successFunc: (value: T) => void): Promise<T> {
            this._addCallbackSet<void>({
                successFunc: successFunc
            }, false);
            return this;
        }

        fail(errorFunc: (error: any) => void): Promise<T> {
            this._addCallbackSet<void>({
                failFunc: errorFunc
            }, false);
            return this;
        }

        resolve(obj?:  T): Deferred<T> {
           this._checkState(true);
           this._completedSuccess = true;
           this._storedResolution = obj;

           this._resolveSuccesses();

           return this;
        }

        reject(obj?: any): Deferred<T> {
           this._checkState(false);
           this._completedFail = true;
           this._storedErrResolution = obj;

           this._resolveFailures();

           SyncTask._enforceErrorHandled(this);

           return this;
        }

        private _checkState(resolve: boolean) {
            if (this._completedSuccess || this._completedFail) {
                if (this._completeStack) {
                    console.error(this._completeStack.message, this._completeStack.stack);
                }

                const message = 'Failed to ' + (resolve ? 'resolve' : 'reject') +
                    ': the task is already ' + (this._completedSuccess ? 'resolved' : 'rejected');
                throw new Error(message);
            }

            if (config.traceEnabled || this._traceEnabled) {
                this._completeStack = new Error('Initial ' +  resolve ? 'resolve' : 'reject');
            }
        }

        // Make sure any rejected task has its failured handled.
        private static _enforceErrorHandled(task: SyncTask<any>): void {
            if (!task._mustHandleError) {
                return;
            }

            SyncTask._rejectedTasks.push(task);

            // Wait for some async time in the future to check these tasks.
            if (!SyncTask._enforceErrorHandledTimer) {
                SyncTask._enforceErrorHandledTimer = setTimeout(() => {
                    SyncTask._enforceErrorHandledTimer = null;

                    const rejectedTasks = SyncTask._rejectedTasks;
                    SyncTask._rejectedTasks = [];

                    rejectedTasks.forEach((rejectedTask, i) => {
                        if (rejectedTask._mustHandleError) {
                            // Unhandled!
                            config.unhandledErrorHandler(rejectedTask._storedErrResolution);
                        }
                    });
                }, 0);
            }
        }

        cancel(context?: any): void {
            if (this._wasCanceled) {
                throw new Error('Already Canceled');
            }

            this._wasCanceled = true;
            this._cancelContext = context;

            if (this._cancelCallbacks.length > 0) {
                this._cancelCallbacks.forEach(callback => {
                    if (!this._completedSuccess && !this._completedFail) {
                        callback(this._cancelContext);
                    }
                });
            }
        }

        promise(): Promise<T> {
            return this;
        }

        private _resolveSuccesses() {
            this._resolving = true;

            // New callbacks can be added as the current callbacks run: use a loop to get through all of them.
            while (this._storedCallbackSets.length) {
                // Only iterate over the current list of callbacks.
                const callbacks = this._storedCallbackSets;
                this._storedCallbackSets = [];

                callbacks.forEach(callback => {
                    if (callback.asyncCallback) {
                        asyncCallback(this._resolveCallback.bind(this, callback));
                    } else {
                        this._resolveCallback(callback);
                    }
                });
            }
            this._resolving = false;
        }

        private _resolveCallback(callback: CallbackSet<T, any>) {
            if (callback.successFunc) {
                run(() => {
                    const ret = callback.successFunc(this._storedResolution);
                    if (isCancelable(ret)) {
                        this._cancelCallbacks.push(ret.cancel.bind(ret));
                        if (this._wasCanceled) {
                            ret.cancel(this._cancelContext);
                        }
                    }
                    if (isThenable(ret)) {
                        // The success block of a then returned a new promise, so
                        ret.then(r => { callback.task.resolve(r); }, e => { callback.task.reject(e); });
                    } else {
                        callback.task.resolve(ret);
                    }
                }, e => {
                    this._handleException(e, 'SyncTask caught exception in success block: ' + e.toString());
                    callback.task.reject(e);
                });
            } else {
                callback.task.resolve(this._storedResolution);
            }
        }

        private _resolveFailures() {
            this._resolving = true;

            // New callbacks can be added as the current callbacks run: use a loop to get through all of them.
            while (this._storedCallbackSets.length) {
                // Only iterate over the current list of callbacks.
                const callbacks = this._storedCallbackSets;
                this._storedCallbackSets = [];

                callbacks.forEach(callback => {
                    if (callback.failFunc) {
                        run(() => {
                            const ret = callback.failFunc(this._storedErrResolution);
                            if (isCancelable(ret)) {
                                this._cancelCallbacks.push(ret.cancel.bind(ret));
                                if (this._wasCanceled) {
                                    ret.cancel(this._cancelContext);
                                }
                            }
                            if (isThenable(ret)) {
                                ret.then(r => { callback.task.resolve(r); }, e => { callback.task.reject(e); });
                            } else {
                                // The failure has been handled: ret is the resolved value.
                                callback.task.resolve(ret);
                            }
                        }, e => {
                            this._handleException(e, 'SyncTask caught exception in failure block: ' + e.toString());
                            callback.task.reject(e);
                        });
                    } else {
                        callback.task.reject(this._storedErrResolution);
                    }
                });
            }
            this._resolving = false;
        }

        private _handleException(e: Error, message: string): void {
            if (config.exceptionsToConsole) {
                console.error(message);
            }
            if (config.exceptionHandler) {
                config.exceptionHandler(e);
            }
        }
    }
}

export type Raceable<T> = T | Thenable<T>;

// Resolves once all of the given items resolve (non-thenables are 'resolved').
// Rejects once any of the given thenables reject.
// Note: resolves immediately if given no items.
export function all<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
    values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>, Raceable<T9>,
             Raceable<T10>]
): Promise<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]>;

export function all<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
    values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>, Raceable<T9>]
): Promise<[T1, T2, T3, T4, T5, T6, T7, T8, T9]>;

export function all<T1, T2, T3, T4, T5, T6, T7, T8>(
    values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>]
): Promise<[T1, T2, T3, T4, T5, T6, T7, T8]>;

export function all<T1, T2, T3, T4, T5, T6, T7>(values:
 [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>]): Promise<[T1, T2, T3, T4, T5, T6, T7]>;

export function all<T1, T2, T3, T4, T5, T6>(values:
 [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>]): Promise<[T1, T2, T3, T4, T5, T6]>;

export function all<T1, T2, T3, T4, T5>(values:
[Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>]): Promise<[T1, T2, T3, T4, T5]>;

export function all<T1, T2, T3, T4>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>]): Promise<[T1, T2, T3, T4]>;

export function all<T1, T2, T3>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>]): Promise<[T1, T2, T3]>;

export function all<T1, T2>(values: [Raceable<T1>, Raceable<T2>]): Promise<[T1, T2]>;

export function all<T>(values: (T|Thenable<T>)[]): Promise<T[]>;

export function all(items: any[]): Promise<any[]> {
    if (items.length === 0) {
        return Resolved<any[]>([]);
    }

    const outTask = Defer<any[]>();
    let countRemaining = items.length;
    let foundError: any = null;
    const results = Array(items.length);

    outTask.onCancel((val) => {
        items.forEach(item => {
            if (isCancelable(item)) {
                item.cancel(val);
            }
        });
    });

    const checkFinish = () => {
        if (--countRemaining === 0) {
            if (foundError !== null) {
                outTask.reject(foundError);
            } else {
                outTask.resolve(results);
            }
        }
    };

    items.forEach((item, index) => {
        if (isThenable(item)) {
            const task = <Thenable<any>>item;
            task.then(res => {
                results[index] = res;
                checkFinish();
            }, err => {
                if (foundError === null) {
                    foundError = (err !== null) ? err : true;
                }
                checkFinish();
            });
        } else {
            // Not a task, so resolve directly with the item
            results[index] = item;
            checkFinish();
        }
    });

    return outTask.promise();
}

// Resolves/Rejects once any of the given items resolve or reject (non-thenables are 'resolved').
// Note: never resolves if given no items.
export function race<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
    values: [
        Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>, Raceable<T9>,
        Raceable<T10>
    ]
): Promise<T1|T2|T3|T4|T5|T6|T7|T8|T9|T10>;

export function race<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
    values: [
        Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>, Raceable<T9>
    ]
): Promise<T1|T2|T3|T4|T5|T6|T7|T8|T9>;

export function race<T1, T2, T3, T4, T5, T6, T7, T8>(
    values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>]
): Promise<T1|T2|T3|T4|T5|T6|T7|T8>;

export function race<T1, T2, T3, T4, T5, T6, T7>(
    values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>]
): Promise<T1|T2|T3|T4|T5|T6|T7>;

export function race<T1, T2, T3, T4, T5, T6>(
    values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>]
): Promise<T1|T2|T3|T4|T5|T6>;
export function race<T1, T2, T3, T4, T5>(
    values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>]): Promise<T1|T2|T3|T4|T5>;

export function race<T1, T2, T3, T4>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>]): Promise<T1|T2|T3|T4>;

export function race<T1, T2, T3>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>]): Promise<T1|T2|T3>;

export function race<T1, T2>(values: [Raceable<T1>, Raceable<T2>]): Promise<T1|T2>;

export function race<T>(values: (T|Thenable<T>)[]): Promise<T[]>;

export function race(items: any[]): Promise<any> {
    const outTask = Defer<any>();
    let hasSettled = false;

    outTask.onCancel((val) => {
        items.forEach(item => {
            if (isCancelable(item)) {
                item.cancel(val);
            }
        });
    });

    items.forEach(item => {
        if (isThenable(item)) {
            const task = <Thenable<any>>item;
            task.then(res => {
                if (!hasSettled) {
                    hasSettled = true;
                    outTask.resolve(res);
                }
            }, err => {
                if (!hasSettled) {
                    hasSettled = true;
                    outTask.reject(err);
                }
            });
        } else {
            // Not a task, so resolve directly with the item
            if (!hasSettled) {
                hasSettled = true;
                outTask.resolve(item);
            }
        }
    });

    return outTask.promise();
}

export type RaceTimerResponse<T> = { timedOut: boolean, result?: T };
export function raceTimer<T>(promise: Promise<T>, timeMs: number): Promise<RaceTimerResponse<T>> {
    let timerDef = Defer<RaceTimerResponse<T>>();
    const token = setTimeout(() => {
        timerDef.resolve({ timedOut: true });
    }, timeMs);
    const adaptedPromise = promise.then(resp => {
        clearTimeout(token);
        return { timedOut: false, result: resp } as RaceTimerResponse<T>;
    });
    return race([adaptedPromise, timerDef.promise()]);
}
