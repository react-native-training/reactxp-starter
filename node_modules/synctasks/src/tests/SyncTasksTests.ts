/// <reference path="dependencies.d.ts"/>

import assert = require('assert');

import SyncTasks = require('../SyncTasks');

describe('SyncTasks', function () {
    it('Simple - null resolve after then', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            assert.equal(val, null);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(null);
    });

    it('Simple - null then after resolve', (done) => {
        const task = SyncTasks.Defer<number>();

        task.resolve(null);

        task.promise().then(val => {
            assert.equal(val, null);
            done();
        }, err => {
            assert(false);
        });
    });

    it('Simple - reject', (done) => {
        const task = SyncTasks.Defer<number>();

        task.reject(2);

        task.promise().then(val => {
            assert(false);
        }, err => {
            assert.equal(err, 2);
            done();
        });
    });

    it('Chain from success to success with value', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            assert.equal(val, 3);
            return 4;
        }, err => {
            assert(false);
            return null;
        }).then(val => {
            assert.equal(val, 4);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(3);
    });

    it('Chain from error to success with value', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            assert(false);
            return -1;
        }, err => {
            assert.equal(err, 2);
            return 4;
        }).then(val => {
            assert.equal(val, 4);
            done();
        }, err => {
            assert(false);
        });

        task.reject(2);
    });

    it('Chain from success to success with promise', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            assert.equal(val, 3);
            return SyncTasks.Resolved<number>(4);
        }, err => {
            assert(false);
            return -1;
        }).then(val => {
            assert.equal(val, 4);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(3);
    });

    it('Chain from error to success with promise', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            assert(false);
            return -1;
        }, err => {
            assert.equal(err, 3);
            return SyncTasks.Resolved(4);
        }).then(val => {
            assert.equal(val, 4);
            done();
        }, err => {
            assert(false);
        });

        task.reject(3);
    });

    it('Chain from success to error with promise', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            assert.equal(val, 2);
            return SyncTasks.Rejected(4);
        }, err => {
            assert(false);
            return -1;
        }).then(val => {
            assert(false);
        }, err => {
            assert.equal(err, 4);
            done();
        });

        task.resolve(2);
    });

    it('Chain from error to error with promise', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            assert(false);
            return -1;
        }, err => {
            assert.equal(err, 2);
            return SyncTasks.Rejected(4);
        }).then(val => {
            assert(false);
        }, err => {
            assert.equal(err, 4);
            done();
        });

        task.reject(2);
    });

    it('Chain from success to promise to success with promise', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            assert.equal(val, 3);
            const itask = SyncTasks.Resolved<number>(4);
            return itask.then(val2 => {
                assert.equal(val2, 4, 'inner');
                return 5;
            });
        }, err => {
            assert(false);
            return null;
        }).then(val => {
            assert.equal(val, 5, 'outer');
            done();
        }, err => {
            assert(false);
        });

        task.resolve(3);
    });

    it('Exception in success to error', (done) => {
        const task = SyncTasks.Defer<number>();

        SyncTasks.config.exceptionsToConsole = false;

        task.promise().then(val => {
            const blah: any = null;
            blah.blowup();
        }, err => {
            assert(false);
        }).then(val => {
            assert(false);
        }, err => {
            SyncTasks.config.exceptionsToConsole = true;
            done();
        });

        task.resolve(3);
    });

    it('Exception in error to error', (done) => {
        const task = SyncTasks.Defer<number>();

        SyncTasks.config.exceptionsToConsole = false;

        task.promise().then(val => {
            assert(false);
        }, err => {
            const blah: any = null;
            blah.blowup();
        }).then(val => {
            assert(false);
        }, err => {
            SyncTasks.config.exceptionsToConsole = true;
            done();
        });

        task.reject(3);
    });

    it('"done" basic', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            return 4;
        }, err => {
            assert(false);
            return -1;
        }).done(val => {
            assert.equal(val, 4);
            return 2;   // should be ignored
        }).then(val => {
            assert.equal(val, 4);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(3);
    });

    it('"done" does not chain', (done) => {
        const task = SyncTasks.Defer<number>();
        const innertask = SyncTasks.Defer<number>();

        let innerFinished = false;

        task.promise().then(val => {
            return 4;
        }, err => {
            assert(false);
            return -1;
        }).done(val => {
            assert.equal(val, 4);
            return innertask.promise().then(() => {
                innerFinished = true;
                return 2;   // should be ignored
            });
        }).then(val => {
            assert(!innerFinished);
            assert.equal(val, 4);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(3);
        innertask.resolve(1);
    });

    it('Finally basic', (done) => {
        const task = SyncTasks.Defer<number>();

        task.promise().then(val => {
            return 4;
        }, err => {
            assert(false);
            return -1;
        }).finally(val => {
            assert.equal(val, 4);
            return 2;   // should be ignored
        }).then(val => {
            assert.equal(val, 4);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(3);
    });

    it('Finally does not chain', (done) => {
        const task = SyncTasks.Defer<number>();
        const innertask = SyncTasks.Defer<number>();

        let innerFinished = false;

        task.promise().then(val => {
            return 4;
        }, err => {
            assert(false);
            return -1;
        }).finally(val => {
            assert.equal(val, 4);
            return innertask.promise().then(() => {
                innerFinished = true;
                return 2;   // should be ignored
            });
        }).then(val => {
            assert(!innerFinished);
            assert.equal(val, 4);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(3);
        innertask.resolve(1);
    });

    it('"all" basic success', (done) => {
        const task = SyncTasks.Defer<number>();
        const task2 = SyncTasks.Defer<number>();
        const task3 = SyncTasks.Defer<number>();
        const task4 = SyncTasks.Defer<number>();

        SyncTasks.all([task.promise(), task2.promise(), task3.promise(), task4.promise()]).then(rets => {
            assert.equal(rets.length, 4);
            assert.equal(rets[0], 1);
            assert.equal(rets[1], 2);
            assert.equal(rets[2], 3);
            assert.equal(rets[3], 4);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(1);
        task2.resolve(2);
        task3.resolve(3);
        task4.resolve(4);
    });

    it('"all" basic failure', (done) => {
        const task = SyncTasks.Defer<number>();
        const task2 = SyncTasks.Defer<number>();

        SyncTasks.all([task.promise(), task2.promise()]).then(rets => {
            assert(false);
        }, err => {
            done();
        });

        task.resolve(1);
        task2.reject(2);
    });

    it('"all" zero tasks', (done) => {
        SyncTasks.all([]).then(rets => {
            assert.equal(rets.length, 0);
            done();
        }, err => {
            assert(false);
        });
    });

    it('"all" single null task', (done) => {
        SyncTasks.all([null]).then(rets => {
            assert.equal(rets.length, 1);
            done();
        }, err => {
            assert(false);
        });
    });

    it('"all" tasks and nulls', (done) => {
        const task = SyncTasks.Defer<number>();

        SyncTasks.all([null, task.promise()]).then(rets => {
            assert.equal(rets.length, 2);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(1);
    });

    it('"race" basic success', (done) => {
        const task = SyncTasks.Defer<number>();
        const task2 = SyncTasks.Defer<number>();
        const task3 = SyncTasks.Defer<number>();
        const task4 = SyncTasks.Defer<number>();

        SyncTasks.race([task.promise(), task2.promise(), task3.promise(), task4.promise()]).then(ret => {
            assert.equal(ret, 1);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(1);
        task2.resolve(2);
        task3.resolve(3);
        task4.resolve(4);
    });

    it('"race" basic failure', (done) => {
        const task = SyncTasks.Defer<number>();
        const task2 = SyncTasks.Defer<number>();

        SyncTasks.race([task.promise(), task2.promise()]).then(ret => {
            assert(false);
        }, err => {
            assert.equal(err, 1);
            done();
        });

        task.reject(1);
        task2.resolve(2);
    });

    it('"race" zero tasks', (done) => {
        SyncTasks.race([]).then(ret => {
            assert(false);
        }, err => {
            assert(false);
        });
        
        setTimeout(() => done(), 20);
    });

    it('"race" single null task', (done) => {
        SyncTasks.race([null]).then(ret => {
            assert.equal(ret, null);
            done();
        }, err => {
            assert(false);
        });
    });

    it('"race" tasks and nulls', (done) => {
        const task = SyncTasks.Defer<number>();

        SyncTasks.race([null, task.promise()]).then(ret => {
            assert.equal(ret, null);
            done();
        }, err => {
            assert(false);
        });

        task.resolve(2);
    });

    it('Callbacks resolve synchronously', (done) => {
        const task = SyncTasks.Defer<number>();
        let resolvedCount = 0;
        
        task.promise().then(() => {
            ++resolvedCount;
        }, err => {
            assert(false);
        });
        
        task.resolve(1);
        assert(resolvedCount === 1);
        done();
    });

    it('Callbacks resolve in order added', (done) => {
        const task = SyncTasks.Defer<number>();
        let resolvedCount = 0;
        
        task.promise().then(() => {
            assert(resolvedCount === 0);
            ++resolvedCount;
        }, err => {
            assert(false);
        });

        task.promise().then(() => {
            assert(resolvedCount === 1);
            ++resolvedCount;
        }, err => {
            assert(false);
        });

        task.resolve(1);
        assert(resolvedCount === 2);
        done();
    });

    it('Failure callbacks resolve in order added', (done) => {
        const task = SyncTasks.Defer<number>();
        let rejectedCount = 0;

        task.promise().then(() => {
            assert(false);
        }, err => {
            assert(rejectedCount === 0);
            ++rejectedCount;
        });

        task.promise().then(() => {
            assert(false);
        }, err => {
            assert(rejectedCount === 1);
            ++rejectedCount;
        });

        task.reject(1);
        assert(rejectedCount === 2);
        done();
    });

    it('"unhandledErrorHandler": Failure without any callback', (done) => {
        let unhandledErrorHandlerCalled = false;
        
        const oldUnhandledErrorHandler = SyncTasks.config.unhandledErrorHandler;
        SyncTasks.config.unhandledErrorHandler = () => {
            unhandledErrorHandlerCalled = true;
        };
        
        SyncTasks.Rejected<number>();
        
        setTimeout(() => {
            SyncTasks.config.unhandledErrorHandler = oldUnhandledErrorHandler;
            assert(unhandledErrorHandlerCalled);
            done();
        }, 20);
    });

    it('"unhandledErrorHandler": Failure with only success callback', (done) => {
        let unhandledErrorHandlerCalled = false;
        
        const oldUnhandledErrorHandler = SyncTasks.config.unhandledErrorHandler;
        SyncTasks.config.unhandledErrorHandler = () => {
            unhandledErrorHandlerCalled = true;
        };
        
        SyncTasks.Rejected<number>().then(() => {
            assert(false);
        });
        
        setTimeout(() => {
            SyncTasks.config.unhandledErrorHandler = oldUnhandledErrorHandler;
            assert(unhandledErrorHandlerCalled);
            done();
        }, 20);
    });

    it('"unhandledErrorHandler": Failure with success callback with failure callback', (done) => {
        let catchBlockReached = false;
        
        SyncTasks.Rejected<number>().then(() => {
            assert(false);
        }).catch(() => {
            catchBlockReached = true;
        });
        
        setTimeout(() => {
            assert(catchBlockReached);
            done();
        }, 20);
    });

    it('"unhandledErrorHandler": Success to inner failure without any callback', (done) => {
        let unhandledErrorHandlerCalled = false;
        
        const oldUnhandledErrorHandler = SyncTasks.config.unhandledErrorHandler;
        SyncTasks.config.unhandledErrorHandler = () => {
            unhandledErrorHandlerCalled = true;
        };
        
        SyncTasks.Resolved<number>().then(() => {
            return SyncTasks.Rejected<number>();
        });
        
        setTimeout(() => {
            SyncTasks.config.unhandledErrorHandler = oldUnhandledErrorHandler;
            assert(unhandledErrorHandlerCalled);
            done();
        }, 20);
    });

    it('"unhandledErrorHandler": Failure to inner failure without any callback', (done) => {
        let unhandledErrorHandlerCalled = 0;
        
        const oldUnhandledErrorHandler = SyncTasks.config.unhandledErrorHandler;
        SyncTasks.config.unhandledErrorHandler = (n: number) => {
            unhandledErrorHandlerCalled = n;
        };
        
        SyncTasks.Rejected<number>(1).catch(() => {
            return SyncTasks.Rejected<number>(2);
        });
        // Note: the outer "catch" has no failure handling so the inner error leaks out.
        
        setTimeout(() => {
            SyncTasks.config.unhandledErrorHandler = oldUnhandledErrorHandler;
            assert.equal(unhandledErrorHandlerCalled, 2);
            done();
        }, 20);
    });

    it('"unhandledErrorHandler": Each chained promise must handle', (done) => {
        let unhandledErrorHandlerCalled = false;
        let catchBlockReached = false;
        
        const oldUnhandledErrorHandler = SyncTasks.config.unhandledErrorHandler;
        SyncTasks.config.unhandledErrorHandler = () => {
            unhandledErrorHandlerCalled = true;
        };
        
        const task = SyncTasks.Rejected<number>();
        task.catch(() => {
            catchBlockReached = true;
        });
        
        // Does not handle failure.
        task.then(() => {
            assert(false);
        });
        
        setTimeout(() => {
            SyncTasks.config.unhandledErrorHandler = oldUnhandledErrorHandler;
            assert(unhandledErrorHandlerCalled);
            assert(catchBlockReached);
            done();
        }, 20);
    });

    it('"unhandledErrorHandler": "fail" never "handles" the failure', (done) => {
        let unhandledErrorHandlerCalled = false;
        let failBlockReached = false;
        
        const oldUnhandledErrorHandler = SyncTasks.config.unhandledErrorHandler;
        SyncTasks.config.unhandledErrorHandler = () => {
            unhandledErrorHandlerCalled = true;
        };
        
        SyncTasks.Rejected<number>().fail(() => {
            failBlockReached = true;
            // If this was .catch, it would resolve the promise (with undefined) and the failure would be handled.
        });
        
        setTimeout(() => {
            SyncTasks.config.unhandledErrorHandler = oldUnhandledErrorHandler;
            assert(unhandledErrorHandlerCalled);
            assert(failBlockReached);
            done();
        }, 20);
    });

    it('"unhandledErrorHandler": "done" does not create another "unhandled"', (done) => {
        let unhandledErrorHandlerCalled = false;
        let catchBlockReached = false;
        
        const oldUnhandledErrorHandler = SyncTasks.config.unhandledErrorHandler;
        SyncTasks.config.unhandledErrorHandler = () => {
            unhandledErrorHandlerCalled = true;
        };
        
        SyncTasks.Rejected<number>().done(() => {
            // Should not create a separate "unhandled" error since there is no way to "handle" it from here.
            // The existing "unhandled" error should continue to be "unhandled", as other tests have verified.
        }).catch(() => {
            // "Handle" the failure.
            catchBlockReached = true;
        });
        
        setTimeout(() => {
            SyncTasks.config.unhandledErrorHandler = oldUnhandledErrorHandler;
            assert(!unhandledErrorHandlerCalled);
            assert(catchBlockReached);
            done();
        }, 20);
    });

    it('"unhandledErrorHandler": "fail" does not create another "unhandled"', (done) => {
        let unhandledErrorHandlerCalled = false;
        let catchBlockReached = false;
        
        const oldUnhandledErrorHandler = SyncTasks.config.unhandledErrorHandler;
        SyncTasks.config.unhandledErrorHandler = () => {
            unhandledErrorHandlerCalled = true;
        };
        
        SyncTasks.Rejected<number>().fail(() => {
            // Should not create a separate "unhandled" error since there is no way to "handle" it from here.
            // The existing "unhandled" error should continue to be "unhandled", as other tests have verified.
        }).catch(() => {
            // "Handle" the failure.
            catchBlockReached = true;
        });
        
        setTimeout(() => {
            SyncTasks.config.unhandledErrorHandler = oldUnhandledErrorHandler;
            assert(!unhandledErrorHandlerCalled);
            assert(catchBlockReached);
            done();
        }, 20);
    });

    it('Add callback while resolving', (done) => {
        const task = SyncTasks.Defer<number>();
        const promise = task.promise();
        let resolvedCount = 0;

        const innerTask1 = SyncTasks.Defer<number>();
        const innerTask2 = SyncTasks.Defer<number>();

        promise.then(() => {
            // While resolving: add callback to same promise.
            promise.then(() => {
                innerTask2.resolve(++resolvedCount);
            }, err => {
                assert(false);
            });
            // This line should be reached before innerTask2 resolves.
            innerTask1.resolve(++resolvedCount);
        }, err => {
            assert(false);
        });

        task.resolve(1);

        SyncTasks.all([innerTask1.promise(), innerTask2.promise()]).then(rets => {
            assert(rets.length === 2);
            assert(rets[0] === 1);
            assert(rets[1] === 2);
            done();
        }, err => {
            assert(false);
        });
    });

    it('Add callback while rejecting', (done) => {
        const task = SyncTasks.Defer<number>();
        const promise = task.promise();
        let rejectedCount = 0;

        const innerTask1 = SyncTasks.Defer<number>();
        const innerTask2 = SyncTasks.Defer<number>();

        promise.then(() => {
            assert(false);
        }, err => {
            // While resolving: add callback to same promise.
            promise.then(() => {
                assert(false);
            }, err => {
                innerTask2.resolve(++rejectedCount);
            });
            // This line should be reached before innerTask2 resolves.
            innerTask1.resolve(++rejectedCount);
        });

        task.reject(1);

        SyncTasks.all([innerTask1.promise(), innerTask2.promise()]).then(rets => {
            assert(rets.length === 2);
            assert(rets[0] === 1);
            assert(rets[1] === 2);
            done();
        }, err => {
            assert(false);
        });
    });

    it('Cancel task happy path', () => {
        let canceled = false;
        let cancelContext: any;

        const task = SyncTasks.Defer<number>();
        task.onCancel((context) => {
            canceled = true;
            cancelContext = context;
            task.reject(5);
        });

        const promise = task.promise();
        promise.cancel(4);

        return promise.then(() => {
            assert(false);
            return SyncTasks.Rejected();
        }, (err) => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return SyncTasks.Resolved<number>();
        });
    });

    it('Cancel task chained', () => {
        let canceled = false;
        let cancelContext: any;

        const task = SyncTasks.Defer<number>();
        task.onCancel((context) => {
            canceled = true;
            cancelContext = context;
            task.reject(5);
        });

        const promise = task.promise();
        const secPromise = promise.then(() => {
            assert(false);
            return SyncTasks.Rejected();
        }, (err) => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return -1;
        });
        secPromise.cancel(4);

        return promise.then(() => {
            assert(false);
            return SyncTasks.Rejected();
        }, (err) => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return SyncTasks.Resolved<number>();
        });
    });

    it('Cancel task late chained early cancel', () => {
        let canceled = false;
        let cancelContext: any;

        const task = SyncTasks.Defer<number>();
        const promise = task.promise();
        promise.cancel(4);
        
        const ret = promise.then(() => {
            const newTask = SyncTasks.Defer<number>();
            newTask.onCancel((context) => {
                canceled = true;
                cancelContext = context;
                newTask.reject(5);
            });
            return newTask.promise();
        }, (err) => {
            assert(false);
            return SyncTasks.Rejected();
        }).catch(err => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return SyncTasks.Resolved<number>();
        });

        task.resolve();
        return ret;
    });

    it('Cancel task late chained late cancel', () => {
        let canceled = false;
        let cancelContext: any;

        const task = SyncTasks.Defer<number>();
        const promise = task.promise();
        
        const ret = promise.then(() => {
            const newTask = SyncTasks.Defer<number>();
            newTask.onCancel((context) => {
                canceled = true;
                cancelContext = context;
                newTask.reject(5);
            });
            setTimeout(() => {
                promise.cancel(4);
            }, 100);
            return newTask.promise();
        }, (err) => {
            assert(false);
            return SyncTasks.Rejected();
        }).catch(err => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return SyncTasks.Resolved<number>();
        });

        task.resolve();
        return ret;
    });

    it('Cancel task late double-chained inner early cancel', () => {
        let canceled = false;
        let cancelContext: any;

        const task = SyncTasks.Defer<number>();
        const promise = task.promise();
        promise.cancel(4);
        
        const ret = promise.then(() => {
            const newTask = SyncTasks.Defer<number>();
            newTask.onCancel((context) => {
                canceled = true;
                cancelContext = context;
                newTask.reject(5);
            });
            return newTask.promise().then(() => {
                // Chain another promise in place to make sure it works its way up to the newTask at some point.
                return 6;
            });
        }, (err) => {
            assert(false);
            return SyncTasks.Rejected();
        }).catch(err => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return SyncTasks.Resolved<number>();
        });

        task.resolve();
        return ret;
    });

    it('Cancel task late double-chained inner late cancel', () => {
        let canceled = false;
        let cancelContext: any;

        const task = SyncTasks.Defer<number>();
        const promise = task.promise();
        
        const ret = promise.then(() => {
            const newTask = SyncTasks.Defer<number>();
            newTask.onCancel((context) => {
                canceled = true;
                cancelContext = context;
                newTask.reject(5);
            });
            setTimeout(() => {
                promise.cancel(4);
            }, 100);
            return newTask.promise().then(() => {
                // Chain another promise in place to make sure it works its way up to the newTask at some point.
                return 6;
            });
        }, (err) => {
            assert(false);
            return SyncTasks.Rejected();
        }).catch(err => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return SyncTasks.Resolved<number>();
        });

        task.resolve();
        return ret;
    });

    it('Cancel task late double-chained inner with .all and early cancel', () => {
        let canceled = false;
        let cancelContext: any;

        const task = SyncTasks.Defer<number>();
        const promise = task.promise();
        promise.cancel(4);
        
        const ret = promise.then(() => {
            const newTask = SyncTasks.Defer<number>();
            newTask.onCancel((context) => {
                canceled = true;
                cancelContext = context;
                newTask.reject(5);
            });
            return SyncTasks.all([newTask.promise()]).then(() => {
                // Chain another promise in place to make sure it works its way up to the newTask at some point.
                return 6;
            });
        }, (err) => {
            assert(false);
            return SyncTasks.Rejected();
        }).catch(err => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return SyncTasks.Resolved<number>();
        });

        task.resolve();
        return ret;
    });

    it('Cancel task late double-chained inner with .all and late cancel', () => {
        let canceled = false;
        let cancelContext: any;

        const task = SyncTasks.Defer<number>();
        const promise = task.promise();
        
        const ret = promise.then(() => {
            const newTask = SyncTasks.Defer<number>();
            newTask.onCancel((context) => {
                canceled = true;
                cancelContext = context;
                newTask.reject(5);
            });
            setTimeout(() => {
                promise.cancel(4);
            }, 100);
            return SyncTasks.all([newTask.promise()]).then(() => {
                // Chain another promise in place to make sure it works its way up to the newTask at some point.
                return 6;
            });
        }, (err) => {
            assert(false);
            return SyncTasks.Rejected();
        }).catch(err => {
            assert.equal(err, 5);
            assert(canceled);
            assert.equal(cancelContext, 4);
            return SyncTasks.Resolved<number>();
        });

        task.resolve();
        return ret;
    });

    it('deferCallback', (done) => {
        let got = false;
        let got2 = false;
        SyncTasks.asyncCallback(() => {
            got = true;
        });
        setTimeout(() => {
            assert(got);
            assert(got2);
            done();
        }, 1);
        SyncTasks.asyncCallback(() => {
            got2 = true;
        });
        assert(!got);
        assert(!got2);
    });

    it('thenDeferred Simple', (done) => {
        const task = SyncTasks.Defer<number>();

        let tooEarly = true;
        task.promise().then(val => {
            assert.equal(val, 1);
            return 2;
        }, err => {
            assert(false);
            return null;
        }).thenAsync(val => {
            assert.equal(val, 2);
            assert(!tooEarly);
            done();
        }, err => {
            assert(false);
        });

        SyncTasks.asyncCallback(() => {
            tooEarly = false;
        });
        task.resolve(1);

        assert(tooEarly);
    });
});
