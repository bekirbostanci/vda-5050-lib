"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlainObject = exports.ErrorType = exports.isExtensionTopic = exports.Topic = void 0;
var Topic;
(function (Topic) {
    Topic["Order"] = "order";
    Topic["InstantActions"] = "instantActions";
    Topic["State"] = "state";
    Topic["Visualization"] = "visualization";
    Topic["Connection"] = "connection";
    Topic["Factsheet"] = "factsheet";
})(Topic = exports.Topic || (exports.Topic = {}));
function isExtensionTopic(topic) {
    for (const value in Topic) {
        if (Topic[value] === topic) {
            return false;
        }
    }
    return true;
}
exports.isExtensionTopic = isExtensionTopic;
var ErrorType;
(function (ErrorType) {
    ErrorType["Order"] = "orderError";
    ErrorType["OrderUpdate"] = "orderUpdateError";
    ErrorType["OrderNoRoute"] = "noRouteError";
    ErrorType["OrderValidation"] = "validationError";
    ErrorType["OrderAction"] = "orderActionError";
    ErrorType["InstantAction"] = "instantActionError";
    ErrorType["InstantActionValidation"] = "validationError";
    ErrorType["InstantActionNoOrderToCancel"] = "noOrderToCancel";
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
}
exports.isPlainObject = isPlainObject;
