"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualAgvAdapter = void 0;
const __1 = require("..");
class VirtualAgvAdapter {
    constructor(controller, adapterOptions, debug) {
        this.debug = debug;
        this._controller = controller;
        this._options = this._optionsWithDefaults(adapterOptions);
        this._actionStateMachines = [];
        this.debug("Create instance for apiVersion %d with adapterOptions %o", this.apiVersion, this.options);
    }
    get options() {
        return this._options;
    }
    get controller() {
        return this._controller;
    }
    get name() {
        return "VirtualAgvAdapter";
    }
    get apiVersion() {
        return 2;
    }
    attach(context) {
        if (this._vehicleState === undefined) {
            this._vehicleState = {
                isDriving: false,
                isPaused: false,
                position: { positionInitialized: true, lastNodeId: "0", ...this.options.initialPosition },
                velocity: { omega: 0, vx: 0, vy: 0 },
                batteryState: {
                    batteryCharge: this.options.initialBatteryCharge,
                    batteryVoltage: 24.0,
                    charging: false,
                    reach: this.getBatteryReach(this.options.initialBatteryCharge),
                },
                safetyState: { eStop: __1.EStop.None, fieldViolation: false },
                operatingMode: __1.OperatingMode.Automatic,
                currentLoad: undefined,
            };
        }
        this._tick = 0;
        const tickInterval = 1000 / this.options.tickRate;
        let realTime = Date.now();
        this._tickIntervalId = setInterval(() => {
            const now = Date.now();
            const realInterval = now - realTime;
            realTime = now;
            this._onTick(++this._tick, tickInterval * this.options.timeLapse, realInterval * this.options.timeLapse / 1000);
        }, tickInterval);
        this._controller.updateFactsheet({});
        const { lastNodeId, ...position } = this._vehicleState.position;
        context.attached({
            agvPosition: position,
            lastNodeId,
            velocity: this._vehicleState.velocity,
            batteryState: this._vehicleState.batteryState,
            driving: this._vehicleState.isDriving,
            operatingMode: this._vehicleState.operatingMode,
            paused: this._vehicleState.isPaused,
            safetyState: this._vehicleState.safetyState,
        });
    }
    detach(context) {
        clearInterval(this._tickIntervalId);
        context.detached({});
    }
    executeAction(context) {
        const { action, scope, activeOrderId, stopDriving } = context;
        const actionDef = this._getActionDefinition(action, scope);
        if (actionDef.actionExecutable !== undefined) {
            const errorDescription = actionDef.actionExecutable(action, scope, activeOrderId);
            if (!!errorDescription) {
                context.updateActionStatus({
                    actionStatus: __1.ActionStatus.Failed,
                    errorDescription,
                });
                return;
            }
        }
        if (stopDriving && this._vehicleState.isDriving) {
            this.stopDriving(true);
        }
        const asm = new VirtualActionStateMachine(context, actionDef, () => this._finalizeAction(asm), (formatter, ...args) => this.debug(formatter, ...args), action.actionType === "stopPause" || action.actionType === "startPause" ? false : this._vehicleState.isPaused);
        this._actionStateMachines.push(asm);
    }
    finishEdgeAction(context) {
        const asm = this._actionStateMachines.find(sm => sm.matches(context.action.actionId, context.scope));
        if (asm) {
            asm.terminate();
        }
    }
    cancelAction(context) {
        const asm = this._actionStateMachines.find(sm => sm.matches(context.action.actionId, context.scope));
        if (asm) {
            asm.cancel();
        }
    }
    isActionExecutable(context) {
        var _a, _b;
        const { action, scope } = context;
        const errorRefs = [];
        const actionDef = this._getActionDefinition(action, scope);
        if (!actionDef) {
            errorRefs.push({ referenceKey: __1.AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "not supported" });
        }
        else if (actionDef.actionParameterConstraints !== undefined) {
            const allActionParams = Object.fromEntries((_b = (_a = action.actionParameters) === null || _a === void 0 ? void 0 : _a.map(p => ([p.key, p.value]))) !== null && _b !== void 0 ? _b : []);
            Object.keys(actionDef.actionParameterConstraints).forEach(key => {
                var _a;
                const constraints = actionDef.actionParameterConstraints[key];
                const actionParam = (_a = action.actionParameters) === null || _a === void 0 ? void 0 : _a.find(p => p.key === key);
                if (!constraints(actionParam === null || actionParam === void 0 ? void 0 : actionParam.value, scope, allActionParams)) {
                    errorRefs.push({ referenceKey: "actionParameter", referenceValue: key });
                }
            });
            if (errorRefs.length > 0) {
                errorRefs.push({ referenceKey: __1.AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "invalid actionParameter" });
            }
        }
        return errorRefs;
    }
    isNodeWithinDeviationRange(node) {
        const errorRefs = [];
        if (!node.nodePosition) {
            return errorRefs;
        }
        const { allowedDeviationTheta, allowedDeviationXy, mapId, theta, x, y } = node.nodePosition;
        const { mapId: agvMapId, theta: agvTheta, x: agvX, y: agvY } = this._vehicleState.position;
        if (mapId !== agvMapId) {
            errorRefs.push({ referenceKey: "nodeId", referenceValue: node.nodeId });
            errorRefs.push({ referenceKey: "nodePosition.mapId", referenceValue: agvMapId });
        }
        const allowedXy = allowedDeviationXy || this.options.agvNormalDeviationXyTolerance;
        if ((agvX - x) ** 2 + (agvY - y) ** 2 > allowedXy ** 2) {
            errorRefs.push({ referenceKey: "nodePosition.allowedDeviationXy", referenceValue: allowedXy.toString() });
        }
        if (theta === undefined) {
            return errorRefs;
        }
        const allowedTheta = allowedDeviationTheta || this.options.agvNormalDeviationThetaTolerance;
        if (Math.abs(agvTheta - theta) > allowedTheta) {
            errorRefs.push({ referenceKey: "nodePosition.allowedDeviationTheta", referenceValue: allowedTheta.toString() });
        }
        return errorRefs;
    }
    isRouteTraversable(context) {
        const errorRefs = [];
        for (let i = 0; i < context.nodes.length; i++) {
            const node = context.nodes[i];
            if (node.nodePosition === undefined && i > 0) {
                errorRefs.push({ referenceKey: __1.AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "missing nodePosition" }, { referenceKey: "nodeId", referenceValue: node.nodeId }, { referenceKey: "nodePosition", referenceValue: "undefined" });
                break;
            }
        }
        return errorRefs;
    }
    traverseEdge(context) {
        this._traverseContext = context;
    }
    stopTraverse(context) {
        this._traverseContext = undefined;
        this._vehicleState.isDriving && this.stopDriving(true);
        this._vehicleState.isPaused && this._stopPause();
        context.stopped();
    }
    get vehicleState() {
        return this._vehicleState;
    }
    get actionDefinitions() {
        return [
            {
                actionType: "noop",
                actionScopes: ["instant", "node", "edge"],
                actionParameterConstraints: {
                    duration: (value) => value === undefined || typeof value === "number",
                },
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Running },
                    ON_CANCEL: {},
                    [__1.ActionStatus.Running]: { durationTime: ["duration", 5], next: __1.ActionStatus.Finished },
                    [__1.ActionStatus.Finished]: {
                        resultDescription: () => "noop action finished",
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "noop action failed",
                    },
                },
            },
            {
                actionType: "pick",
                actionScopes: "node",
                actionParameterConstraints: {
                    stationType: (value) => value && value.startsWith("floor"),
                    loadType: (value) => value === "EPAL",
                    duration: (value) => value === undefined || typeof value === "number",
                },
                actionExecutable: () => this._vehicleState.currentLoad ? "load already picked" : "",
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Initializing },
                    ON_CANCEL: {},
                    [__1.ActionStatus.Initializing]: { durationTime: 1, next: __1.ActionStatus.Running },
                    [__1.ActionStatus.Running]: { durationTime: ["duration", 5], next: __1.ActionStatus.Finished },
                    [__1.ActionStatus.Finished]: {
                        resultDescription: () => "pick action finished",
                        linkedState: () => this._loadAdded(),
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "pick action failed",
                    },
                },
            },
            {
                actionType: "drop",
                actionScopes: "node",
                actionParameterConstraints: {
                    stationType: (value) => value && value.startsWith("floor"),
                    loadType: (value) => value === "EPAL",
                    duration: (value) => value === undefined || typeof value === "number",
                },
                actionExecutable: () => this._vehicleState.currentLoad ? "" : "no load to drop",
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Initializing },
                    ON_CANCEL: {},
                    [__1.ActionStatus.Initializing]: { durationTime: 1, next: __1.ActionStatus.Running },
                    [__1.ActionStatus.Running]: { durationTime: ["duration", 5], next: __1.ActionStatus.Finished },
                    [__1.ActionStatus.Finished]: {
                        resultDescription: () => "drop action finished",
                        linkedState: () => this._loadRemoved(),
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "drop action failed",
                    },
                },
            },
            {
                actionType: "initPosition",
                actionScopes: ["instant", "node"],
                actionParameterConstraints: {
                    x: (value) => typeof value === "number",
                    y: (value) => typeof value === "number",
                    theta: (value) => typeof value === "number",
                    mapId: (value) => typeof value === "string",
                    lastNodeId: (value) => typeof value === "string",
                    lastNodeSequenceId: (value) => value === undefined ? true : typeof value === "number",
                },
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Finished },
                    ON_CANCEL: {},
                    [__1.ActionStatus.Finished]: {
                        resultDescription: () => "Position initialized",
                        linkedState: context => this._initPosition(context.action),
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "initPosition action failed",
                    },
                },
            },
            {
                actionType: "startPause",
                actionScopes: "instant",
                actionExecutable: () => this._vehicleState.isPaused ? "already paused" : "",
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Finished },
                    [__1.ActionStatus.Finished]: {
                        resultDescription: () => "Paused",
                        linkedState: context => this._startPause(context),
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "startPause action failed",
                    },
                },
            },
            {
                actionType: "stopPause",
                actionScopes: "instant",
                actionExecutable: () => this._vehicleState.isPaused ? "" : "not yet paused",
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Finished },
                    [__1.ActionStatus.Finished]: {
                        resultDescription: () => "Unpaused",
                        linkedState: context => this._stopPause(context),
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "stopPause action failed",
                    },
                },
            },
            {
                actionType: "startCharging",
                actionScopes: ["instant", "node"],
                actionParameterConstraints: {
                    duration: (value) => value === undefined || typeof value === "number",
                },
                actionExecutable: (action, scope, activeOrderId) => this._vehicleState.batteryState.charging ?
                    "charging already in progress" :
                    activeOrderId && scope === "instant" ? "charging denied as order is in progress" : "",
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Running },
                    ON_CANCEL: {},
                    [__1.ActionStatus.Running]: { durationTime: ["duration", 1], next: __1.ActionStatus.Finished },
                    [__1.ActionStatus.Finished]: {
                        resultDescription: () => "Started charging",
                        linkedState: () => this._startCharging(),
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "startCharging action failed",
                    },
                },
            },
            {
                actionType: "stopCharging",
                actionScopes: ["instant", "node"],
                actionParameterConstraints: {
                    duration: (value) => value === undefined || typeof value === "number",
                },
                actionExecutable: () => this._vehicleState.batteryState.charging ? "" : "charging not in progress",
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Running },
                    ON_CANCEL: {},
                    [__1.ActionStatus.Running]: { durationTime: ["duration", 1], next: __1.ActionStatus.Finished },
                    [__1.ActionStatus.Finished]: {
                        resultDescription: () => "Stopped charging",
                        linkedState: () => this._stopCharging(),
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "startCharging action failed",
                    },
                },
            },
            {
                actionType: "orderExecutionTime",
                actionScopes: "instant",
                actionParameterConstraints: {
                    orders: (value) => Array.isArray(value),
                },
                transitions: {
                    ON_INIT: { next: __1.ActionStatus.Finished },
                    [__1.ActionStatus.Finished]: {
                        resultDescription: context => this._calculateEstimatedOrderExecutionTimes(context.action),
                    },
                    [__1.ActionStatus.Failed]: {
                        errorDescription: () => "orderExecutionTime action failed",
                    },
                },
            },
        ];
    }
    startDriving(vx, vy, reportImmediately = false) {
        this._vehicleState.isDriving = true;
        this._vehicleState.velocity.vx = vx;
        this._vehicleState.velocity.vy = vy;
        this.controller.updateDrivingState(true);
        this.controller.updateAgvPositionVelocity(undefined, this._vehicleState.velocity, reportImmediately);
        this.debug("start driving vx=%d, vy=%d", vx, vy);
    }
    stopDriving(reportImmediately = false) {
        this._vehicleState.isDriving = false;
        this._vehicleState.velocity.vx = 0;
        this._vehicleState.velocity.vy = 0;
        this.controller.updateDrivingState(false);
        this.controller.updateAgvPositionVelocity(undefined, this._vehicleState.velocity, reportImmediately);
        this.debug("stop driving");
    }
    getNodeActionDuration(action) {
        const actionDef = this._getActionDefinition(action, "node");
        let duration = 0;
        let state = actionDef.transitions.ON_INIT.next;
        while (state !== __1.ActionStatus.Finished && state !== __1.ActionStatus.Failed) {
            const transition = actionDef.transitions[state];
            const transitionDuration = getTransitionDuration(transition, action);
            if (transitionDuration !== undefined) {
                duration += transitionDuration;
            }
            state = transition.next;
        }
        return duration;
    }
    getTargetSpeed(useMean = false, distance, maxSpeed) {
        if (this.options.vehicleSpeedDistribution) {
            return this.options.vehicleSpeedDistribution()[useMean ? 1 : 0];
        }
        else if (this.options.vehicleTimeDistribution) {
            return distance / this.options.vehicleTimeDistribution()[useMean ? 1 : 0];
        }
        else {
            return maxSpeed === undefined ? this.options.vehicleSpeed : Math.min(maxSpeed, this.options.vehicleSpeed);
        }
    }
    canExecuteOrder(nodes, edges) {
        let errorRefs = this.isRouteTraversable({ nodes, edges });
        if (errorRefs && errorRefs.length > 0) {
            return false;
        }
        for (const node of nodes) {
            for (const action of node.actions) {
                const context = {
                    action,
                    scope: "node",
                    updateActionStatus: undefined,
                    node,
                };
                errorRefs = this.isActionExecutable(context);
                if (errorRefs && errorRefs.length > 0) {
                    return false;
                }
            }
        }
        return true;
    }
    updateBatteryState(dx, dy) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const { batteryCharge } = this._vehicleState.batteryState;
        this._vehicleState.batteryState.batteryCharge = Math.max(0, batteryCharge - (dist * 100 / this.options.batteryMaxReach));
        this._vehicleState.batteryState.reach = this.getBatteryReach(this._vehicleState.batteryState.batteryCharge);
        this.controller.updateBatteryState(this._vehicleState.batteryState);
    }
    getBatteryReach(charge) {
        return Math.floor(this.options.batteryMaxReach * charge / 100);
    }
    _optionsWithDefaults(options) {
        const optionalDefaults = {
            initialPosition: { mapId: "local", x: 0, y: 0, theta: 0, lastNodeId: "0" },
            agvNormalDeviationXyTolerance: 0.5,
            agvNormalDeviationThetaTolerance: 0.349066,
            vehicleSpeed: 2,
            vehicleSpeedDistribution: undefined,
            vehicleTimeDistribution: undefined,
            batteryMaxReach: 28800,
            initialBatteryCharge: 100,
            fullBatteryChargeTime: 1,
            lowBatteryChargeThreshold: 1,
            tickRate: 5,
            timeLapse: 1,
        };
        return Object.assign(optionalDefaults, options);
    }
    _getActionDefinition(action, scope) {
        return this.actionDefinitions.find(d => d.actionType === action.actionType &&
            (d.actionScopes === scope || d.actionScopes.includes(scope)));
    }
    _finalizeAction(asm) {
        this._actionStateMachines.splice(this._actionStateMachines.indexOf(asm), 1);
    }
    _onTick(tick, tickInterval, realInterval) {
        for (const asm of this._actionStateMachines) {
            asm.tick(tick, tickInterval, realInterval);
        }
        this._advanceTraverse(realInterval);
        this._advanceBatteryCharge(tick, tickInterval, realInterval);
    }
    _advanceTraverse(realInterval) {
        var _a, _b;
        if (!this._traverseContext || this._vehicleState.isPaused || this._vehicleState.batteryState.charging) {
            return;
        }
        const traverseContext = this._traverseContext;
        const endNodePosition = traverseContext.endNode.nodePosition;
        const tx = endNodePosition.x - this._vehicleState.position.x;
        const ty = endNodePosition.y - this._vehicleState.position.y;
        const alpha = Math.atan2(ty, tx);
        if (!this._vehicleState.isDriving) {
            if (this._vehicleState.batteryState.batteryCharge < this.options.lowBatteryChargeThreshold) {
                return;
            }
            const targetDistance = Math.sqrt(tx ** 2 + ty ** 2);
            const targetSpeed = this.getTargetSpeed(false, targetDistance, traverseContext.edge.maxSpeed);
            this.startDriving(Math.cos(alpha) * targetSpeed, Math.sin(alpha) * targetSpeed, true);
        }
        else {
            const dx = this._vehicleState.velocity.vx * realInterval;
            const dy = this._vehicleState.velocity.vy * realInterval;
            if (tx ** 2 + ty ** 2 <= dx ** 2 + dy ** 2) {
                this._vehicleState.position.x = endNodePosition.x;
                this._vehicleState.position.y = endNodePosition.y;
                this._vehicleState.position.theta = (_a = endNodePosition.theta) !== null && _a !== void 0 ? _a : this._vehicleState.position.theta;
                this.updateBatteryState(tx, ty);
                const { lastNodeId: _, ...position } = this._vehicleState.position;
                this.controller.updateAgvPositionVelocity(position);
                this.stopDriving(true);
                this._traverseContext = undefined;
                traverseContext.edgeTraversed();
            }
            else {
                const isBatteryLow = this._vehicleState.batteryState.batteryCharge < this.options.lowBatteryChargeThreshold;
                this._vehicleState.position.x += dx;
                this._vehicleState.position.y += dy;
                this._vehicleState.position.theta = (_b = traverseContext.edge.orientation) !== null && _b !== void 0 ? _b : alpha;
                this.updateBatteryState(dx, dy);
                const { lastNodeId: _, ...position } = this._vehicleState.position;
                this.controller.updateAgvPositionVelocity(position);
                if (isBatteryLow) {
                    this.debug("low battery charge %d", this._vehicleState.batteryState.batteryCharge);
                    this.stopDriving();
                    this._batteryLowError = {
                        errorDescription: "stop driving due to low battery",
                        errorLevel: __1.ErrorLevel.Fatal,
                        errorType: "batteryLowError",
                        errorReferences: [
                            {
                                referenceKey: "batteryState.batteryCharge",
                                referenceValue: this._vehicleState.batteryState.batteryCharge.toString(),
                            },
                        ],
                    };
                    this.controller.updateErrors(this._batteryLowError, "add", true);
                }
            }
        }
    }
    _advanceBatteryCharge(tick, tickInterval, realInterval) {
        if (!this._vehicleState.batteryState.charging || this._vehicleState.isPaused) {
            return;
        }
        const chargeRate = 100 / 3600 / this.options.fullBatteryChargeTime;
        const currentCharge = this._vehicleState.batteryState.batteryCharge;
        const deltaCharge = chargeRate * realInterval;
        const newCharge = Math.min(100, currentCharge + deltaCharge);
        const isFullyCharged = newCharge === 100;
        this._vehicleState.batteryState.batteryCharge = newCharge;
        this._vehicleState.batteryState.reach = this.getBatteryReach(newCharge);
        this.controller.updateBatteryState(this._vehicleState.batteryState, false);
        let batteryLowError;
        if (this._batteryLowError && this._vehicleState.batteryState.batteryCharge >= this.options.lowBatteryChargeThreshold + 10) {
            batteryLowError = this._batteryLowError;
            this._batteryLowError = undefined;
        }
        const updateTicks = Math.ceil(1000 / chargeRate / tickInterval);
        if (tick % updateTicks === 0) {
            batteryLowError && this.controller.updateErrors(batteryLowError, "remove");
            this.controller.updateBatteryState(this._vehicleState.batteryState, !isFullyCharged);
        }
        if (isFullyCharged) {
            this.controller.updatePartialState(this._stopCharging(), true);
        }
    }
    _loadAdded() {
        this._vehicleState.currentLoad = {
            loadId: "RFID_" + this.controller.createUuid(),
            loadType: "EPAL",
            loadDimensions: { width: 1, height: 1, length: 1 },
            weight: 10 + 10 * Math.random(),
        };
        this.debug("picked load", this._vehicleState.currentLoad);
        return {
            loads: [this._vehicleState.currentLoad],
        };
    }
    _loadRemoved() {
        this.debug("dropped load", this._vehicleState.currentLoad);
        this._vehicleState.currentLoad = undefined;
        return {
            loads: [],
        };
    }
    _initPosition(action) {
        var _a;
        this._vehicleState.position.x = action.actionParameters.find(p => p.key === "x").value;
        this._vehicleState.position.y = action.actionParameters.find(p => p.key === "y").value;
        this._vehicleState.position.theta = action.actionParameters.find(p => p.key === "theta").value;
        this._vehicleState.position.mapId = action.actionParameters.find(p => p.key === "mapId").value;
        this._vehicleState.position.lastNodeId = action.actionParameters.find(p => p.key === "lastNodeId").value;
        const lastNodeSequenceId = (_a = action.actionParameters.find(p => p.key === "lastNodeSequenceId")) === null || _a === void 0 ? void 0 : _a.value;
        const { lastNodeId, ...position } = this._vehicleState.position;
        this.debug("init position %o with lastNodeId %s and lastNodeSequenceId %d", position, lastNodeId, lastNodeSequenceId);
        return {
            agvPosition: position,
            lastNodeId,
            lastNodeSequenceId: lastNodeSequenceId !== null && lastNodeSequenceId !== void 0 ? lastNodeSequenceId : 0,
        };
    }
    _startPause(context) {
        if (this._vehicleState.isPaused) {
            return undefined;
        }
        if (this._vehicleState.isDriving) {
            this.stopDriving();
        }
        this.debug("start pause");
        this._vehicleState.isPaused = true;
        for (const asm of this._actionStateMachines) {
            if (asm.actionContext !== context) {
                asm.pause();
            }
        }
        return { paused: true };
    }
    _stopPause(context) {
        if (!this._vehicleState.isPaused) {
            return undefined;
        }
        this.debug("stop pause");
        this._vehicleState.isPaused = false;
        if (context !== undefined) {
            for (const asm of this._actionStateMachines) {
                if (asm.actionContext !== context) {
                    asm.unpause();
                }
            }
            return { paused: false };
        }
        else {
            this.controller.updatePausedState(false, true);
        }
    }
    _startCharging() {
        if (this._vehicleState.batteryState.charging) {
            return undefined;
        }
        if (this._vehicleState.isDriving) {
            this.stopDriving();
        }
        this.debug("start charging");
        this._vehicleState.batteryState.charging = true;
        return { batteryState: this._vehicleState.batteryState };
    }
    _stopCharging() {
        if (!this._vehicleState.batteryState.charging) {
            return undefined;
        }
        this.debug("stop charging");
        this._vehicleState.batteryState.charging = false;
        return { batteryState: this._vehicleState.batteryState };
    }
    _calculateEstimatedOrderExecutionTimes(action) {
        const orders = action.actionParameters.find(p => p.key === "orders").value;
        const results = [];
        let currentNodePosition = this._vehicleState.position;
        try {
            for (const order of orders) {
                if (!this.canExecuteOrder(order.nodes, order.edges)) {
                    throw new Error("order is not executable");
                }
                results.push(this._calculateEstimatedOrderExecutionTime(order, currentNodePosition).toString());
                currentNodePosition = order.nodes[order.nodes.length - 1].nodePosition;
            }
        }
        catch {
            results.splice(0, results.length);
        }
        this.debug("calculated estimated order execution times: %o", results);
        return results.join(",");
    }
    _calculateEstimatedOrderExecutionTime(order, currentNodePosition) {
        var _a;
        let effectiveActionDuration = 0;
        for (const node of order.nodes) {
            let nonHardMaxDuration = 0;
            for (const action of node.actions) {
                if (action.blockingType === __1.BlockingType.Hard) {
                    effectiveActionDuration += nonHardMaxDuration;
                    effectiveActionDuration += this.getNodeActionDuration(action);
                    nonHardMaxDuration = 0;
                }
                else {
                    nonHardMaxDuration = Math.max(nonHardMaxDuration, this.getNodeActionDuration(action));
                }
            }
        }
        let edgeTraversalTime = 0;
        for (const edge of order.edges) {
            const startNode = order.nodes.find(n => n.nodeId === edge.startNodeId && n.sequenceId === edge.sequenceId - 1);
            const endNode = order.nodes.find(n => n.nodeId === edge.endNodeId && n.sequenceId === edge.sequenceId + 1);
            const startNodePosition = (_a = startNode.nodePosition) !== null && _a !== void 0 ? _a : currentNodePosition;
            const distance = Math.sqrt((endNode.nodePosition.x - startNodePosition.x) ** 2 +
                (endNode.nodePosition.y - startNodePosition.y) ** 2);
            edgeTraversalTime += (distance / this.getTargetSpeed(true, distance, edge.maxSpeed));
        }
        return edgeTraversalTime + effectiveActionDuration;
    }
}
exports.VirtualAgvAdapter = VirtualAgvAdapter;
function getTransitionDuration(transition, action) {
    var _a;
    if ("durationTime" in transition) {
        if (typeof transition.durationTime === "number") {
            return transition.durationTime;
        }
        if (Array.isArray(transition.durationTime) &&
            typeof transition.durationTime[0] === "string" &&
            typeof transition.durationTime[1] === "number") {
            const param = transition.durationTime[0];
            const kv = (_a = action.actionParameters) === null || _a === void 0 ? void 0 : _a.find(p => p.key === param);
            if (kv !== undefined) {
                return kv.value;
            }
            return transition.durationTime[1];
        }
    }
    return undefined;
}
class VirtualActionStateMachine {
    constructor(actionContext, actionDefinition, _finalizeAction, _debug, _shouldPause) {
        this.actionContext = actionContext;
        this.actionDefinition = actionDefinition;
        this._finalizeAction = _finalizeAction;
        this._debug = _debug;
        this._shouldPause = _shouldPause;
        this._actionStatus = undefined;
        this._actionStatusOnPause = undefined;
        this._shouldTerminate = false;
        this._shouldCancel = false;
        this._statusDurationTimes = new Map(Object.keys(actionDefinition.transitions).map((s) => [s, 0]));
    }
    matches(actionId, scope) {
        return this.actionContext.action.actionId === actionId &&
            this.actionContext.scope === scope;
    }
    tick(tick, tickInterval, realInterval) {
        if (this._shouldTerminate === undefined || this._shouldCancel === undefined) {
            return;
        }
        if (this._shouldPause && this._actionStatus !== __1.ActionStatus.Paused) {
            this._actionStatusOnPause = this._actionStatus || this.actionDefinition.transitions.ON_INIT.next;
            this._transition({ actionStatus: __1.ActionStatus.Paused });
            return;
        }
        if (!this._shouldPause && this._actionStatus === __1.ActionStatus.Paused) {
            const resumedStatus = this._actionStatusOnPause;
            this._actionStatusOnPause = undefined;
            this._transition({ actionStatus: resumedStatus });
            return;
        }
        if (this._actionStatus === undefined) {
            this._transition({ actionStatus: this.actionDefinition.transitions.ON_INIT.next });
            return;
        }
        if (this._shouldCancel === true && this.actionDefinition.transitions.ON_CANCEL) {
            const { linkedState: ls } = this.actionDefinition.transitions.ON_CANCEL;
            this._transition({
                actionStatus: __1.ActionStatus.Failed,
                linkedState: ls ? ls(this.actionContext) : undefined,
            });
            return;
        }
        if (this._shouldTerminate === true) {
            const { next: nxt, linkedState: ls } = this.actionDefinition.transitions.ON_TERMINATE;
            this._transition({
                actionStatus: nxt,
                linkedState: ls ? ls(this.actionContext) : undefined,
            });
            return;
        }
        if (this._actionStatus === __1.ActionStatus.Paused) {
            return;
        }
        const actionStatusDef = this.actionDefinition.transitions[this._actionStatus];
        let duration = this._statusDurationTimes.get(this._actionStatus);
        duration += realInterval;
        const transitionDuration = getTransitionDuration(actionStatusDef, this.actionContext.action);
        if (transitionDuration !== undefined && duration >= transitionDuration) {
            this._statusDurationTimes.set(this._actionStatus, 0);
            this._transition({ actionStatus: actionStatusDef.next });
        }
        else {
            this._statusDurationTimes.set(this._actionStatus, duration);
        }
    }
    terminate() {
        if (this.actionContext.scope !== "edge" || this._shouldTerminate !== false) {
            return;
        }
        this._debug("should terminate action %o", this.actionContext);
        this._shouldTerminate = true;
    }
    cancel() {
        if (this.actionContext.scope === "instant" || this._shouldCancel !== false || !this.actionDefinition.transitions.ON_CANCEL) {
            return;
        }
        this._debug("should cancel action %o", this.actionContext);
        this._shouldCancel = true;
    }
    pause() {
        this._debug("should pause action %o", this.actionContext);
        this._shouldPause = true;
    }
    unpause() {
        this._debug("should unpause action %o", this.actionContext);
        this._shouldPause = false;
    }
    _transition(change) {
        var _a;
        this._actionStatus = change.actionStatus;
        if (this._actionStatus === __1.ActionStatus.Finished || this._actionStatus === __1.ActionStatus.Failed) {
            this._shouldTerminate = undefined;
            this._shouldCancel = undefined;
            this._shouldPause = false;
            this._finalizeAction();
        }
        const { linkedState, resultDescription, errorDescription } = (_a = this.actionDefinition.transitions[this._actionStatus]) !== null && _a !== void 0 ? _a : {};
        change = {
            actionStatus: this._actionStatus,
            linkedState: Object.assign({}, change.linkedState, linkedState ? linkedState(this.actionContext) : undefined),
            resultDescription: resultDescription ? resultDescription(this.actionContext) : undefined,
            errorDescription: errorDescription ? errorDescription(this.actionContext) : undefined,
        };
        this._debug("transition action %o to status %o", this.actionContext, change);
        this.actionContext.updateActionStatus(change);
    }
}
