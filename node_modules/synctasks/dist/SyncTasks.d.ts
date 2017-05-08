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
export declare const config: {
    exceptionsToConsole: boolean;
    catchExceptions: boolean;
    traceEnabled: boolean;
    exceptionHandler: (ex: Error) => void;
    unhandledErrorHandler: (err: any) => void;
};
export interface Es6Thenable<R> {
    then<U>(onFulfilled?: (value: R) => U | Es6Thenable<U>, onRejected?: (error: any) => U | Es6Thenable<U>): Es6Thenable<U>;
    then<U>(onFulfilled?: (value: R) => U | Es6Thenable<U>, onRejected?: (error: any) => void): Es6Thenable<U>;
}
export declare function fromThenable<T>(thenable: Es6Thenable<T>): Promise<T>;
/**
 * This function will defer callback of the specified callback lambda until the next JS tick, simulating standard A+ promise behavior
 */
export declare function asyncCallback(callback: () => void): void;
export declare type SuccessFunc<T, U> = (value: T) => U | Thenable<U> | void;
export declare type ErrorFunc<U> = (error: any) => U | Thenable<U> | void;
export declare type CancelFunc = (context: any) => void;
export declare function Defer<T>(): Deferred<T>;
export declare function Resolved<T>(val?: T): Promise<T>;
export declare function Rejected<T>(val?: any): Promise<T>;
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
    cancel(context?: any): void;
}
export interface Promise<T> extends Thenable<T>, Cancelable {
    catch<U>(errorFunc: ErrorFunc<U>): Promise<U>;
    finally(func: (value: T | any) => void): Promise<T>;
    always<U>(func: (value: T | any) => U | Thenable<U>): Promise<U>;
    done(successFunc: (value: T) => void): Promise<T>;
    fail(errorFunc: (error: any) => void): Promise<T>;
    thenAsync<U>(successFunc: SuccessFunc<T, U>, errorFunc?: ErrorFunc<U>): Promise<U>;
    setTracingEnabled(enabled: boolean): Promise<T>;
}
export declare type Raceable<T> = T | Thenable<T>;
export declare function all<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>, Raceable<T9>, Raceable<T10>]): Promise<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]>;
export declare function all<T1, T2, T3, T4, T5, T6, T7, T8, T9>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>, Raceable<T9>]): Promise<[T1, T2, T3, T4, T5, T6, T7, T8, T9]>;
export declare function all<T1, T2, T3, T4, T5, T6, T7, T8>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>]): Promise<[T1, T2, T3, T4, T5, T6, T7, T8]>;
export declare function all<T1, T2, T3, T4, T5, T6, T7>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>]): Promise<[T1, T2, T3, T4, T5, T6, T7]>;
export declare function all<T1, T2, T3, T4, T5, T6>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>]): Promise<[T1, T2, T3, T4, T5, T6]>;
export declare function all<T1, T2, T3, T4, T5>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>]): Promise<[T1, T2, T3, T4, T5]>;
export declare function all<T1, T2, T3, T4>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>]): Promise<[T1, T2, T3, T4]>;
export declare function all<T1, T2, T3>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>]): Promise<[T1, T2, T3]>;
export declare function all<T1, T2>(values: [Raceable<T1>, Raceable<T2>]): Promise<[T1, T2]>;
export declare function all<T>(values: (T | Thenable<T>)[]): Promise<T[]>;
export declare function race<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>, Raceable<T9>, Raceable<T10>]): Promise<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10>;
export declare function race<T1, T2, T3, T4, T5, T6, T7, T8, T9>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>, Raceable<T9>]): Promise<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9>;
export declare function race<T1, T2, T3, T4, T5, T6, T7, T8>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>, Raceable<T8>]): Promise<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8>;
export declare function race<T1, T2, T3, T4, T5, T6, T7>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>, Raceable<T7>]): Promise<T1 | T2 | T3 | T4 | T5 | T6 | T7>;
export declare function race<T1, T2, T3, T4, T5, T6>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>, Raceable<T6>]): Promise<T1 | T2 | T3 | T4 | T5 | T6>;
export declare function race<T1, T2, T3, T4, T5>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>, Raceable<T5>]): Promise<T1 | T2 | T3 | T4 | T5>;
export declare function race<T1, T2, T3, T4>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>, Raceable<T4>]): Promise<T1 | T2 | T3 | T4>;
export declare function race<T1, T2, T3>(values: [Raceable<T1>, Raceable<T2>, Raceable<T3>]): Promise<T1 | T2 | T3>;
export declare function race<T1, T2>(values: [Raceable<T1>, Raceable<T2>]): Promise<T1 | T2>;
export declare function race<T>(values: (T | Thenable<T>)[]): Promise<T[]>;
export declare type RaceTimerResponse<T> = {
    timedOut: boolean;
    result?: T;
};
export declare function raceTimer<T>(promise: Promise<T>, timeMs: number): Promise<RaceTimerResponse<T>>;
