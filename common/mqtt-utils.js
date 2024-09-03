"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUtf8BytesCount = exports.assertMqttTopicUtf8Count = exports.assertMqttTopicLength = void 0;
const MAX_MQTT_TOPIC_UTF8_COUNT = 65535;
function assertMqttTopicLength(mqttTopic) {
    if (mqttTopic.length * 4 > MAX_MQTT_TOPIC_UTF8_COUNT) {
        assertMqttTopicUtf8Count(getUtf8BytesCount(mqttTopic));
    }
}
exports.assertMqttTopicLength = assertMqttTopicLength;
function assertMqttTopicUtf8Count(utf8Count) {
    if (utf8Count > MAX_MQTT_TOPIC_UTF8_COUNT) {
        throw new Error(`MQTT topic exceeds maximum allowed UTF-8 byte length`);
    }
}
exports.assertMqttTopicUtf8Count = assertMqttTopicUtf8Count;
function getUtf8BytesCount(str) {
    let count = 0;
    const strLen = str.length;
    for (let i = 0; i < strLen; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x007F) {
            count++;
        }
        else if (code <= 0x07FF) {
            count += 2;
        }
        else if (code <= 0xD7FF) {
            count += 3;
        }
        else if (code <= 0xDFFF) {
            count += 2;
        }
        else {
            count += 3;
        }
    }
    return count;
}
exports.getUtf8BytesCount = getUtf8BytesCount;
