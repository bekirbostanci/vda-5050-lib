"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgvClient = void 0;
const __1 = require("..");
class AgvClient extends __1.Client {
    constructor(agvId, options) {
        super(options);
        this.agvId = agvId;
        this.validateAgvId(agvId, false);
    }
    publish(topic, object, options) {
        return this.publishTopic(topic, this.agvId, object, options);
    }
    subscribe(topic, handler) {
        return this.subscribeTopic(topic, this.agvId, handler);
    }
    validateTopicDirection(topic, asInbound) {
        switch (topic) {
            case __1.Topic.Connection:
                if (asInbound) {
                    throw new TypeError("Inbound connection message not compatible with AgvClient");
                }
                break;
            case __1.Topic.Factsheet:
                if (asInbound) {
                    throw new TypeError("Inbound factsheet message not compatible with AgvClient");
                }
                break;
            case __1.Topic.InstantActions:
                if (!asInbound) {
                    throw new TypeError("Outbound instantActions message not compatible with AgvClient");
                }
                break;
            case __1.Topic.Order:
                if (!asInbound) {
                    throw new TypeError("Outbound order message not compatible with AgvClient");
                }
                break;
            case __1.Topic.State:
                if (asInbound) {
                    throw new TypeError("Inbound state message not compatible with AgvClient");
                }
                break;
            case __1.Topic.Visualization:
                if (asInbound) {
                    throw new TypeError("Inbound visualization message not compatible with AgvClient");
                }
                break;
        }
    }
    getLastWillTopic() {
        return {
            topic: __1.Topic.Connection,
            subject: this.agvId,
            object: {
                connectionState: __1.ConnectionState.Connectionbroken,
            },
            retainMessage: true,
        };
    }
    async onStarted() {
        await this.publish(__1.Topic.Connection, { connectionState: __1.ConnectionState.Online }, { retainMessage: true });
    }
    async onStopping() {
        await this.publish(__1.Topic.Connection, { connectionState: __1.ConnectionState.Offline }, { retainMessage: true });
    }
}
exports.AgvClient = AgvClient;
