"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterControlClient = void 0;
const __1 = require("..");
class MasterControlClient extends __1.Client {
    constructor() {
        super(...arguments);
        this._connectionStates = new __1.AgvIdMap();
    }
    publish(topic, subject, object, options) {
        return this.publishTopic(topic, subject, object, options);
    }
    subscribe(topic, subject, handler) {
        return this.subscribeTopic(topic, subject, handler);
    }
    trackAgvs(handler) {
        if (!this._trackHandler) {
            this._trackHandler = handler;
        }
        else {
            const previousHandler = this._trackHandler;
            this._trackHandler = (subject, state, timestamp) => {
                previousHandler(subject, state, timestamp);
                handler(subject, state, timestamp);
            };
        }
        for (const [agvId, connection] of this._connectionStates) {
            handler(agvId, connection.connectionState, connection.timestamp);
        }
    }
    getTrackedState(subject) {
        const conn = this._connectionStates.get(subject);
        return conn ? { state: conn.connectionState, timestamp: conn.timestamp } : undefined;
    }
    getTrackedStates() {
        const states = [];
        for (const [agvId, conn] of this._connectionStates) {
            states.push({ subject: agvId, state: conn.connectionState, timestamp: conn.timestamp });
        }
        return states;
    }
    reset() {
        super.reset();
        this._connectionStates.clear();
        this._trackHandler = undefined;
    }
    async onStarted() {
        await this.subscribeTopic(__1.Topic.Connection, {}, (connection, agvId) => {
            this._connectionStates.set(agvId, connection);
            if (!this._trackHandler) {
                return;
            }
            this._trackHandler(agvId, connection.connectionState, connection.timestamp);
        });
    }
    validateTopicDirection(topic, asInbound) {
        switch (topic) {
            case __1.Topic.Connection:
                if (!asInbound) {
                    throw new TypeError("Outbound connection message not compatible with MasterControlClient");
                }
                break;
            case __1.Topic.Factsheet:
                if (!asInbound) {
                    throw new TypeError("Outbound factsheet message not compatible with MasterControlClient");
                }
                break;
            case __1.Topic.InstantActions:
                if (asInbound) {
                    throw new TypeError("Inbound instantActions message not compatible with MasterControlClient");
                }
                break;
            case __1.Topic.Order:
                if (asInbound) {
                    throw new TypeError("Inbound order message not compatible with MasterControlClient");
                }
                break;
            case __1.Topic.State:
                if (!asInbound) {
                    throw new TypeError("Outbound state message not compatible with MasterControlClient");
                }
                break;
            case __1.Topic.Visualization:
                if (!asInbound) {
                    throw new TypeError("Outbound visualization message not compatible with MasterControlClient");
                }
                break;
        }
    }
}
exports.MasterControlClient = MasterControlClient;
