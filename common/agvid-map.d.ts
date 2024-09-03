/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
import { AgvId } from "..";
/**
 * Maps AGV identifiers to values of a given value type.
 *
 * An AgvIdMap object iterates its elements in insertion order; a for-of loop
 * returns an array of [agvId, value] for each iteration.
 *
 * @category Common
 */
export declare class AgvIdMap<T> {
    private readonly _map;
    /**
     * Gets the number of AgvId - value associations.
     *
     * @returns total number of values in the map
     */
    get size(): number;
    /**
     * Gets the value associated with the given AGV identifier.
     *
     * @param agvId an AGV identifier
     * @returns associated value or `undefined` if not existing
     */
    get(agvId: AgvId): T;
    /**
     * Associates the given value with the given AGV identifier.
     *
     * @param agvId an AGV identifier
     * @param value value to be associated
     */
    set(agvId: AgvId, value: T): void;
    /**
     * Deletes the value associated with the given AGV identifier.
     *
     * @param agvId an AGV identifier
     */
    delete(agvId: AgvId): void;
    /**
     * Clears all values of the AGV map.
     */
    clear(): void;
    [Symbol.iterator](): Generator<[AgvId, T], void, unknown>;
}
