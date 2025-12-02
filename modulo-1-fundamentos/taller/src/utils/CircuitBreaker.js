"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitBreakerState = void 0;
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "CLOSED";
    CircuitBreakerState["OPEN"] = "OPEN";
    CircuitBreakerState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
var CircuitBreaker = /** @class */ (function () {
    function CircuitBreaker(failureThreshold, openStateTimeout) {
        this.failureThreshold = failureThreshold;
        this.openStateTimeout = openStateTimeout;
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.nextAttempt = Date.now();
    }
    CircuitBreaker.prototype.canRequest = function () {
        if (this.state === CircuitBreakerState.OPEN && Date.now() > this.nextAttempt) {
            this.state = CircuitBreakerState.HALF_OPEN;
        }
        return this.state !== CircuitBreakerState.OPEN;
    };
    CircuitBreaker.prototype.recordFailure = function () {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitBreakerState.OPEN;
            this.nextAttempt = Date.now() + this.openStateTimeout;
            console.error("Circuito abierto: demasiados fallos consecutivos.");
        }
    };
    CircuitBreaker.prototype.recordSuccess = function () {
        this.failureCount = 0;
        this.state = CircuitBreakerState.CLOSED;
        console.log("Circuito cerrado: el sistema se ha recuperado.");
    };
    CircuitBreaker.prototype.recordHalfOpenFailure = function () {
        this.state = CircuitBreakerState.OPEN;
        this.nextAttempt = Date.now() + this.openStateTimeout;
        console.error("Circuito reabierto: fallo en estado HALF-OPEN.");
    };
    CircuitBreaker.prototype.getState = function () {
        return this.state;
    };
    return CircuitBreaker;
}());
exports.CircuitBreaker = CircuitBreaker;
