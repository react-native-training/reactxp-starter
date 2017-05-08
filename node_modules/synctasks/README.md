# SyncTasks

Yet another promise library, but this one is designed intentionally against the ES6 promise pattern, which asynchronously resolves
promise callbacks in the next tick of the JS engine.  In many cases, asynchronous resolution is the safest and
easiest-to-understand implementation of a promise, but it adds a huge delay to the resolution, which in most places is unnecessary.
Moreover, when we attempted to wrap the IndexedDB architecture with standard ES6 promises, it falls apart, because IndexedDB
closes database connections when control is passed back to the main thread.  We started building
[NoSQLProvider](https://www.github.com/Microsoft/NoSQLProvider/) and immediately ran into this problem.  SyncTasks is the solution
to that problem, but is also a performant answer to asynchronous programming problems in general.  In addition, we've worked in
a simple optional cancellation mechanism that chains through promise resolution as well (as long as you chain through SyncTasks
promises, and don't mix in non-cancellation-supported promises.)

## Usage

Usage of SyncTasks promises is somewhat similar to JQuery promises.  If you need to create a promise deferral, you call
`SyncTasks.Defer()` and it returns a `SyncTasks.Deferred` object.  The usual flow is to stash the deferral away for your async
logic to later resolve/reject, and call `.promise()` on the deferral and return that to your caller, so that the caller only
works with the promise (for chaining and resolution-callback reasons).  Any calls of resolve/reject are synchronously resolved
before returning from the resolve/reject method.

### SyncTasks Static Reference

SyncTasks has the basic `Defer` call, but also helper methods to save on common tasks for interacting with promises/deferrals:

- `Defer()` - Returns a new blank `SyncTasks.Deferral`.
- `Resolved(obj?)` - Returns a new `SyncTasks.Promise`, already in a resolved (success) state, with the optional passed
    resolution value.
- `Rejected(obj?)` - Returns a new `SyncTasks.Promise`, already in a rejected (failure) state, with the optional passed
    resolution value.
- `all([promises...])` - Returns a new `SyncTasks.Promise` that will resolve when all of the promises in the list have finished.
    If any of the promises resolved with failure, then `all` will resolve with failure, with the first non-`undefined` resolution
    value as the resolution value for `all`.  If all are successful, then it will resolve successfully, with the resolution value
    being an array of the resolution values from the input promises.  You can also pass values instead of promises in the input
    list, and those values will pass through as successful resolutions to the output list.
- `race([promises...])` - Returns a new `SyncTasks.Promise` that will resolve when any one of the promises in the list finish.
    Resolves or rejects the output promise based on the resolution type and value of the first finished promise in the list.
- `asyncCallback(callback)` - Runs the specified callback function on the next tick of the javascript engine.  Uses a shared
    queue, so that all callbacks are played on the next tick sequentially, not one per tick.  This is the same mechanism used
    by `thenAsync` to queue the callbacks for the next tick, but is also a handy helper for more optimized defering of multiple
    callbacks to the next tick.
- `fromThenable(thenable)` - A handy helper function to wrap any sort of `Thenable` (usually used for wrapping ES6 Promises) into
    a SyncTask.  This takes the thenable and maps its success and failure cases into a new `SyncTasks.Promise` that resolve and
    reject with the results of the passed thenable.
- `setTracingEnabled(boolean)` - This option allows enabling of double resolution tracing individually per Promise.
    Could be used in the release in cases then the problem couldn't be reproduced locally.
    If option enabled assert will give you two stack traces - for the first resolve and the second. By default, you would see only second resolve stack trace.
    Keep in mind that it adds an extra overhead as resolve method call will create an extra Error object, so it should be used with caution in the release.
    Estimated overhead on mobile is around 0.05ms per resolve/reject call on Nexus 5x android.

### SyncTasks.Deferred Reference

A created `Deferral` object only has 4 methods:

- `resolve(obj?)` - Resolves any promises created by the deferral with success.  Takes an optional value that is passed through the
    success chain of any of the promises.
- `reject(obj?)` - Resolves any promises created by the deferral with failure.  Takes an optional value that is passed through the
    success chain of any of the promises.
- `onCancel(callback)` - Adds a cancellation callback function that is called whenever non-resolved/rejected promises created by the deferral get `.cancel`
    called on them (or called on chained promises chain back up to this one.) This callback can be used to handle aborting async tasks that return promises.
- `promise()` - Returns a `SyncTasks.Promise` object from the deferral, which is then passed around the world.

### SyncTasks.Promise Reference

The `Promise` object is the public face of the async process that your `Deferred` is managing.  You add various callbacks to
the promise object depending on what types of events you want to get notified about, and what type of chaining you want to
support.  The methods supported are:

- `then(successCallback, failureCallback?)` - The most common resolution mechanism for a promise.  If the promise successfully
    resolves, it will call the first callback (and will pass it the optional resolution value).  If it resolves with failure,
    the second callback is called (also with an optional resolution value).  From inside each callback, you are able to return
    either a value, which will then turn the resolution into a successful resolution and change the resolution value to the
    value you just returned, or you may also return a new promise, which then continues the resolution chaining process until
    something returns only a value (or undefined).  Returning anything from either the successCallback or failureCallback
    functions will chain to success of any subsequent promises.  The `then` call returns a new promise which will be resolved
    based on the resolution chain of the callbacks from this call.
- `thenAsync(successCallback?, failureCallback?)` - Has the same nuances and behavior as `then`, but the callbacks are called
    asynchronously, in ES6 fashion, on the next tick of the javascript host engine.
- `always(callback)` - A synonym for calling `then` with the same callback for both parameters.  Use this when you want to
    always alter the resolution chain, regardless of whether it came in with success or failure.  Just like `then`, returns
    a new promise for chaining.
- `catch(callback)` - Has the same effect as calling `then` with the specified callback for the failureCallback parameter and
    undefined for the successCallback -- this will only call your callback in the event of a chained failure case, but anything
    returned from your callback here will chain future callbacks to success.  Just like `then`, returns a new promise for
    chaining.
- `done(callback)`, `fail(callback)`, and `finally(callback)` - If you would like to observe, but not change, the resolution
    chain, you can use these functions.  In all three cases, nothing you return from the callback functions will have any
    effect, these are only for observing the resolution chain.  The only difference between them is that `done` is only called
    if the resolution chain is successful, `fail` is only called if the resolution chain is failure, and `finally` is called
    in either case.  The callback function is always passed the optional resolution value, but in `finally`'s case, you have
    no idea whether it was called based on success or failure.  These three functions all return the same original promise
    object, so you can attach multiple "observation functions" to the same promise without having to store it in a temporary
    variable.
- `cancel(obj?)` - This method will notify the original deferral object of cancellation, and will pass it the optional value
    it is called with, but has no further effects.  If the deferral is not handling cancellation, then this call will do
    absolutely nothing -- it does not guarantee any effects like failure resolution or any sort of stopping of chaining.
    The cancellation attempt will walk backwards as far up the promise chain as possible, so if you cancel a promise, be
    aware that it may end up calling cancel functions for deferrals many steps back in the promise chain.

## Examples

### Simple Usage

```
function sendMeAStringLater(numberOfMilliseconds: number, theString: string): SyncTasks.Promise<void> {
    let defer = SyncTasks.Defer<string>();
    setTimeout(() => {
        defer.resolve(theString);
    }, numberOfMilliseconds);
    return defer.promise();
}

sendMeAStringLater(500, 'hi').then(myString => {
    console.log(myString);
});

// 500 ms after running this, you will end up with a new console log line, "hi".
```

### Add Cancellation

```
function sendMeAStringLater(numberOfMilliseconds: number, theString: string): SyncTasks.Promise<void> {
    let defer = SyncTasks.Defer<string>();
    let didFinish = false;
    defer.onCancel(whyWasICancelled => {
        if (!didFinish) {
            didFinish = true;
            defer.reject(whyWasICancelled);
        }
    });
    setTimeout(() => {
        // Make sure to bail here if it's already done.  If you resolve a second time, it will throw an exception, since the
        // cancel already resolved it once.
        if (!didFinish) {
            didFinish = true;
            defer.resolve(theString);
        }
    }, numberOfMilliseconds);
    return defer.promise();
}

let promise = sendMeAStringLater(500, 'hi').then(myString => {
    console.log('Success: ' + myString);
}, errString => {
    console.log('Failure: ' + errString);
});

setTimeout(() => {
    promise.cancel('Sorry');
}, 200);

// 200 ms after running this, you will end up with a new console log line, "Failure: Sorry".  The success case will not be
// run because it was already resolved with failure.  If you change the 200ms timer to 600ms, then your console will change to
// "Success: hi" because the cancellation will happen after the success already did, so the `didFinish` check will swallow it.
```
