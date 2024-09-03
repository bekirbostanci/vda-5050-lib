"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgvIdMap = void 0;
class AgvIdMap {
    constructor() {
        this._map = new Map();
    }
    get size() {
        let size = 0;
        this._map.forEach(map => size += map.size);
        return size;
    }
    get(agvId) {
        const map = this._map.get(agvId.manufacturer);
        if (!map) {
            return undefined;
        }
        return map.get(agvId.serialNumber);
    }
    set(agvId, value) {
        let map = this._map.get(agvId.manufacturer);
        if (!map) {
            map = new Map();
            this._map.set(agvId.manufacturer, map);
        }
        map.set(agvId.serialNumber, value);
    }
    delete(agvId) {
        const map = this._map.get(agvId.manufacturer);
        if (!map) {
            return;
        }
        map.delete(agvId.serialNumber);
        if (map.size === 0) {
            this._map.delete(agvId.manufacturer);
        }
    }
    clear() {
        this._map.clear();
    }
    *[Symbol.iterator]() {
        for (const [manufacturer, map] of this._map) {
            for (const [serialNumber, value] of map) {
                yield [{ manufacturer, serialNumber }, value];
            }
        }
    }
}
exports.AgvIdMap = AgvIdMap;
