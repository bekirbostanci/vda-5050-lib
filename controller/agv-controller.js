"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgvController = void 0;
const __1 = require("..");
class AgvController extends __1.AgvClient {
    constructor(agvId, clientOptions, controllerOptions, adapterOptions) {
        var _a;
        super(agvId, {
            ...clientOptions,
            topicObjectValidation: { inbound: false, outbound: (_a = clientOptions.topicObjectValidation) === null || _a === void 0 ? void 0 : _a.outbound },
        });
        this.agvId = agvId;
        this._controllerOptions = this._controllerOptionsWithDefaults(controllerOptions);
        this._currentInstantActions = [];
        this._instantActionsEndedPublishCount = new Map();
        this._instantActionsErroredPublishCount = new Map();
        this.currentOrder = undefined;
        this._cancelOrderContext = undefined;
        this._currentState = {
            actionStates: [],
            batteryState: { batteryCharge: 0.8, charging: false },
            driving: false,
            edgeStates: [],
            errors: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: __1.OperatingMode.Manual,
            orderId: "",
            orderUpdateId: 0,
            safetyState: { eStop: __1.EStop.None, fieldViolation: false },
        };
        this._agvAdapter = new this.controllerOptions.agvAdapterType(this, adapterOptions, this.debug.extend(this.controllerOptions.agvAdapterType.name));
        this._currentFactsheet = {};
        if (this._agvAdapter.apiVersion !== this.adapterApiVersion) {
            throw new Error(`${this._agvAdapter.name}@${this._agvAdapter.apiVersion} not compatible with adapter protocol ${this.adapterApiVersion} used by ${this.constructor.name}`);
        }
        this.debug("Created instance with controllerOptions %o", this.controllerOptions);
    }
    get controllerOptions() {
        return this._controllerOptions;
    }
    get adapterApiVersion() {
        return 2;
    }
    get currentState() {
        return this._cloneState(this._currentState);
    }
    get hasActiveOrder() {
        return this._currentState.nodeStates.length > 0 ||
            this._currentState.edgeStates.length > 0 ||
            this._currentState.actionStates.some(s => !this.isInstantActionState(s) &&
                s.actionStatus !== __1.ActionStatus.Failed &&
                s.actionStatus !== __1.ActionStatus.Finished);
    }
    get hasCancelingOrder() {
        return this._cancelOrderContext !== undefined;
    }
    isInstantActionState(state) {
        return this._instantActionsEndedPublishCount.has(state.actionId);
    }
    updateAgvPositionVelocity(agvPosition, velocity, reportImmediately = false) {
        this._updateState(this._cloneState({ agvPosition, velocity }), reportImmediately);
    }
    updateBatteryState(batteryState, reportImmediately = false) {
        this._updateState(this._cloneState({ batteryState }), reportImmediately);
    }
    updateDrivingState(driving, reportImmediately = false) {
        this._updateState(this._cloneState({ driving }), reportImmediately);
    }
    updatePausedState(paused, reportImmediately = false) {
        this._updateState(this._cloneState({ paused }), reportImmediately);
    }
    updateNewBaseRequest(newBaseRequest, reportImmediately = true) {
        this._updateState(this._cloneState({ newBaseRequest }), reportImmediately);
    }
    updateSafetyStatus(safetyStatus, reportImmediately = true) {
        this._updateState(this._cloneState({ safetyState: safetyStatus }), reportImmediately);
    }
    updateOperatingMode(operatingMode, reportImmediately = true) {
        this._updateState(this._cloneState({ operatingMode }), reportImmediately);
    }
    updateFactsheet(factsheet) {
        const f = factsheet === undefined ? {} : JSON.parse(JSON.stringify(factsheet));
        this._currentFactsheet = f;
    }
    updateErrors(error, mode, reportImmediately = false) {
        const index = this._findErrorIndex(error);
        let newErrors;
        if (index !== -1) {
            if (mode === "add") {
                return;
            }
            newErrors = [...this._currentState.errors];
            newErrors.splice(index, 1);
        }
        else {
            if (mode === "remove") {
                return;
            }
            newErrors = [...this._currentState.errors, error];
        }
        this._updateState(this._cloneState({ errors: newErrors }), reportImmediately);
    }
    updatePartialState(newState, reportImmediately = false) {
        this._updateState(this._cloneState(newState), reportImmediately);
    }
    async onStarted() {
        await super.onStarted();
        this._attachAdapter();
    }
    async onStopping() {
        await this._detachAdapter();
        await super.onStopping();
    }
    onStateChanged(changes) {
    }
    executeInstantAction(context) {
        this.debug("Invoking instant executeAction handler with context %o", context);
        this._agvAdapter.executeAction(context);
    }
    _controllerOptionsWithDefaults(options) {
        const optionalDefaults = {
            publishStateInterval: 30000,
            publishVisualizationInterval: 1000,
            finalInstantActionStateChangePublishCount: 5,
        };
        const opts = Object.assign(optionalDefaults, options);
        opts.finalInstantActionStateChangePublishCount = Math.max(1, opts.finalInstantActionStateChangePublishCount);
        return opts;
    }
    _attachAdapter() {
        this.debug("Invoking attach handler");
        this._agvAdapter.attach({
            attached: async (initialState) => {
                this.updatePartialState(initialState, false);
                await this._subscribeOnStarted();
                this._publishCurrentState();
            },
        });
    }
    _detachAdapter() {
        return new Promise(resolve => {
            this.debug("Invoking detach handler");
            this._agvAdapter.detach({
                detached: detachState => {
                    this.updatePartialState(detachState, true);
                    clearTimeout(this._publishStateTimerId);
                    clearInterval(this._publishVisualizationIntervalId);
                    resolve();
                },
            });
        });
    }
    async _subscribeOnStarted() {
        await this.subscribe(__1.Topic.Order, order => this._processOrder(order));
        await this.subscribe(__1.Topic.InstantActions, actions => this._processInstantActions(actions));
        this.registerConnectionStateChange((currentState, prevState) => {
            if (currentState === "online" && prevState !== "online") {
                this._publishCurrentState();
            }
        });
        this._setupPublishVisualizationInterval();
    }
    _resetPublishStateTimer() {
        clearTimeout(this._publishStateTimerId);
        this._publishStateTimerId = setTimeout(() => this._publishCurrentState(), this.controllerOptions.publishStateInterval);
    }
    _setupPublishVisualizationInterval() {
        clearInterval(this._publishVisualizationIntervalId);
        if (this.controllerOptions.publishVisualizationInterval <= 0) {
            return;
        }
        this._publishVisualizationIntervalId = setInterval(() => this._publishVisualization(), this.controllerOptions.publishVisualizationInterval);
    }
    async _publishVisualization() {
        try {
            const vis = {};
            if (this._currentState.agvPosition !== undefined) {
                vis.agvPosition = this._currentState.agvPosition;
            }
            if (this._currentState.velocity !== undefined) {
                vis.velocity = this._currentState.velocity;
            }
            await this.publish(__1.Topic.Visualization, vis, { dropIfOffline: true });
        }
        catch (error) {
            this.debug("Couldn't publish visualization: %s", error);
        }
    }
    async _publishCurrentState() {
        this._resetPublishStateTimer();
        const publishedState = await this.publish(__1.Topic.State, this._currentState, { dropIfOffline: true });
        if (publishedState !== undefined) {
            delete this._currentState.timestamp;
            this._cleanupInstantActionStates();
        }
    }
    async _publishFactsheet(context) {
        await this.publish(__1.Topic.Factsheet, this._currentFactsheet, { dropIfOffline: true, retainMessage: true });
        context.updateActionStatus({
            actionStatus: __1.ActionStatus.Finished,
            resultDescription: "Reported new factsheet",
        });
    }
    _updateState(newPartialState, publishImmediately = false) {
        this._mergeState(newPartialState);
        if (publishImmediately) {
            this._publishCurrentState();
        }
        this.onStateChanged(newPartialState);
    }
    _mergeState(newPartialState) {
        for (const [key, value] of Object.entries(newPartialState)) {
            if (value !== undefined) {
                this._currentState[key] = value;
            }
            else {
                delete this._currentState[key];
            }
        }
        if (!newPartialState.timestamp) {
            delete this._currentState.timestamp;
        }
    }
    _cloneState(state) {
        return state === undefined ? {} : JSON.parse(JSON.stringify(state));
    }
    _findErrorIndex(error) {
        return this._currentState.errors.findIndex(e => e.errorDescription === error.errorDescription &&
            e.errorLevel === error.errorLevel &&
            e.errorType === error.errorType &&
            this._areErrorReferencesEqual(e.errorReferences, error.errorReferences));
    }
    _areErrorReferencesEqual(refs1, refs2) {
        if (refs1.length !== refs2.length) {
            return false;
        }
        for (const { referenceKey, referenceValue } of refs1) {
            if (!refs2.find(r => r.referenceKey === referenceKey && r.referenceValue === referenceValue)) {
                return false;
            }
        }
        return true;
    }
    _processOrder(order) {
        var _a;
        this.debug("Processing order %o", order);
        try {
            this.validateTopicObject(__1.Topic.Order, order, this.clientOptions.vdaVersion);
            this._validateOrderConstraints(order);
        }
        catch (err) {
            const error = this._createOrderError(order, __1.ErrorType.OrderValidation, `invalid order: ${err}`);
            this.debug("Invalid order: %j", error);
            this._rejectOrder(error);
            return;
        }
        if (this.hasCancelingOrder) {
            const error = this._createOrderError(order, __1.ErrorType.Order, "active order is being canceled");
            this.debug("Order rejected as an active order is being canceled: %j", error);
            this._rejectOrder(error);
            return;
        }
        if (!this._checkRouteTraversable(order)) {
            return;
        }
        if (!this._checkOrderActionsExecutable(order)) {
            return;
        }
        if (this._currentState.batteryState.charging) {
            const error = this._createOrderError(order, __1.ErrorType.Order, "order is not executable while charging", { referenceKey: "batteryState.charging", referenceValue: "true" });
            this.debug("Order rejected as charging is in progress: %j", error);
            this._rejectOrder(error);
            return;
        }
        if (this._currentState.safetyState.eStop !== __1.EStop.None) {
            const error = this._createOrderError(order, __1.ErrorType.Order, "order is not executable as emergency stop is active", { referenceKey: "safetyState.eStop", referenceValue: this._currentState.safetyState.eStop });
            this.debug("Order rejected as emergency stop is active: %j", error);
            this._rejectOrder(error);
            return;
        }
        if (this._currentState.safetyState.fieldViolation) {
            const error = this._createOrderError(order, __1.ErrorType.Order, "order is not executable due to protective field violation", { referenceKey: "safetyState.fieldViolation", referenceValue: this._currentState.safetyState.fieldViolation.toString() });
            this.debug("Order rejected as protective field is violated: %j", error);
            this._rejectOrder(error);
            return;
        }
        if (this._currentState.operatingMode !== __1.OperatingMode.Automatic &&
            this._currentState.operatingMode !== __1.OperatingMode.Semiautomatic) {
            const error = this._createOrderError(order, __1.ErrorType.Order, "order is not executable due to operating mode", { referenceKey: "operatingMode", referenceValue: this._currentState.operatingMode });
            this.debug("Order rejected due to operating mode: %j", error);
            this._rejectOrder(error);
            return;
        }
        if (order.orderId === ((_a = this.currentOrder) === null || _a === void 0 ? void 0 : _a.orderId)) {
            if (order.orderUpdateId < this.currentOrder.orderUpdateId) {
                const error = this._createOrderError(order, __1.ErrorType.OrderUpdate, "invalid orderUpdateId");
                this.debug("Order update rejected as orderUpdateId is invalid: %j", error);
                this._rejectOrder(error);
            }
            else if (order.orderUpdateId === this.currentOrder.orderUpdateId) {
                this.debug("Order update discarded as orderUpdateId is already assigned");
                this._updateState({}, true);
            }
            else {
                if (this.hasActiveOrder) {
                    if (!this._isOrderBaseStitching(order)) {
                        const error = this._createOrderError(order, __1.ErrorType.OrderUpdate, "stitching order base not extending active order base");
                        this.debug("Stitching order rejected as it doesn't extend the active order base: %j", error);
                        this._rejectOrder(error);
                    }
                    else {
                        this._acceptOrder(order, "stitch");
                    }
                }
                else {
                    if (!this._isOrderUpdateBaseStitching(order)) {
                        const error = this._createOrderError(order, __1.ErrorType.OrderUpdate, "order update base not extending current order base");
                        this.debug("Order update rejected as it doesn't extend the current order base: %j", error);
                        this._rejectOrder(error);
                    }
                    else {
                        this._acceptOrder(order, "update");
                    }
                }
            }
        }
        else {
            if (this.hasActiveOrder) {
                if (!this._isOrderBaseStitching(order)) {
                    const error = this._createOrderError(order, __1.ErrorType.OrderUpdate, "stitching order base not extending active order base");
                    this.debug("Stitching order rejected as it doesn't extend the active order base: %j", error);
                    this._rejectOrder(error);
                }
                else {
                    this._acceptOrder(order, "stitch");
                }
            }
            else {
                if (this._checkNodeWithinDeviationRange(order)) {
                    this._acceptOrder(order, "new");
                }
            }
        }
    }
    _validateOrderConstraints(order) {
        const nodeLen = order.nodes.length;
        if (nodeLen === 0 || !order.nodes[0].released) {
            throw new Error("Order must contain at least one base node");
        }
        let isBase = true;
        let firstHorizonIndex = -1;
        for (let i = 0; i < nodeLen; i++) {
            const node = order.nodes[i];
            if ((i === 0 && node.sequenceId % 2 !== 0) ||
                (i > 0 && node.sequenceId !== order.nodes[i - 1].sequenceId + 2)) {
                throw new Error("Order contains node with invalid sequenceId");
            }
            if (isBase) {
                isBase = node.released;
                if (!isBase) {
                    firstHorizonIndex = i;
                }
            }
            else {
                if (node.released) {
                    throw new Error("Incorrect sequence of base-horizon nodes");
                }
            }
        }
        const edgeLen = order.edges.length;
        isBase = true;
        if (edgeLen + 1 !== nodeLen) {
            throw new Error("Incompatible sequence of nodes and edges");
        }
        for (let i = 0; i < edgeLen; i++) {
            const edge = order.edges[i];
            if (edge.sequenceId !== order.nodes[i].sequenceId + 1) {
                throw new Error("Order contains edge with invalid sequenceId");
            }
            if (isBase) {
                isBase = edge.released;
                if (!isBase && firstHorizonIndex !== i + 1) {
                    throw new Error("Incorrect sequence of base-horizon edges");
                }
                else if (isBase && !order.nodes[i + 1].released) {
                    throw new Error("EndNode of last base edge is not released");
                }
            }
            else {
                if (edge.released) {
                    throw new Error("Incorrect sequence of base-horizon edges");
                }
            }
            if (edge.startNodeId !== order.nodes[i].nodeId || edge.endNodeId !== order.nodes[i + 1].nodeId) {
                throw new Error("An edge doesn't have proper start and/or end nodes");
            }
        }
    }
    _isOrderBaseStitching(order) {
        if (!this.currentOrder) {
            return false;
        }
        const currentHorizonStartIndex = this.currentOrder.nodes.findIndex(n => !n.released);
        const currentBaseEnd = this.currentOrder.nodes[currentHorizonStartIndex === -1 ?
            this.currentOrder.nodes.length - 1 : currentHorizonStartIndex - 1];
        const newBaseStart = order.nodes[0];
        return currentBaseEnd.nodeId === newBaseStart.nodeId &&
            currentBaseEnd.sequenceId === newBaseStart.sequenceId;
    }
    _isOrderUpdateBaseStitching(order) {
        const newBaseStart = order.nodes[0];
        return newBaseStart.nodeId === this._currentState.lastNodeId &&
            newBaseStart.sequenceId === this._currentState.lastNodeSequenceId;
    }
    _acceptOrder(order, mode) {
        this.debug("Order accepted with mode '%s'", mode);
        switch (mode) {
            case "new": {
                this.currentOrder = order;
                this._updateState({
                    orderId: order.orderId,
                    orderUpdateId: order.orderUpdateId,
                    errors: this._getNonOrderRejectionErrors(false),
                    nodeStates: this._getNodeStates(order),
                    edgeStates: this._getEdgeStates(order),
                    actionStates: this._getInstantActionStates().concat(this._getActionStates(order)),
                }, true);
                this._processNode(this.currentOrder.nodes[0]);
                break;
            }
            case "update": {
                this.currentOrder = order;
                this._updateState({
                    orderUpdateId: order.orderUpdateId,
                    errors: this._getNonOrderRejectionErrors(false),
                    nodeStates: this._getNodeStates(order),
                    edgeStates: this._getEdgeStates(order),
                    actionStates: this._getInstantActionStates().concat(this._getActionStates(order)),
                }, true);
                this._processNode(this.currentOrder.nodes[0]);
                break;
            }
            case "stitch": {
                this.currentOrder.orderId = order.orderId;
                this.currentOrder.orderUpdateId = order.orderUpdateId;
                this.currentOrder.zoneSetId = order.zoneSetId;
                let currentHorizonStartIndex = this.currentOrder.nodes.findIndex(n => !n.released);
                const currentBaseEnd = this.currentOrder.nodes[currentHorizonStartIndex === -1 ?
                    this.currentOrder.nodes.length - 1 : currentHorizonStartIndex - 1];
                this.currentOrder.nodes = this.currentOrder.nodes
                    .slice(0, currentHorizonStartIndex === -1 ? undefined : currentHorizonStartIndex)
                    .concat(order.nodes.slice(1));
                currentBaseEnd.actions = currentBaseEnd.actions.concat(order.nodes[0].actions);
                currentHorizonStartIndex = this.currentOrder.edges.findIndex(n => !n.released);
                this.currentOrder.edges = this.currentOrder.edges
                    .slice(0, currentHorizonStartIndex === -1 ? undefined : currentHorizonStartIndex)
                    .concat(order.edges);
                const isLastBaseNodeProcessed = !this._currentState.nodeStates.some(s => s.nodeId === currentBaseEnd.nodeId && s.sequenceId === currentBaseEnd.sequenceId);
                const allLastBaseNodeActionsEnded = currentBaseEnd.actions.every(a => this._isActionEnded(a));
                this._updateState({
                    orderId: order.orderId,
                    orderUpdateId: order.orderUpdateId,
                    errors: this._getNonOrderRejectionErrors(true),
                    nodeStates: this._currentState.nodeStates.filter(s => s.released).concat(this._getNodeStates(order, true)),
                    edgeStates: this._currentState.edgeStates.filter(s => s.released).concat(this._getEdgeStates(order)),
                    actionStates: this._currentState.actionStates.concat(this._getActionStates(order, false)),
                }, true);
                if (isLastBaseNodeProcessed && allLastBaseNodeActionsEnded) {
                    this._processEdge(currentBaseEnd);
                }
                break;
            }
        }
    }
    _rejectOrder(error) {
        this._updateState({ errors: [...this._currentState.errors, error] }, true);
    }
    _cancelOrder(context) {
        this._cancelOrderContext = context;
        this._currentState.actionStates.forEach(s => {
            if (!this.isInstantActionState(s) && s.actionStatus === __1.ActionStatus.Waiting) {
                s.actionStatus = __1.ActionStatus.Failed;
            }
        });
        this._updateActionStatus(context, {
            actionStatus: __1.ActionStatus.Running,
        });
        let hasActionsToBeCanceled = false;
        this._currentState.actionStates.forEach(s => {
            if (!this.isInstantActionState(s) &&
                s.actionStatus !== __1.ActionStatus.Finished && s.actionStatus !== __1.ActionStatus.Failed) {
                let actionContext;
                for (const node of this.currentOrder.nodes) {
                    if (!node.released) {
                        break;
                    }
                    const action = node.actions.find(a => a.actionId === s.actionId);
                    if (action) {
                        actionContext = {
                            action,
                            scope: "node",
                            updateActionStatus: change => this._updateActionStatus(actionContext, change),
                            node,
                            activeOrderId: this.currentOrder.orderId,
                        };
                        break;
                    }
                }
                if (!actionContext) {
                    for (const edge of this.currentOrder.edges) {
                        if (!edge.released) {
                            break;
                        }
                        const action = edge.actions.find(a => a.actionId === s.actionId);
                        if (action) {
                            actionContext = {
                                action,
                                scope: "edge",
                                updateActionStatus: change => this._updateActionStatus(actionContext, change),
                                edge,
                                edgeStartNode: this._getEdgeStartNode(this.currentOrder, edge),
                                edgeEndNode: this._getEdgeEndNode(this.currentOrder, edge),
                                activeOrderId: this.currentOrder.orderId,
                            };
                            break;
                        }
                    }
                }
                hasActionsToBeCanceled = true;
                this.debug("Invoking cancelAction handler with context %o", actionContext);
                this._agvAdapter.cancelAction(actionContext);
            }
        });
        if (!hasActionsToBeCanceled) {
            this._onOrderActionsCanceled();
        }
    }
    _areAllOrderActionsCanceled() {
        for (const node of this.currentOrder.nodes) {
            if (!node.released) {
                break;
            }
            if (!node.actions.every(a => this._isActionEnded(a))) {
                return false;
            }
        }
        for (const edge of this.currentOrder.edges) {
            if (!edge.released) {
                break;
            }
            if (!edge.actions.every(a => this._isActionEnded(a))) {
                return false;
            }
        }
        return true;
    }
    _onOrderActionsCanceled() {
        this.debug("Invoking stopTraverse handler");
        this._agvAdapter.stopTraverse({
            drivingToNextNode: (nextNode) => {
                this.debug("Invoked drivingToNextNode callback with next node %o", nextNode);
                this._updateState({
                    nodeStates: this._currentState.nodeStates.filter(s => s.nodeId === nextNode.nodeId && s.sequenceId === nextNode.sequenceId),
                    edgeStates: [],
                }, true);
            },
            stopped: () => {
                this.debug("Invoked stopped callback");
                const cancelOrderContext = this._cancelOrderContext;
                this._cancelOrderContext = undefined;
                this._updateState({
                    nodeStates: [],
                    edgeStates: [],
                }, false);
                this._updateActionStatus(cancelOrderContext, {
                    actionStatus: __1.ActionStatus.Finished,
                });
            },
        });
    }
    _checkRouteTraversable(order) {
        const context = { nodes: order.nodes, edges: order.edges };
        this.debug("Invoking isRouteTraversable handler on context %o", context);
        const errorRefs = this._agvAdapter.isRouteTraversable(context) || [];
        if (errorRefs.length !== 0) {
            const error = this._createOrderError(order, __1.ErrorType.OrderNoRoute, "order route is not traversable", ...errorRefs);
            this.debug("Order rejected as route is not traversable: %j", error);
            this._rejectOrder(error);
            return false;
        }
        return true;
    }
    _checkOrderActionsExecutable(order) {
        const reportError = (context, errorRefs) => {
            const error = this._createOrderError(order, __1.ErrorType.Order, "order action is not executable", { referenceKey: "actionId", referenceValue: context.action.actionId }, { referenceKey: "actionType", referenceValue: context.action.actionType }, ...errorRefs);
            this.debug("Order rejected as an action is not executable: %j", error);
            this._rejectOrder(error);
        };
        for (const node of order.nodes) {
            for (const action of node.actions) {
                const context = {
                    action,
                    scope: "node",
                    updateActionStatus: undefined,
                    node,
                    activeOrderId: order.orderId,
                };
                this.debug("Invoking isActionExecutable handler on context %o", context);
                const errorRefs = this._agvAdapter.isActionExecutable(context);
                if ((errorRefs === null || errorRefs === void 0 ? void 0 : errorRefs.length) > 0) {
                    reportError(context, errorRefs);
                    return false;
                }
            }
        }
        for (const edge of order.edges) {
            for (const action of edge.actions) {
                const context = {
                    action,
                    scope: "edge",
                    updateActionStatus: undefined,
                    edge,
                    edgeStartNode: this._getEdgeStartNode(order, edge),
                    edgeEndNode: this._getEdgeEndNode(order, edge),
                    activeOrderId: order.orderId,
                };
                this.debug("Invoking isActionExecutable handler on context %o", context);
                const errorRefs = this._agvAdapter.isActionExecutable(context);
                if ((errorRefs === null || errorRefs === void 0 ? void 0 : errorRefs.length) > 0) {
                    reportError(context, errorRefs);
                    return false;
                }
            }
        }
        return true;
    }
    _checkNodeWithinDeviationRange(order) {
        const firstNode = order.nodes[0];
        this.debug("Invoking isNodeWithinDeviationRange handler with node %o", firstNode);
        const errorRefs = this._agvAdapter.isNodeWithinDeviationRange(firstNode) || [];
        if (errorRefs.length !== 0) {
            const error = this._createOrderError(order, __1.ErrorType.OrderNoRoute, "first node of new order not within deviation range", { referenceKey: "nodeId", referenceValue: firstNode.nodeId }, ...errorRefs);
            this.debug("Order rejected as first node is not within deviation range: %j", error);
            this._rejectOrder(error);
            return false;
        }
        return true;
    }
    _getNodeStates(order, excludeFirstNode = false) {
        return (excludeFirstNode ? order.nodes.slice(1) : order.nodes)
            .map(n => {
            const state = {
                nodeId: n.nodeId,
                released: n.released,
                sequenceId: n.sequenceId,
            };
            if (n.nodeDescription !== undefined) {
                state.nodeDescription = n.nodeDescription;
            }
            if (n.nodePosition !== undefined) {
                state.nodePosition = n.nodePosition;
            }
            return state;
        });
    }
    _getEdgeStates(order) {
        return order.edges
            .map(e => {
            let trajectory;
            if (!this._agvAdapter.trajectory) {
                trajectory = e.trajectory;
            }
            else {
                trajectory = this._agvAdapter.trajectory({
                    edge: e,
                    startNode: this._getEdgeStartNode(order, e),
                    endNode: this._getEdgeEndNode(order, e),
                });
                this.debug("Invoking trajectory calculation handler on edge %o with result %o", e, trajectory);
            }
            const state = {
                edgeId: e.edgeId,
                released: e.released,
                sequenceId: e.sequenceId,
            };
            if (e.edgeDescription !== undefined) {
                state.edgeDescription = e.edgeDescription;
            }
            if (trajectory !== undefined) {
                state.trajectory = trajectory;
            }
            return state;
        });
    }
    _getActionStates(order, excludeFirstNode = false) {
        const actionStateFrom = (a) => {
            const s = {
                actionId: a.actionId,
                actionStatus: __1.ActionStatus.Waiting,
                actionType: a.actionType,
            };
            if (a.actionDescription !== undefined) {
                s.actionDescription = a.actionDescription;
            }
            return s;
        };
        return (excludeFirstNode ? order.nodes.slice(1) : order.nodes)
            .filter(n => n.released)
            .flatMap(n => n.actions.map(a => actionStateFrom(a)))
            .concat(order.edges
            .filter(e => e.released)
            .flatMap(e => e.actions.map(a => actionStateFrom(a))));
    }
    _getInstantActionStates() {
        return this._currentState.actionStates.filter(s => this.isInstantActionState(s));
    }
    _getNonOrderRejectionErrors(shouldKeepOrderActionErrors) {
        return this._currentState.errors.filter(e => this._instantActionsErroredPublishCount.has(e) ||
            (shouldKeepOrderActionErrors && e.errorReferences && e.errorReferences.some(r => r.referenceKey === "actionId")));
    }
    _cleanupInstantActionStates() {
        const errorsToRemove = new Set();
        this._instantActionsErroredPublishCount.forEach((count, err, map) => {
            if (!this._currentState.errors.includes(err)) {
                return;
            }
            count++;
            if (count >= this.controllerOptions.finalInstantActionStateChangePublishCount) {
                map.delete(err);
                errorsToRemove.add(err);
            }
            else {
                map.set(err, count);
            }
        });
        const actionIdsToRemove = new Set();
        this._instantActionsEndedPublishCount.forEach((count, id, map) => {
            const state = this._currentState.actionStates.find(s => s.actionId === id);
            if (!state || (state.actionStatus !== __1.ActionStatus.Finished && state.actionStatus !== __1.ActionStatus.Failed)) {
                return;
            }
            count++;
            if (count >= this.controllerOptions.finalInstantActionStateChangePublishCount) {
                map.delete(id);
                actionIdsToRemove.add(id);
            }
            else {
                map.set(id, count);
            }
        });
        const newState = {};
        if (errorsToRemove.size > 0) {
            newState.errors = this._currentState.errors.filter(e => !errorsToRemove.has(e));
        }
        if (actionIdsToRemove.size > 0) {
            newState.actionStates = this._currentState.actionStates.filter(s => !actionIdsToRemove.has(s.actionId));
        }
        if (newState.errors !== undefined || newState.actionStates !== undefined) {
            this._updateState(newState, false);
        }
    }
    _getEdgeStartNode(order, edge) {
        return order.nodes.find(n => n.nodeId === edge.startNodeId && n.sequenceId === edge.sequenceId - 1);
    }
    _getEdgeEndNode(order, edge) {
        return order.nodes.find(n => n.nodeId === edge.endNodeId && n.sequenceId === edge.sequenceId + 1);
    }
    _getTrailingEdge(node) {
        return this.currentOrder.edges.find(e => e.startNodeId === node.nodeId && e.sequenceId === node.sequenceId + 1);
    }
    _processNode(node, traversedEdge) {
        this.debug("Processing node %s (sequenceId %d)", node.nodeId, node.sequenceId);
        if (!node.released) {
            this.debug("Stop node processing because node is not released");
            return;
        }
        if (this._currentState.paused) {
            this.debug("Stop node processing because AGV is in a paused state");
            this._currentPausedNode = node;
            return;
        }
        let edgeStates;
        if (traversedEdge) {
            this._finishEdgeActions(traversedEdge);
            edgeStates = this._currentState.edgeStates.filter(s => !(s.edgeId === traversedEdge.edgeId && s.sequenceId === traversedEdge.sequenceId));
        }
        this._updateState({
            nodeStates: this._currentState.nodeStates
                .filter(s => !(s.nodeId === node.nodeId && s.sequenceId === node.sequenceId)),
            ...(edgeStates ? { edgeStates } : {}),
            lastNodeId: node.nodeId,
            lastNodeSequenceId: node.sequenceId,
        }, true);
        this._processNodeActions(node);
    }
    _processEdge(node) {
        const edge = this._getTrailingEdge(node);
        if (edge === undefined || !edge.released) {
            this.debug("Stop processing of node %s (sequenceId %d) because no trailing released edge is existing", node.nodeId, node.sequenceId);
            return;
        }
        this.debug("Processing edge %s (sequenceId %d)", edge.edgeId, edge.sequenceId);
        this._processEdgeActions(edge);
    }
    _traverseEdge(edge) {
        var _a;
        const context = {
            edge,
            startNode: this._getEdgeStartNode(this.currentOrder, edge),
            endNode: this._getEdgeEndNode(this.currentOrder, edge),
            trajectory: (_a = this._currentState.edgeStates.find(s => s.edgeId === edge.edgeId && s.sequenceId === edge.sequenceId)) === null || _a === void 0 ? void 0 : _a.trajectory,
            edgeTraversed: () => this._updateEdgeTraversed(context),
        };
        this.debug("Invoking traverse handler on edgeId %s (sequenceId %d) with context %o", edge.edgeId, edge.sequenceId, context);
        this._agvAdapter.traverseEdge(context);
    }
    _updateEdgeTraversed(context) {
        this.debug("Edge %s (sequenceId %d) has been traversed", context.edge.edgeId, context.edge.sequenceId);
        if (this.hasCancelingOrder) {
            this.debug("Skip processing node %s (sequenceId %d) as active order is canceled", context.endNode, context.edge);
            return;
        }
        this._processNode(context.endNode, context.edge);
    }
    _isActionEnded(action) {
        const as = this._currentState.actionStates.find(s => s.actionId === action.actionId);
        return as !== undefined && (as.actionStatus === __1.ActionStatus.Finished || as.actionStatus === __1.ActionStatus.Failed);
    }
    _getHardBlockingActionAfterParallelActions(actions, action) {
        const actionIndex = actions.findIndex(a => a.actionId === action.actionId);
        return actions.find((a, i) => i > actionIndex && a.blockingType === __1.BlockingType.Hard);
    }
    _areParallelActionsEnded(actions, endedAction, softOnly) {
        const actionIndex = actions.findIndex(a => a.actionId === endedAction.actionId);
        for (let i = actionIndex - 1; i >= 0; i--) {
            const action = actions[i];
            if (action.blockingType === __1.BlockingType.Hard) {
                break;
            }
            else {
                const ended = this._isActionEnded(action);
                if (softOnly) {
                    if (action.blockingType === __1.BlockingType.Soft && !ended) {
                        return false;
                    }
                }
                else {
                    if (!ended) {
                        return false;
                    }
                }
            }
        }
        const len = actions.length;
        for (let i = actionIndex + 1; i < len; i++) {
            const action = actions[i];
            if (action.blockingType === __1.BlockingType.Hard) {
                return true;
            }
            else {
                const ended = this._isActionEnded(action);
                if (softOnly) {
                    if (action.blockingType === __1.BlockingType.Soft && !ended) {
                        return false;
                    }
                }
                else {
                    if (!ended) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    _updateActionStatus(context, change) {
        const { action, scope } = context;
        const { actionStatus, resultDescription, errorDescription, linkedState } = change;
        this.debug("Updated action %o change: %o", action, change);
        const newActionState = {
            actionId: action.actionId,
            actionStatus: actionStatus,
            actionType: action.actionType,
        };
        if (action.actionDescription !== undefined) {
            newActionState.actionDescription = action.actionDescription;
        }
        if (resultDescription !== undefined) {
            newActionState.resultDescription = resultDescription;
        }
        const newActionStates = [...this._currentState.actionStates];
        const i = this._currentState.actionStates.findIndex(s => s.actionId === action.actionId);
        if (i === -1) {
            newActionStates.push(newActionState);
        }
        else {
            newActionStates[i] = newActionState;
        }
        const errors = {};
        if (actionStatus === __1.ActionStatus.Failed && errorDescription) {
            const error = this._createActionError(context, scope === "instant" ? __1.ErrorType.InstantAction : __1.ErrorType.OrderAction, errorDescription, []);
            errors.errors = [...this._currentState.errors, error];
        }
        this._updateState(Object.assign({ actionStates: newActionStates }, errors, this._cloneState(linkedState)), true);
        if (actionStatus === __1.ActionStatus.Failed || actionStatus === __1.ActionStatus.Finished) {
            switch (scope) {
                case "node": {
                    if (this.hasCancelingOrder) {
                        if (this._areAllOrderActionsCanceled()) {
                            this._onOrderActionsCanceled();
                        }
                    }
                    else {
                        if (action.blockingType === __1.BlockingType.Hard) {
                            this._processNodeActions(context.node, action);
                        }
                        else {
                            const nextHardAction = this._getHardBlockingActionAfterParallelActions(context.node.actions, action);
                            if (nextHardAction) {
                                if (this._areParallelActionsEnded(context.node.actions, action, false)) {
                                    this._processNodeAction(context.node, nextHardAction, true);
                                }
                            }
                            else {
                                if (this._areParallelActionsEnded(context.node.actions, action, true)) {
                                    this._processEdge(context.node);
                                }
                            }
                        }
                    }
                    break;
                }
                case "edge": {
                    if (this.hasCancelingOrder) {
                        if (this._areAllOrderActionsCanceled()) {
                            this._onOrderActionsCanceled();
                        }
                    }
                    else {
                        if (action.blockingType === __1.BlockingType.Hard) {
                            this._processEdgeActions(context.edge, action);
                        }
                        else {
                            const nextHardAction = this._getHardBlockingActionAfterParallelActions(context.edge.actions, action);
                            if (nextHardAction) {
                                if (this._areParallelActionsEnded(context.edge.actions, action, false)) {
                                    this._processEdgeAction(context.edge, nextHardAction, true);
                                }
                            }
                            else {
                                if (this._areParallelActionsEnded(context.edge.actions, action, true)) {
                                    this._traverseEdge(context.edge);
                                }
                            }
                        }
                    }
                    break;
                }
                case "instant": {
                    const actionIndex = this._currentInstantActions.findIndex(a => a.actionId === action.actionId);
                    if (action.blockingType === __1.BlockingType.Hard) {
                        this._currentInstantActions.splice(actionIndex, 1);
                        this._processInstantActionChunk(undefined);
                    }
                    else {
                        const nextHardAction = this._getHardBlockingActionAfterParallelActions(this._currentInstantActions, action);
                        if (nextHardAction && this._areParallelActionsEnded(this._currentInstantActions, action, false)) {
                            this._currentInstantActions.splice(actionIndex, 1);
                            this._processInstantAction(nextHardAction, true);
                        }
                        else {
                            this._currentInstantActions.splice(actionIndex, 1);
                        }
                    }
                    break;
                }
            }
        }
    }
    _processNodeActions(node, afterAction) {
        const afterIndex = afterAction === undefined ? -1 : node.actions.findIndex(a => a.actionId === afterAction.actionId);
        const hardIndex = node.actions.findIndex((a, i) => i > afterIndex && a.blockingType === __1.BlockingType.Hard);
        const softIndex = node.actions.findIndex((a, i) => i > afterIndex && a.blockingType === __1.BlockingType.Soft);
        const stopIndex = hardIndex === -1 ? node.actions.length : hardIndex;
        const stopDriving = softIndex !== -1 && softIndex < stopIndex;
        if (stopIndex === afterIndex + 1) {
            if (hardIndex === -1) {
                this._processEdge(node);
            }
            else {
                this._processNodeAction(node, node.actions[stopIndex], true);
            }
        }
        else {
            for (let i = afterIndex + 1; i < stopIndex; i++) {
                this._processNodeAction(node, node.actions[i], stopDriving);
            }
        }
    }
    _processNodeAction(node, action, stopDriving) {
        const context = {
            action,
            scope: "node",
            stopDriving,
            updateActionStatus: change => this._updateActionStatus(context, change),
            node,
            activeOrderId: this.currentOrder.orderId,
        };
        this.debug("Invoking node executeAction handler with context %o", context);
        this._agvAdapter.executeAction(context);
    }
    _processEdgeActions(edge, afterAction) {
        const afterIndex = afterAction === undefined ? -1 : edge.actions.findIndex(a => a.actionId === afterAction.actionId);
        const hardIndex = edge.actions.findIndex((a, i) => i > afterIndex && a.blockingType === __1.BlockingType.Hard);
        const softIndex = edge.actions.findIndex((a, i) => i > afterIndex && a.blockingType === __1.BlockingType.Soft);
        const stopIndex = hardIndex === -1 ? edge.actions.length : hardIndex;
        const stopDriving = softIndex !== -1 && softIndex < stopIndex;
        if (stopIndex === afterIndex + 1) {
            if (hardIndex === -1) {
                this._traverseEdge(edge);
            }
            else {
                this._processEdgeAction(edge, edge.actions[stopIndex], true);
            }
        }
        else {
            for (let i = afterIndex + 1; i < stopIndex; i++) {
                this._processEdgeAction(edge, edge.actions[i], stopDriving);
            }
        }
    }
    _processEdgeAction(edge, action, stopDriving) {
        const context = {
            action,
            scope: "edge",
            stopDriving,
            updateActionStatus: change => this._updateActionStatus(context, change),
            edge,
            edgeStartNode: this._getEdgeStartNode(this.currentOrder, edge),
            edgeEndNode: this._getEdgeEndNode(this.currentOrder, edge),
            activeOrderId: this.currentOrder.orderId,
        };
        this.debug("Invoking edge executeAction handler with context %o", context);
        this._agvAdapter.executeAction(context);
    }
    _finishEdgeActions(edge) {
        for (const action of edge.actions) {
            if (!this._isActionEnded(action)) {
                const context = {
                    action,
                    scope: "edge",
                    updateActionStatus: change => this._updateActionStatus(context, change),
                    edge,
                    edgeStartNode: this._getEdgeStartNode(this.currentOrder, edge),
                    edgeEndNode: this._getEdgeEndNode(this.currentOrder, edge),
                    activeOrderId: this.currentOrder.orderId,
                };
                this.debug("Invoking finishEdgeAction handler with context %o", context);
                this._agvAdapter.finishEdgeAction(context);
            }
        }
    }
    _processInstantActions(actions) {
        try {
            this.validateTopicObject(__1.Topic.InstantActions, actions, this.clientOptions.vdaVersion);
        }
        catch (err) {
            const error = this._createInstantActionsValidationError(actions, `invalid instant actions: ${err}`);
            this.debug("Invalid instant actions: %j", error);
            this._instantActionsErroredPublishCount.set(error, 0);
            this._updateState({
                errors: [...this._currentState.errors, error],
            }, true);
            return;
        }
        const afterAction = this._currentInstantActions[this._currentInstantActions.length - 1];
        const hasPendingHardAction = this._currentInstantActions.some(a => a.blockingType === __1.BlockingType.Hard);
        this._currentInstantActions.push(...actions.instantActions.filter(a => this._checkInstantActionExecutable(a)));
        if (!hasPendingHardAction) {
            this._processInstantActionChunk(afterAction, afterAction !== undefined);
        }
    }
    _processInstantActionChunk(afterAction, skipInitialHard = false) {
        const actions = this._currentInstantActions;
        const afterIndex = afterAction === undefined ? -1 : actions.findIndex(a => a.actionId === afterAction.actionId);
        const hardIndex = actions.findIndex((a, i) => i > afterIndex && a.blockingType === __1.BlockingType.Hard);
        const softIndex = actions.findIndex((a, i) => i > afterIndex && a.blockingType === __1.BlockingType.Soft);
        const stopIndex = hardIndex === -1 ? actions.length : hardIndex;
        const stopDriving = softIndex !== -1 && softIndex < stopIndex;
        if (stopIndex === afterIndex + 1) {
            if (hardIndex !== -1 && !skipInitialHard) {
                this._processInstantAction(actions[stopIndex], true);
            }
        }
        else {
            for (let i = afterIndex + 1; i < stopIndex; i++) {
                this._processInstantAction(actions[i], stopDriving);
            }
        }
    }
    _processInstantAction(action, stopDriving) {
        const context = {
            action,
            scope: "instant",
            stopDriving,
            updateActionStatus: change => this._updateActionStatus(context, change),
            activeOrderId: this.hasActiveOrder ? this.currentOrder.orderId : undefined,
        };
        this._instantActionsEndedPublishCount.set(action.actionId, 0);
        switch (action.actionType) {
            case "stateRequest": {
                this.debug("Processing instant action 'stateRequest' with context %o", context);
                context.updateActionStatus({
                    actionStatus: __1.ActionStatus.Finished,
                    resultDescription: "Reported new state",
                });
                break;
            }
            case "cancelOrder": {
                this.debug("Processing instant action 'cancelOrder' with context %o", context);
                this._cancelOrder(context);
                break;
            }
            case "factsheetRequest": {
                this.debug("Processing instant action 'factsheetRequest' with context %o", context);
                if (this.clientOptions.vdaVersion === "2.0.0") {
                    this._publishFactsheet(context);
                }
                else {
                    context.updateActionStatus({
                        actionStatus: __1.ActionStatus.Failed,
                        errorDescription: `Requesting factsheet with VDA Version ${this.clientOptions.vdaVersion} is not supported`,
                    });
                }
                break;
            }
            case "stopPause": {
                context.updateActionStatus = change => {
                    this._updateActionStatus(context, change);
                    if (change.actionStatus === __1.ActionStatus.Finished) {
                        const pausedNode = this._currentPausedNode;
                        if (pausedNode) {
                            this._currentPausedNode = undefined;
                            if (!this.hasCancelingOrder) {
                                this._processNode(pausedNode);
                            }
                        }
                    }
                };
                this.executeInstantAction(context);
                break;
            }
            case "startPause": {
                this.executeInstantAction(context);
                break;
            }
            default: {
                this.executeInstantAction(context);
                break;
            }
        }
    }
    _checkInstantActionExecutable(action) {
        const context = {
            action,
            scope: "instant",
            updateActionStatus: undefined,
            activeOrderId: this.hasActiveOrder ? this.currentOrder.orderId : undefined,
        };
        let errorRefs = [];
        let errorType = __1.ErrorType.InstantAction;
        if (action.actionType === "cancelOrder") {
            this.debug("Checking instant action cancelOrder %o", context);
            errorType = __1.ErrorType.InstantActionNoOrderToCancel;
            if (!this.hasActiveOrder) {
                errorRefs.push({ referenceKey: AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "no active order to be canceled" });
            }
            else if (this.hasCancelingOrder) {
                errorRefs.push({ referenceKey: AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "cancel order already pending" });
            }
        }
        else if (action.actionType === "stateRequest") {
            this.debug("Checking instant action stateRequest %o", context);
        }
        else if (action.actionType === "factsheetRequest") {
            this.debug("Checking instant action factsheetRequest %o", context);
        }
        else {
            this.debug("Invoking isActionExecutable handler on context %o", context);
            errorRefs = this._agvAdapter.isActionExecutable(context);
        }
        if ((errorRefs === null || errorRefs === void 0 ? void 0 : errorRefs.length) > 0) {
            const error = this._createActionError(context, errorType, "instant action is not executable", errorRefs);
            this.debug("Instant action rejected as it is not executable: %j", error);
            this._instantActionsErroredPublishCount.set(error, 0);
            this._updateState({
                errors: [...this._currentState.errors, error],
            }, true);
            return false;
        }
        return true;
    }
    _createOrderError(order, errorType, errorDescription, ...errorRefs) {
        var _a;
        if (errorType === __1.ErrorType.OrderValidation && !(0, __1.isPlainObject)(order)) {
            order = undefined;
        }
        const errorDescriptionDetail = (_a = errorRefs.find(r => r.referenceKey === AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL)) === null || _a === void 0 ? void 0 : _a.referenceValue;
        const errorReferences = [];
        errorReferences.push({ referenceKey: "topic", referenceValue: __1.Topic.Order });
        if ((order === null || order === void 0 ? void 0 : order.headerId) !== undefined) {
            errorReferences.push({ referenceKey: "headerId", referenceValue: order.headerId.toString() });
        }
        if ((order === null || order === void 0 ? void 0 : order.orderId) !== undefined) {
            errorReferences.push({ referenceKey: "orderId", referenceValue: order.orderId });
        }
        if ((order === null || order === void 0 ? void 0 : order.orderUpdateId) !== undefined) {
            errorReferences.push({ referenceKey: "orderUpdateId", referenceValue: order.orderUpdateId.toString() });
        }
        errorReferences.push(...errorRefs.filter(r => r.referenceKey !== AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL));
        return {
            errorDescription: errorDescriptionDetail ? errorDescription + ": " + errorDescriptionDetail : errorDescription,
            errorLevel: __1.ErrorLevel.Warning,
            errorType,
            errorReferences,
        };
    }
    _createActionError(context, errorType, errorDescription, errorRefs) {
        var _a;
        const { action, scope } = context;
        const errorDescriptionDetail = (_a = errorRefs.find(r => r.referenceKey === AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL)) === null || _a === void 0 ? void 0 : _a.referenceValue;
        errorRefs = [
            { referenceKey: "topic", referenceValue: scope === "instant" ? __1.Topic.InstantActions : __1.Topic.Order },
            { referenceKey: "actionId", referenceValue: action.actionId },
            { referenceKey: "actionType", referenceValue: action.actionType },
            ...errorRefs.filter(r => r.referenceKey !== AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL),
        ];
        return {
            errorDescription: errorDescriptionDetail ? errorDescription + ": " + errorDescriptionDetail : errorDescription,
            errorLevel: __1.ErrorLevel.Warning,
            errorType,
            errorReferences: errorRefs,
        };
    }
    _createInstantActionsValidationError(instantActions, errorDescription) {
        if (!(0, __1.isPlainObject)(instantActions)) {
            instantActions = undefined;
        }
        const errorReferences = [{ referenceKey: "topic", referenceValue: __1.Topic.InstantActions }];
        if ((instantActions === null || instantActions === void 0 ? void 0 : instantActions.headerId) !== undefined) {
            errorReferences.push({ referenceKey: "headerId", referenceValue: instantActions.headerId.toString() });
        }
        return {
            errorDescription,
            errorLevel: __1.ErrorLevel.Warning,
            errorType: __1.ErrorType.InstantActionValidation,
            errorReferences,
        };
    }
}
exports.AgvController = AgvController;
AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL = "errorDescriptionDetail";
