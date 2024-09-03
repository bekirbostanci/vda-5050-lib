"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = exports.createUuid = void 0;
const debug_1 = require("debug");
const mqtt_1 = require("mqtt/dist/mqtt");
const uuid_1 = require("uuid");
const __1 = require("..");
const mqtt_utils_1 = require("./mqtt-utils");
const subscription_manager_1 = require("./subscription-manager");
const vda_5050_validators_1_1_1 = require("./vda-5050-validators-1.1");
const vda_5050_validators_2_0_1 = require("./vda-5050-validators-2.0");
function createUuid() {
    return (0, uuid_1.v4)();
}
exports.createUuid = createUuid;
class Client {
    constructor(options) {
        this._isStarted = false;
        this._isStopping = false;
        this._clientOptions = options;
        this.clientId = `${(0, uuid_1.v4)().replace(/-/g, "").substr(0, 23)}`;
        this.debug = (0, debug_1.default)(`vda-5050:${this.clientId.substr(0, 10)}`).extend(this.constructor.name);
        this._validateOptions(options);
        this._headerIds = new Map();
        this._subscriptionManager = new subscription_manager_1.SubscriptionManager(options.transport.topicFormat || Client.DEFAULT_MQTT_TOPIC_FORMAT, this.clientOptions.interfaceName, this.getProtocolVersion());
        this._isWebPlatform = new Function("try {return this===window;}catch(e){return false;}")();
        this._extensionTopics = new Map();
        this._emitConnectionStateChange("offline");
        this.debug("Create instance with clientOptions %o", options);
    }
    get clientOptions() {
        return this._clientOptions;
    }
    get protocolVersion() {
        return this.getProtocolVersion();
    }
    createUuid() {
        return createUuid();
    }
    async start() {
        if (this._isStarted) {
            return;
        }
        this.debug("Starting client");
        await this._connect();
        this._isStarted = true;
        await this.onStarted();
    }
    async stop() {
        if (!this._isStarted || this._isStopping) {
            return;
        }
        this.debug("Stopping client");
        this._isStopping = true;
        await this.onStopping();
        this._isStarted = false;
        this._isStopping = false;
        await this._disconnect();
    }
    unsubscribe(subscriptionId) {
        this.debug("Unsubscribing subscription ID %s", subscriptionId);
        if (!this._isStarted) {
            throw new Error("Client is not started");
        }
        return new Promise((resolve, reject) => {
            const { mqttTopic, requiresUnsubscribe } = this._subscriptionManager.remove(subscriptionId);
            if (!requiresUnsubscribe) {
                this.debug("Unsubscribed id %s, more subscriptions on MQTT topic %s", subscriptionId, mqttTopic);
                resolve();
                return;
            }
            if (!this._mqtt.connected) {
                this.debug("Unsubscribe on MQTT topic %s for id %s while offline", mqttTopic, subscriptionId);
                resolve();
                return;
            }
            this._mqtt.unsubscribe(mqttTopic, err => {
                if (err) {
                    this.debug("Unsubscribe on MQTT topic %s for id %s failed: %s", mqttTopic, subscriptionId, err);
                    reject(err);
                }
                else {
                    this.debug("Unsubscribed on MQTT topic %s for id %s", mqttTopic, subscriptionId);
                    resolve();
                }
            });
        });
    }
    registerConnectionStateChange(callback) {
        this._connectionStateChangeCallback = callback;
        this._emitConnectionStateChange(this._connectionState);
    }
    registerExtensionTopic(extensionTopic, asInbound, asOutbound, validator) {
        this._extensionTopics.set(extensionTopic, [asInbound, asOutbound, validator]);
    }
    getProtocolVersion() {
        return this._clientOptions.vdaVersion;
    }
    get isStarted() {
        return this._isStarted;
    }
    onStarted() {
    }
    onStopping() {
    }
    getLastWillTopic() {
        return undefined;
    }
    publishTopic(topic, subject, object, options) {
        var _a;
        this.debug("Publishing on topic %s for subject %o with object %j", topic, subject, object);
        if (!this._isStarted) {
            throw new Error("Client is not started");
        }
        this._validateTopic(topic, false);
        this.validateAgvId(subject, false);
        const headerfullObject = this._withObjectHeader(topic, subject, object);
        if (((_a = this.clientOptions.topicObjectValidation) === null || _a === void 0 ? void 0 : _a.outbound) !== false) {
            this.validateTopicObject(topic, headerfullObject, this.clientOptions.vdaVersion);
        }
        const mqttTopic = this._subscriptionManager.getMqttTopic(topic, subject);
        (0, mqtt_utils_1.assertMqttTopicLength)(mqttTopic);
        const mqttPayload = JSON.stringify(headerfullObject);
        return new Promise((resolve, reject) => {
            var _a;
            const mqttOptions = this._withMqttProperties({ retain: (_a = options === null || options === void 0 ? void 0 : options.retainMessage) !== null && _a !== void 0 ? _a : false });
            if (!this._mqtt.connected) {
                if (options === null || options === void 0 ? void 0 : options.dropIfOffline) {
                    this.debug("Drop offline publish on topic %s", mqttTopic);
                    resolve(undefined);
                    return;
                }
                else {
                    this.debug("Publish on MQTT topic %s while offline with retain %s with object %j", mqttTopic, mqttOptions.retain, headerfullObject);
                    this._mqtt.publish(mqttTopic, mqttPayload, mqttOptions);
                    resolve(headerfullObject);
                    return;
                }
            }
            this._mqtt.publish(mqttTopic, mqttPayload, mqttOptions, err => {
                if (err) {
                    this.debug("Publish on MQTT topic %s failed: %s", mqttTopic, err);
                    reject(err);
                }
                else {
                    this.debug("Published on MQTT topic %s with retain %s with object %j", mqttTopic, mqttOptions.retain, headerfullObject);
                    resolve(headerfullObject);
                }
            });
        });
    }
    subscribeTopic(topic, subject, handler) {
        this.debug("Subscribing on topic %s for subject %o", topic, subject);
        if (!this._isStarted) {
            throw new Error("Client is not started");
        }
        this._validateTopic(topic, true);
        this.validateAgvId(subject, true);
        const { id, mqttTopic, requiresSubscribe } = this._subscriptionManager.add(topic, subject, handler);
        return new Promise((resolve, reject) => {
            if (!requiresSubscribe) {
                this.debug("Already subscribed on MQTT topic %s with id %s", mqttTopic, id);
                resolve(id);
                return;
            }
            const mqttOptions = { qos: 0, rap: true, rh: 0 };
            if (!this._mqtt.connected) {
                this.debug("Subscribe on MQTT topic %s with id %s while offline", mqttTopic, id);
                resolve(id);
                return;
            }
            this._mqtt.subscribe(mqttTopic, mqttOptions, err => {
                if (err) {
                    this.debug("Subscribe on MQTT topic %s with id %s failed: %s", mqttTopic, id, err);
                    reject(err);
                }
                else {
                    this.debug("Subscribed on MQTT topic %s with id %s", mqttTopic, id);
                    resolve(id);
                }
            });
        });
    }
    validateTopicDirection(topic, forSubscription) {
    }
    validateAgvId(agvId, forSubscription) {
        if (agvId.manufacturer === "") {
            throw new TypeError("Empty string passed in AgvId.manufacturer.");
        }
        if (!forSubscription && !agvId.manufacturer) {
            throw new TypeError("AgvId.manufacturer not specified for publication");
        }
        if (agvId.manufacturer && !this._isValidTopicLevel(agvId.manufacturer)) {
            throw new TypeError("AgvId.manufacturer is not a valid MQTT topic level");
        }
        if (agvId.serialNumber === "") {
            throw new TypeError("Empty string passed in AgvId.serialNumber.");
        }
        if (!forSubscription && !agvId.serialNumber) {
            throw new TypeError("AgvId.serialNumber not specified for publication");
        }
        if (agvId.serialNumber &&
            (!this._isValidTopicLevel(agvId.serialNumber) || /[^A-Za-z0-9_.:-]/.test(agvId.serialNumber))) {
            throw new TypeError("AgvId.serialNumber is not a valid MQTT topic level or not restricted to A-Z a-z 0-9 _ . : -");
        }
    }
    validateTopicObject(topic, object, vdaVersion) {
        if (!object || typeof object !== "object") {
            throw new TypeError(`Invalid VDA 5050 object ${object}`);
        }
        if (object.version !== vdaVersion) {
            throw new TypeError(`Invalid VDA 5050 Version. ${topic} version: ${object.version} is not compatible with client verion: ${vdaVersion}`);
        }
        switch (topic) {
            case __1.Topic.Connection:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!(0, vda_5050_validators_1_1_1.validateConnection)(object)) {
                            throw new TypeError(`Invalid VDA 5050 Connection at ${vda_5050_validators_1_1_1.validateConnection.errors[0].keywordLocation}, ${vda_5050_validators_1_1_1.validateConnection.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!(0, vda_5050_validators_2_0_1.validateConnection)(object)) {
                            throw new TypeError(`Invalid VDA 5050 Connection at ${vda_5050_validators_2_0_1.validateConnection.errors[0].keywordLocation}, ${vda_5050_validators_2_0_1.validateConnection.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`Connection Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case __1.Topic.InstantActions:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!(0, vda_5050_validators_1_1_1.validateInstantActions)(object)) {
                            throw new TypeError(`Invalid VDA 5050 InstantActions at ${vda_5050_validators_1_1_1.validateInstantActions.errors[0].keywordLocation}, ${vda_5050_validators_1_1_1.validateInstantActions.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!(0, vda_5050_validators_2_0_1.validateInstantActions)(object)) {
                            throw new TypeError(`Invalid VDA 5050 InstantActions at ${vda_5050_validators_2_0_1.validateInstantActions.errors[0].keywordLocation}, ${vda_5050_validators_2_0_1.validateInstantActions.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`InstantAction Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case __1.Topic.Order:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!(0, vda_5050_validators_1_1_1.validateOrder)(object)) {
                            throw new TypeError(`Invalid VDA 5050 Order at ${vda_5050_validators_1_1_1.validateOrder.errors[0].keywordLocation}, ${vda_5050_validators_1_1_1.validateOrder.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!(0, vda_5050_validators_2_0_1.validateOrder)(object)) {
                            throw new TypeError(`Invalid VDA 5050 Order at ${vda_5050_validators_2_0_1.validateOrder.errors[0].keywordLocation}, ${vda_5050_validators_2_0_1.validateOrder.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`Order Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case __1.Topic.State:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!(0, vda_5050_validators_1_1_1.validateState)(object)) {
                            throw new TypeError(`Invalid VDA 5050 State at ${vda_5050_validators_1_1_1.validateState.errors[0].keywordLocation}, ${vda_5050_validators_1_1_1.validateState.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!(0, vda_5050_validators_2_0_1.validateState)(object)) {
                            throw new TypeError(`Invalid VDA 5050 State at ${vda_5050_validators_2_0_1.validateState.errors[0].keywordLocation}, ${vda_5050_validators_2_0_1.validateState.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`State Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case __1.Topic.Visualization:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!(0, vda_5050_validators_1_1_1.validateVisualization)(object)) {
                            throw new TypeError(`Invalid VDA 5050 Visualization at ${vda_5050_validators_1_1_1.validateVisualization.errors[0].keywordLocation}, ${vda_5050_validators_1_1_1.validateVisualization.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!(0, vda_5050_validators_2_0_1.validateVisualization)(object)) {
                            throw new TypeError(`Invalid VDA 5050 Visualization at ${vda_5050_validators_2_0_1.validateVisualization.errors[0].keywordLocation}, ${vda_5050_validators_2_0_1.validateVisualization.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`Visualization Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case __1.Topic.Factsheet:
                switch (vdaVersion) {
                    case "2.0.0":
                        if (!(0, vda_5050_validators_2_0_1.validateFactsheet)(object)) {
                            throw new TypeError(`Invalid VDA 5050 Factsheet at ${vda_5050_validators_2_0_1.validateFactsheet.errors[0].keywordLocation}, ${vda_5050_validators_2_0_1.validateFactsheet.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`Factsheet Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            default:
                const [, , validator] = this._extensionTopics.get(topic);
                validator(topic, object);
                break;
        }
    }
    reset() {
        this._subscriptionManager.clear();
    }
    _connect() {
        var _a, _b, _c, _d, _e;
        const transOpts = this.clientOptions.transport;
        const mqttOpts = {
            keepalive: (_a = transOpts.heartbeat) !== null && _a !== void 0 ? _a : 15,
            reschedulePings: false,
            clientId: this.clientId,
            protocolId: "MQTT",
            protocolVersion: transOpts.protocolVersion === "5.0" ? 5 : 4,
            reconnectPeriod: (_b = transOpts.reconnectPeriod) !== null && _b !== void 0 ? _b : 1000,
            connectTimeout: (_c = transOpts.connectTimeout) !== null && _c !== void 0 ? _c : 30000,
            clean: true,
            resubscribe: false,
            queueQoSZero: true,
            username: transOpts.username,
            password: transOpts.password,
            ...(_d = transOpts.tlsOptions) !== null && _d !== void 0 ? _d : {},
            wsOptions: (_e = transOpts.wsOptions) !== null && _e !== void 0 ? _e : {},
            transformWsUrl: transOpts.transformWsUrl,
            will: this._createLastWill(),
        };
        let connectionUrl = this.clientOptions.transport.brokerUrl;
        if (this._isWebPlatform) {
            connectionUrl = connectionUrl.replace(/^mqtt/, "ws");
        }
        return new Promise((resolve, reject) => {
            this.debug("Connecting to %s", connectionUrl);
            const mqtt = this._mqtt = (0, mqtt_1.connect)(connectionUrl, mqttOpts);
            const onceFailureListener = error => {
                this._mqtt = undefined;
                mqtt.end(true, () => {
                    reject(error);
                });
            };
            mqtt
                .once("error", onceFailureListener)
                .once("close", onceFailureListener)
                .once("connect", () => {
                mqtt.removeListener("error", onceFailureListener);
                mqtt.removeListener("close", onceFailureListener);
                resolve();
            })
                .prependListener("connect", () => {
                this.debug("Connected to %s", connectionUrl);
                const resubscribes = this._subscriptionManager.getAll();
                if (resubscribes.length > 0) {
                    this.debug("Resubscribe %d subscription topics", resubscribes.length);
                    mqtt.subscribe(resubscribes);
                }
            })
                .on("connect", () => {
                this._emitConnectionStateChange("online");
            })
                .on("reconnect", () => {
                this.debug("Reconnecting to %s", connectionUrl);
            })
                .on("close", () => {
                this._emitConnectionStateChange("offline");
                this.debug("Disconnected");
            })
                .on("offline", () => {
                this._emitConnectionStateChange("offline");
                this.debug("Offline - connection broken - reconnection pending");
            })
                .on("error", error => {
                this._emitConnectionStateChange("offline");
                this.debug("Error on connect: %s", error);
            })
                .on("message", (topic, payload) => {
                this._dispatchMessage(topic, payload);
            });
        });
    }
    _disconnect() {
        if (!this._mqtt) {
            return;
        }
        const mqtt = this._mqtt;
        this._mqtt = undefined;
        return new Promise(resolve => {
            mqtt.end(false, () => {
                this.reset();
                resolve();
            });
        });
    }
    _emitConnectionStateChange(connectionState) {
        const previousConnectionState = this._connectionState;
        this._connectionState = connectionState;
        if (this._connectionStateChangeCallback) {
            this._connectionStateChangeCallback(connectionState, previousConnectionState);
        }
    }
    _dispatchMessage(mqttTopic, mqttPayload) {
        var _a;
        let rethrowError = false;
        try {
            const payloadString = mqttPayload.toString();
            this.debug("Inbound message on MQTT topic %s with payload %s", mqttTopic, payloadString);
            const object = JSON.parse(payloadString);
            const subject = { manufacturer: object.manufacturer, serialNumber: object.serialNumber };
            const [idAndHandlers, topic] = this._subscriptionManager.find(mqttTopic, subject);
            if (((_a = this.clientOptions.topicObjectValidation) === null || _a === void 0 ? void 0 : _a.inbound) !== false) {
                this.validateTopicObject(topic, object, this.clientOptions.vdaVersion);
            }
            rethrowError = true;
            for (const [id, handler] of idAndHandlers) {
                handler(object, subject, topic, id);
            }
        }
        catch (error) {
            if (rethrowError) {
                this.debug("Uncaught error in handler for inbound message on MQTT topic %s: %s", mqttTopic, error.message);
                throw error;
            }
            console.error("Drop inbound message on MQTT topic %s with error: %s", mqttTopic, error.message);
            this.debug("Drop inbound message on MQTT topic %s with error: %s", mqttTopic, error.message);
        }
    }
    _validateOptions(options) {
        var _a;
        if (options.interfaceName === undefined) {
            throw new TypeError("ClientOption interfaceName is required");
        }
        if (!this._isValidTopicLevel(options.interfaceName)) {
            throw new TypeError("ClientOption interfaceName is not a valid MQTT topic level");
        }
        if (!((_a = options.transport) === null || _a === void 0 ? void 0 : _a.brokerUrl)) {
            throw new TypeError("MqttTransportOption brokerUrl is missing");
        }
        if (options.vdaVersion === undefined) {
            throw new TypeError(`Vda Version is required`);
        }
        if (!this._isValidVdaVersion(options.vdaVersion)) {
            throw new TypeError(`Vda ${options.vdaVersion} Version not supported`);
        }
    }
    _isValidVdaVersion(version) {
        return version === "1.1.0" || version === "1.1" || version === "2.0" || version === "2.0.0";
    }
    _validateTopic(topic, forSubscription) {
        if (!topic) {
            throw new TypeError("Topic undefined or empty");
        }
        if (!this._isValidTopicLevel(topic)) {
            throw new TypeError(`Topic ${topic} is not a valid MQTT topic level`);
        }
        if ((0, __1.isExtensionTopic)(topic)) {
            if (!this._extensionTopics.has(topic)) {
                throw new TypeError(`Extension topic ${topic} is not registered`);
            }
            const [asInbound, asOutbound] = this._extensionTopics.get(topic);
            if (forSubscription && !asInbound) {
                throw new TypeError(`Extension topic ${topic} is not registered for inbound communication`);
            }
            if (!forSubscription && !asOutbound) {
                throw new TypeError(`Extension topic ${topic} is not registered for outbound communication`);
            }
        }
        else {
            this.validateTopicDirection(topic, forSubscription);
        }
    }
    _isValidTopicLevel(name) {
        return !Client.ILLEGAL_TOPIC_LEVEL_CHARS_REGEX.test(name);
    }
    _createLastWill() {
        const lastWill = this.getLastWillTopic();
        if (lastWill) {
            const mqttTopic = this._subscriptionManager.getMqttTopic(lastWill.topic, lastWill.subject);
            return this._withMqttProperties({
                topic: mqttTopic,
                payload: JSON.stringify(this._withObjectHeader(lastWill.topic, lastWill.subject, lastWill.object)),
                retain: lastWill.retainMessage,
            });
        }
        return undefined;
    }
    _withMqttProperties(pub) {
        pub.qos = 0;
        switch (this.clientOptions.transport.protocolVersion) {
            case "5.0":
                pub.properties = {
                    payloadFormatIndicator: true,
                    contentType: "application/json",
                };
                break;
            case "3.1.1":
            default:
                break;
        }
        return pub;
    }
    _withObjectHeader(topic, subject, object) {
        const obj = Object.assign({}, object);
        if (obj.timestamp === undefined) {
            obj.timestamp = new Date().toISOString();
        }
        obj.headerId = this._nextHeaderId(topic);
        obj.manufacturer = subject.manufacturer;
        obj.serialNumber = subject.serialNumber;
        obj.version = this.getProtocolVersion();
        return obj;
    }
    _nextHeaderId(topic) {
        var _a;
        const id = (_a = this._headerIds.get(topic)) !== null && _a !== void 0 ? _a : 0;
        this._headerIds.set(topic, id < 0xFFFFFFFF ? id + 1 : 0);
        return id;
    }
}
exports.Client = Client;
Client.ILLEGAL_TOPIC_LEVEL_CHARS_REGEX = /[\u0000+#/]/;
Client.DEFAULT_MQTT_TOPIC_FORMAT = "%interfaceName%/%majorVersion%/%manufacturer%/%serialNumber%/%topic%";
