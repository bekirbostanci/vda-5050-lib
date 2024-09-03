/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
import { AgvId, SubscriptionHandler, SubscriptionId } from "..";
/**
 * Manages subscriptions with associated handlers and MQTT topics, and supports
 * efficient lookup of subscription handlers/topics that match the MQTT topic of
 * an inbound message.
 */
export declare class SubscriptionManager {
    private readonly _subscriptions;
    private readonly _subscriptionIds;
    private _constructMqttTopic;
    private _deconstructMqttTopic;
    private _getMqttTopicUtf8Length;
    /**
     * Creates an instance of SubscriptionManager.
     */
    constructor(topicFormat: string, interfaceName: string, protocolVersion: string);
    /**
     * Gets the MQTT topic for the given subject and VDA 5050 communication
     * topic according to the topic format configured in the Client transport
     * options.
     *
     * @param topic a VDA 5050 core or extension communication topic, or
     * undefined for wildcard
     * @param subject (partial) AGV identifier for subscription or publication
     * @returns an MQTT topic
     */
    getMqttTopic(topic: string, subject: Partial<AgvId>): string;
    /**
     * Gets the UTF-8 byte length of the MQTT topic for the given subject and
     * VDA 5050 communication topic according to the topic format configured in
     * the Client transport options.
     *
     * @param topic a VDA 5050 core or extension communication topic, or
     * undefined for wildcard
     * @param subject (partial) AGV identifier for subscription or publication
     * @returns UTF-8 byte length of the MQTT topic
     */
    getMqttTopicUtf8Length(topic: string, subject: Partial<AgvId>): number;
    /**
     * Removes all managed subscriptions.
     */
    clear(): void;
    /**
     * Adds a new subscription handler for the given topic and subject.
     *
     * `undefined` values for topic or subject properties are treated as
     * subscription wildcards.
     *
     * @returns an object with new subscription ID, its related MQTT topic, and
     * a boolean indicating whether the MQTT topic needs to be subscribed.
     * @throws if the related MQTT topic's UTF-8 byte length would exceed its
     * maximum limit of 65535
     */
    add(topic: string, subject: Partial<AgvId>, handler: SubscriptionHandler<string>): {
        id: SubscriptionId;
        mqttTopic: string;
        requiresSubscribe: boolean;
    };
    /**
     * Removes the subscription handler for the given subscription ID.
     *
     * @returns `undefined` if the given ID has already been removed or has not
     * been added; otherwise the MQTT subscription topic and a boolean
     * indicating whether the subscription topic needs to be unsubscribed.
     */
    remove(id: SubscriptionId): {
        mqttTopic: string;
        requiresUnsubscribe: boolean;
    };
    /**
     * Gets all managed MQTT subscription topics.
     *
     * @returns an array of managed MQTT subscription topics
     */
    getAll(): string[];
    /**
     * Finds all subscription handlers of subscriptions that match the given
     * inbound MQTT topic (without wildcards).
     *
     * @remarks If manufacturer and/or serialNumber are not defined as
     * placeholders in the topic format, the given subject (usually computed
     * from inbound VDA 5050 object header information) is used for lookup.
     *
     * @returns a tuple with iterable of matching subscription ID - handler
     * tuples and the VDA 5050 communication topic
     */
    find(mqttTopic: string, subject: AgvId): [
        handlers: Iterable<[SubscriptionId, SubscriptionHandler<string>]>,
        topic: string
    ];
    private _findInternal;
    private _compileMqttTopic;
}
