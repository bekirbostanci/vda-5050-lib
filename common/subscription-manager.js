"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionManager = void 0;
const uuid_1 = require("uuid");
const mqtt_utils_1 = require("./mqtt-utils");
class SubscriptionManager {
    constructor(topicFormat, interfaceName, protocolVersion) {
        this._subscriptions = new Map();
        this._subscriptionIds = new Map();
        this._compileMqttTopic(topicFormat, interfaceName, protocolVersion);
    }
    getMqttTopic(topic, subject) {
        var _a, _b;
        return this._constructMqttTopic((_a = subject.manufacturer) !== null && _a !== void 0 ? _a : "+", (_b = subject.serialNumber) !== null && _b !== void 0 ? _b : "+", topic !== null && topic !== void 0 ? topic : "+");
    }
    getMqttTopicUtf8Length(topic, subject) {
        var _a, _b;
        return this._getMqttTopicUtf8Length((_a = subject.manufacturer) !== null && _a !== void 0 ? _a : "+", (_b = subject.serialNumber) !== null && _b !== void 0 ? _b : "+", topic !== null && topic !== void 0 ? topic : "+");
    }
    clear() {
        this._subscriptions.clear();
        this._subscriptionIds.clear();
    }
    add(topic, subject, handler) {
        (0, mqtt_utils_1.assertMqttTopicUtf8Count)(this.getMqttTopicUtf8Length(topic, subject));
        const id = (0, uuid_1.v4)();
        const path = [subject.manufacturer, subject.serialNumber, topic];
        let pathIndex = path.length - 1;
        let map = this._subscriptions;
        while (pathIndex !== -1) {
            const key = path[pathIndex];
            let value = map.get(key);
            if (value === undefined) {
                value = new Map();
                map.set(key, value);
            }
            map = value;
            pathIndex--;
        }
        this._subscriptionIds.set(id, map);
        map.set(id, handler);
        if (map.size === 1) {
            const mqttTopic = map["mqttTopic"] = this.getMqttTopic(topic, subject);
            return { id, mqttTopic, requiresSubscribe: true };
        }
        return { id, mqttTopic: map["mqttTopic"], requiresSubscribe: false };
    }
    remove(id) {
        const subIdsMap = this._subscriptionIds.get(id);
        if (subIdsMap === undefined || !subIdsMap.has(id)) {
            return undefined;
        }
        subIdsMap.delete(id);
        return {
            mqttTopic: subIdsMap["mqttTopic"],
            requiresUnsubscribe: subIdsMap.size === 0,
        };
    }
    getAll() {
        const mqttTopics = [];
        const walk = (map) => {
            const mqttTopic = map["mqttTopic"];
            if (mqttTopic !== undefined) {
                if (map.size > 0) {
                    mqttTopics.push(mqttTopic);
                }
                return;
            }
            map.forEach(subMap => walk(subMap));
        };
        walk(this._subscriptions);
        return mqttTopics;
    }
    find(mqttTopic, subject) {
        const path = this._deconstructMqttTopic(mqttTopic);
        if (path[0] === undefined) {
            path[0] = subject.manufacturer;
        }
        if (path[1] === undefined) {
            path[1] = subject.serialNumber;
        }
        return [this._findInternal(this._subscriptions, path, path.length - 1), path[2]];
    }
    *_findInternal(map, path, pathIndex) {
        if (pathIndex === -1) {
            yield* map.entries();
            return;
        }
        const key = path[pathIndex];
        let value = map.get(key);
        if (value !== undefined) {
            yield* this._findInternal(value, path, pathIndex - 1);
        }
        value = map.get(undefined);
        if (value !== undefined) {
            yield* this._findInternal(value, path, pathIndex - 1);
        }
    }
    _compileMqttTopic(topicFormat, interfaceName, protocolVersion) {
        const majorVersion = `v${protocolVersion.substring(0, protocolVersion.indexOf("."))}`;
        const placeholders = ["%interfaceName%", "%majorVersion%", "%manufacturer%", "%serialNumber%", "%topic%"];
        const levels = topicFormat.split("/");
        const indices = placeholders.map(p => levels.indexOf(p));
        for (let i = 0; i < indices.length; i++) {
            if (levels.some((l, li) => l.search(placeholders[i]) !== -1 && li !== indices[i])) {
                throw new Error(`Invalid topic format: ${placeholders[i]} placeholder not a complete topic level or specified multiple times`);
            }
        }
        if (indices[4] === -1) {
            throw new Error("Invalid topic format: %topic% placeholder is missing");
        }
        this._constructMqttTopic = (manufacturer, serialNumber, topic) => {
            levels[indices[0]] = interfaceName;
            levels[indices[1]] = majorVersion;
            levels[indices[2]] = manufacturer;
            levels[indices[3]] = serialNumber;
            levels[indices[4]] = topic;
            return levels.join("/");
        };
        this._deconstructMqttTopic = (mqttTopic) => {
            const mqttLevels = mqttTopic.split("/");
            return [
                mqttLevels[indices[2]],
                mqttLevels[indices[3]],
                mqttLevels[indices[4]],
            ];
        };
        this._getMqttTopicUtf8Length = (manufacturer, serialNumber, topic) => {
            levels[indices[0]] = interfaceName;
            levels[indices[1]] = majorVersion;
            levels[indices[2]] = manufacturer;
            levels[indices[3]] = serialNumber;
            levels[indices[4]] = topic;
            return levels.reduce((prev, cur, index, arr) => prev + (0, mqtt_utils_1.getUtf8BytesCount)(cur) + (index === arr.length - 1 ? 0 : 1), 0);
        };
    }
}
exports.SubscriptionManager = SubscriptionManager;
