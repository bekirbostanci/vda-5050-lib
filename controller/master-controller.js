"use strict";
/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterController = void 0;
const __1 = require("..");
class MasterController extends __1.MasterControlClient {
    constructor(clientOptions, controllerOptions) {
        super(clientOptions);
        this._currentOrders = new __1.AgvIdMap();
        this._currentInstantActions = new __1.AgvIdMap();
        this._currentInstantActionsValidationErrors = [];
        this._controllerOptions = this._controllerOptionsWithDefaults(controllerOptions);
    }
    get controllerOptions() {
        return this._controllerOptions;
    }
    async assignOrder(agvId, order, eventHandler) {
        var _a;
        this.debug("Assigning order %o to AGV %o", order, agvId);
        let cache = this._getOrderStateCache(agvId, order.orderId, order.orderUpdateId);
        if (cache !== undefined) {
            this.debug("Discarded order %o for AGV %o", order, agvId);
            return undefined;
        }
        cache = this._addOrderStateCache(agvId, order, eventHandler);
        try {
            const orderWithHeader = await this.publish(__1.Topic.Order, agvId, order);
            this.debug("Assigned order with header %o to AGV %o", orderWithHeader, agvId);
            return orderWithHeader;
        }
        catch (error) {
            this.debug("Error assigning order %o to AGV %o: %s", order, agvId, (_a = error.message) !== null && _a !== void 0 ? _a : error);
            this._removeOrderStateCache(cache);
            throw error;
        }
    }
    async initiateInstantActions(agvId, instantActions, eventHandler) {
        var _a;
        this.debug("Initiating instant actions %o on AGV %o", instantActions, agvId);
        let actionStateCaches = this._currentInstantActions.get(agvId);
        if (!actionStateCaches) {
            this._currentInstantActions.set(agvId, actionStateCaches = new Map());
        }
        const newInstantActionsRef = this._currentInstantActionsRef === undefined ? 1 : this._currentInstantActionsRef + 1;
        instantActions.instantActions.forEach(action => actionStateCaches.set(action.actionId, { agvId, action, eventHandler, instantActionsRef: newInstantActionsRef }));
        try {
            const actionsWithHeader = await this.publish(__1.Topic.InstantActions, agvId, instantActions);
            this._currentInstantActionsRef = newInstantActionsRef;
            this.debug("Initiated instant actions %o on AGV %o", actionsWithHeader, agvId);
            return actionsWithHeader;
        }
        catch (error) {
            this.debug("Error initiating instant actions %o on AGV %o: %s", instantActions, agvId, (_a = error.message) !== null && _a !== void 0 ? _a : error);
            instantActions.instantActions.forEach(action => actionStateCaches.delete(action.actionId));
            if (actionStateCaches.size === 0) {
                this._currentInstantActions.delete(agvId);
            }
            throw error;
        }
    }
    async onStarted() {
        await super.onStarted();
        await this.subscribe(__1.Topic.State, this.controllerOptions.targetAgvs, (state, agvId) => this._dispatchState(state, agvId));
    }
    _controllerOptionsWithDefaults(options) {
        const optionalDefaults = {
            targetAgvs: {},
        };
        return Object.assign(optionalDefaults, options);
    }
    _dispatchState(state, agvId) {
        for (const error of state.errors) {
            let topic;
            let orderId;
            let orderUpdateId;
            let hasActionIdRef = false;
            let cache;
            if (error.errorReferences !== undefined) {
                for (const errorRef of error.errorReferences) {
                    if (errorRef.referenceKey === "actionId") {
                        hasActionIdRef = true;
                    }
                    if (errorRef.referenceKey === "topic") {
                        topic = errorRef.referenceValue;
                    }
                    if (errorRef.referenceKey === "orderId") {
                        orderId = errorRef.referenceValue;
                    }
                    if (errorRef.referenceKey === "orderUpdateId") {
                        orderUpdateId = parseInt(errorRef.referenceValue, 10);
                    }
                }
            }
            if (topic !== undefined && topic !== __1.Topic.Order) {
                continue;
            }
            if (hasActionIdRef && error.errorType !== __1.ErrorType.Order) {
                continue;
            }
            if (orderId !== undefined && orderUpdateId !== undefined) {
                cache = this._getOrderStateCache(agvId, orderId, orderUpdateId);
            }
            else if (topic === __1.Topic.Order && error.errorType === __1.ErrorType.OrderValidation) {
            }
            if (cache !== undefined) {
                this._removeOrderStateCache(cache);
                this.debug("onOrderProcessed with error %o for cache %o with state %j", error, cache, state);
                cache.eventHandler.onOrderProcessed(error, false, false, { order: cache.order, agvId, state });
            }
        }
        const orderStateCache = this._getOrderStateCache(agvId, state.orderId, state.orderUpdateId);
        if (orderStateCache) {
            this._dispatchOrderState(state, orderStateCache);
        }
        this._updateInstantActionsValidationError(state.errors);
        const actionStateCaches = this._currentInstantActions.get(agvId);
        if (actionStateCaches) {
            for (const [actionId, actionStateCache] of actionStateCaches) {
                const actionState = state.actionStates.find(s => s.actionId === actionId);
                if (actionState) {
                    this._dispatchInstantActionState(actionState, actionStateCache, state);
                }
                else {
                    const actionError = this._getActionError(state.errors, actionId, true);
                    if (actionError) {
                        this._dispatchInstantActionError(actionError, actionStateCache, state);
                    }
                    else {
                        const validationError = this._getInstantActionsValidationError(actionStateCache.instantActionsRef);
                        if (validationError) {
                            this._dispatchInstantActionError(validationError, actionStateCache, state);
                        }
                    }
                }
            }
        }
    }
    _dispatchOrderState(state, cache) {
        const processEdgeEvents = () => {
            if (this._isOrderCanceling(cache, state, [__1.ActionStatus.Running, __1.ActionStatus.Finished])) {
                return;
            }
            const nextEdge = this._getNextReleasedEdge(cache.combinedOrder, cache.lastNodeTraversed);
            if (nextEdge) {
                const startNode = this._getEdgeStartNode(cache.combinedOrder, nextEdge);
                const endNode = this._getEdgeEndNode(cache.combinedOrder, nextEdge);
                const edgeState = state.edgeStates.find(s => s.edgeId === nextEdge.edgeId && s.sequenceId === nextEdge.sequenceId);
                if (!edgeState) {
                    if (cache.lastEdgeProcessed === nextEdge) {
                        return;
                    }
                    this._updateEdgeStateChanges(nextEdge, startNode, endNode, cache, state);
                    cache.lastEdgeStateChanges = undefined;
                    cache.edgeStateChangeInvocations = 0;
                    cache.lastEdgeProcessed = nextEdge;
                    this.debug("onEdgeTraversed %o for cache %j", nextEdge, cache);
                    if (cache.eventHandler.onEdgeTraversed) {
                        cache.eventHandler.onEdgeTraversed(nextEdge, startNode, endNode, { order: cache.order, agvId: cache.agvId, state });
                    }
                }
                else {
                    if (cache.lastEdgeStateChanges !== undefined || this._areAllBlockingActionsEnded(cache.lastNodeTraversed, state)) {
                        this._updateEdgeStateChanges(nextEdge, startNode, endNode, cache, state);
                    }
                }
            }
        };
        this.debug("Dispatching order state %j \nfor cache %j", state, cache);
        if (cache.lastCache !== undefined) {
            const lastCache = this._getLastActiveOrderStateCache(cache);
            if (lastCache !== undefined) {
                let lastHorizonStartIndex = lastCache.combinedOrder.nodes.findIndex(n => !n.released);
                const lastBaseEnd = lastCache.combinedOrder.nodes[lastHorizonStartIndex === -1 ?
                    lastCache.combinedOrder.nodes.length - 1 : lastHorizonStartIndex - 1];
                const newFirstNodeActions = cache.combinedOrder.nodes[0].actions;
                cache.combinedOrder.nodes = lastCache.combinedOrder.nodes
                    .slice(0, lastHorizonStartIndex === -1 ? undefined : lastHorizonStartIndex)
                    .concat(cache.combinedOrder.nodes.slice(1));
                lastBaseEnd.actions = lastBaseEnd.actions.concat(newFirstNodeActions);
                lastHorizonStartIndex = lastCache.combinedOrder.edges.findIndex(n => !n.released);
                cache.combinedOrder.edges = lastCache.combinedOrder.edges
                    .slice(0, lastHorizonStartIndex === -1 ? undefined : lastHorizonStartIndex)
                    .concat(cache.combinedOrder.edges);
                cache.lastNodeTraversed = cache.combinedOrder.nodes.find(n => { var _a, _b; return n.nodeId === ((_a = lastCache.lastNodeTraversed) === null || _a === void 0 ? void 0 : _a.nodeId) && n.sequenceId === ((_b = lastCache.lastNodeTraversed) === null || _b === void 0 ? void 0 : _b.sequenceId); });
                cache.lastEdgeStateChanges = lastCache.lastEdgeStateChanges;
                cache.edgeStateChangeInvocations = lastCache.edgeStateChangeInvocations;
                cache.lastEdgeProcessed = lastCache.lastEdgeProcessed;
                cache.mappedActions = new Map([...lastCache.mappedActions, ...cache.mappedActions]);
                cache.lastActionStates = lastCache.lastActionStates;
                this.debug("stitching current order onto active order with combined cache %j", cache);
                this._removeOrderStateCache(lastCache, true);
            }
        }
        for (const actionState of state.actionStates) {
            const { actionId, actionStatus } = actionState;
            const actionTarget = cache.mappedActions.get(actionId);
            if (actionTarget) {
                const [action, target] = actionTarget;
                const lastActionState = cache.lastActionStates.get(actionId);
                if ((lastActionState === null || lastActionState === void 0 ? void 0 : lastActionState.actionStatus) !== actionStatus) {
                    cache.lastActionStates.set(actionId, actionState);
                    const error = actionStatus === __1.ActionStatus.Failed ? this._getActionError(state.errors, actionId, false) : undefined;
                    if (error) {
                        this.debug("onActionStateChanged %o with error %o for action %s on target %o for cache %j", actionState, error, action, target, cache);
                    }
                    else {
                        this.debug("onActionStateChanged %o for action %s on target %o for cache %j", actionState, action, target, cache);
                    }
                    if (cache.eventHandler.onActionStateChanged) {
                        cache.eventHandler.onActionStateChanged(actionState, error, action, target, { order: cache.order, agvId: cache.agvId, state });
                    }
                }
            }
        }
        if (cache.lastNodeTraversed) {
            processEdgeEvents();
        }
        let nextNode;
        if (cache.lastNodeTraversed === undefined) {
            const firstNode = cache.combinedOrder.nodes[0];
            if (!state.nodeStates.find(n => n.nodeId === firstNode.nodeId && n.sequenceId === firstNode.sequenceId)) {
                nextNode = firstNode;
            }
        }
        else {
            if (cache.lastNodeTraversed.nodeId !== state.lastNodeId || cache.lastNodeTraversed.sequenceId !== state.lastNodeSequenceId) {
                nextNode = this._getNode(cache.combinedOrder, state.lastNodeId, state.lastNodeSequenceId);
            }
        }
        if (nextNode !== undefined) {
            cache.lastNodeTraversed = nextNode;
            const nextEdge = this._getNextEdge(cache.combinedOrder, nextNode);
            const edgeEndNode = nextEdge ? this._getEdgeEndNode(cache.combinedOrder, nextEdge) : undefined;
            this.debug("onNodeTraversed %o for cache %j", nextNode, cache);
            if (cache.eventHandler.onNodeTraversed) {
                cache.eventHandler.onNodeTraversed(nextNode, nextEdge, edgeEndNode, { order: cache.order, agvId: cache.agvId, state });
            }
            processEdgeEvents();
        }
        const result = this._isOrderProcessed(cache, state);
        if (result !== false && !cache.isOrderProcessedHandlerInvoked) {
            const isActive = result === undefined;
            const byCancelation = this._isOrderCanceling(cache, state, [__1.ActionStatus.Finished]);
            if (byCancelation) {
                this.debug("onOrderProcessed by cancelation in state active=%s", isActive);
            }
            else {
                this.debug("onOrderProcessed in state active=%s", isActive);
            }
            if (!isActive) {
                this._removeOrderStateCache(cache, true);
            }
            cache.isOrderProcessedHandlerInvoked = true;
            cache.eventHandler.onOrderProcessed(undefined, byCancelation, isActive, { order: cache.order, agvId: cache.agvId, state });
            return;
        }
    }
    _addOrderStateCache(agvId, order, eventHandler) {
        const cache = {
            agvId,
            order: order,
            eventHandler,
            isOrderProcessedHandlerInvoked: false,
            lastCache: this._getLastAssignedOrderStateCache(agvId),
            combinedOrder: {
                edges: [...order.edges],
                nodes: [...order.nodes],
                orderId: order.orderId,
                orderUpdateId: order.orderUpdateId,
                zoneSetId: order.zoneSetId,
            },
        };
        let orderIds = this._currentOrders.get(cache.agvId);
        if (!orderIds) {
            orderIds = new Map();
            this._currentOrders.set(cache.agvId, orderIds);
        }
        orderIds["lastCache"] = cache;
        let orderUpdateIds = orderIds.get(cache.order.orderId);
        if (!orderUpdateIds) {
            orderUpdateIds = new Map();
            orderIds.set(cache.order.orderId, orderUpdateIds);
        }
        this._initCachedActions(cache);
        orderUpdateIds.set(cache.order.orderUpdateId, cache);
        return cache;
    }
    _removeOrderStateCache(cache, deleteLastCache = false) {
        if (deleteLastCache) {
            cache.lastCache = undefined;
        }
        const orderIds = this._currentOrders.get(cache.agvId);
        if (!orderIds) {
            return;
        }
        const orderUpdateIds = orderIds.get(cache.order.orderId);
        if (!orderUpdateIds) {
            return;
        }
        orderUpdateIds.delete(cache.order.orderUpdateId);
        if (orderUpdateIds.size === 0) {
            orderIds.delete(cache.order.orderId);
            if (orderIds.size === 0) {
                this._currentOrders.delete(cache.agvId);
            }
        }
    }
    _getOrderStateCache(agvId, orderId, orderUpdateId) {
        const orderIds = this._currentOrders.get(agvId);
        if (!orderIds) {
            return undefined;
        }
        const orderUpdateIds = orderIds.get(orderId);
        if (!orderUpdateIds) {
            return undefined;
        }
        return orderUpdateIds.get(orderUpdateId);
    }
    _getLastAssignedOrderStateCache(agvId) {
        const orderIds = this._currentOrders.get(agvId);
        if (!orderIds) {
            return undefined;
        }
        return orderIds["lastCache"];
    }
    _getLastActiveOrderStateCache(cache) {
        let nextCache = cache.lastCache;
        do {
            const lastCache = this._getOrderStateCache(cache.agvId, nextCache.order.orderId, nextCache.order.orderUpdateId);
            if (lastCache === nextCache) {
                return lastCache;
            }
            nextCache = nextCache.lastCache;
        } while (nextCache !== undefined);
        return nextCache;
    }
    _initCachedActions(cache) {
        if (!cache.mappedActions) {
            cache.mappedActions = new Map();
            for (const node of cache.order.nodes) {
                if (!node.released) {
                    break;
                }
                for (const action of node.actions) {
                    cache.mappedActions.set(action.actionId, [action, node]);
                }
            }
            for (const edge of cache.order.edges) {
                if (!edge.released) {
                    break;
                }
                for (const action of edge.actions) {
                    cache.mappedActions.set(action.actionId, [action, edge]);
                }
            }
        }
        if (!cache.lastActionStates) {
            cache.lastActionStates = new Map();
        }
    }
    _isOrderProcessed(cache, state) {
        let isProcessed = false;
        if (state.nodeStates.length === 0 && state.edgeStates.length === 0) {
            isProcessed = true;
        }
        else if (state.nodeStates.every(s => !s.released) && state.edgeStates.every(s => !s.released)) {
            isProcessed = undefined;
        }
        else {
            return false;
        }
        for (const [, [action]] of cache.mappedActions) {
            const as = cache.lastActionStates.get(action.actionId);
            if (as === undefined || (as.actionStatus !== __1.ActionStatus.Finished && as.actionStatus !== __1.ActionStatus.Failed)) {
                return false;
            }
        }
        return isProcessed;
    }
    _isOrderCanceling(cache, state, cancelStatus) {
        const actionStateCaches = this._currentInstantActions.get(cache.agvId);
        if (actionStateCaches) {
            for (const [actionId, actionStateCache] of actionStateCaches) {
                if (actionStateCache.action.actionType === "cancelOrder") {
                    const as = state.actionStates.find(s => s.actionId === actionId);
                    return as !== undefined && cancelStatus.includes(as.actionStatus);
                }
            }
        }
        return false;
    }
    _getNode(order, nodeId, sequenceId) {
        return order.nodes.find(n => n.nodeId === nodeId && n.sequenceId === sequenceId);
    }
    _getNextEdge(order, node) {
        return order.edges.find(e => e.startNodeId === node.nodeId && e.sequenceId === node.sequenceId + 1);
    }
    _getNextReleasedEdge(order, node) {
        return order.edges.find(e => e.released && e.startNodeId === node.nodeId && e.sequenceId === node.sequenceId + 1);
    }
    _getEdgeStartNode(order, edge) {
        return order.nodes.find(n => n.nodeId === edge.startNodeId && n.sequenceId === edge.sequenceId - 1);
    }
    _getEdgeEndNode(order, edge) {
        return order.nodes.find(n => n.nodeId === edge.endNodeId && n.sequenceId === edge.sequenceId + 1);
    }
    _areAllBlockingActionsEnded(node, state) {
        const isActionEnded = (action) => {
            const as = state.actionStates.find(s => s.actionId === action.actionId);
            return as !== undefined && (as.actionStatus === __1.ActionStatus.Finished || as.actionStatus === __1.ActionStatus.Failed);
        };
        return node.actions.every(a => a.blockingType === __1.BlockingType.None || isActionEnded(a));
    }
    _updateEdgeStateChanges(edge, startNode, endNode, cache, state) {
        const reportChanges = (changes) => {
            if (cache.edgeStateChangeInvocations === undefined) {
                cache.edgeStateChangeInvocations = 0;
            }
            cache.edgeStateChangeInvocations++;
            this.debug("onEdgeTraversing %o with changes %o for cache %j", edge, changes, cache);
            if (cache.eventHandler.onEdgeTraversing) {
                cache.eventHandler.onEdgeTraversing(edge, startNode, endNode, changes, cache.edgeStateChangeInvocations, { order: cache.order, agvId: cache.agvId, state });
            }
        };
        if (cache.lastEdgeStateChanges === undefined) {
            cache.lastEdgeStateChanges = {
                distanceSinceLastNode: state.distanceSinceLastNode,
                driving: state.driving,
                newBaseRequest: state.newBaseRequest,
                operatingMode: state.operatingMode,
                paused: state.paused,
                safetyState: state.safetyState,
            };
            reportChanges(cache.lastEdgeStateChanges);
            return;
        }
        const currentChanges = cache.lastEdgeStateChanges;
        const newDeltas = {};
        let hasChanges = false;
        if (currentChanges.distanceSinceLastNode !== state.distanceSinceLastNode) {
            currentChanges.distanceSinceLastNode = newDeltas.distanceSinceLastNode = state.distanceSinceLastNode;
            hasChanges = true;
        }
        if (currentChanges.driving !== state.driving) {
            currentChanges.driving = newDeltas.driving = state.driving;
            hasChanges = true;
        }
        if (currentChanges.newBaseRequest !== state.newBaseRequest) {
            currentChanges.newBaseRequest = newDeltas.newBaseRequest = state.newBaseRequest;
            hasChanges = true;
        }
        if (currentChanges.operatingMode !== state.operatingMode) {
            currentChanges.operatingMode = newDeltas.operatingMode = state.operatingMode;
            hasChanges = true;
        }
        if (currentChanges.paused !== state.paused) {
            currentChanges.paused = newDeltas.paused = state.paused;
            hasChanges = true;
        }
        if (currentChanges.safetyState.eStop !== state.safetyState.eStop ||
            currentChanges.safetyState.fieldViolation !== state.safetyState.fieldViolation) {
            currentChanges.safetyState = newDeltas.safetyState = state.safetyState;
            hasChanges = true;
        }
        if (hasChanges) {
            reportChanges(newDeltas);
        }
    }
    _dispatchInstantActionState(actionState, cache, state) {
        var _a;
        this.debug("Dispatching instant action state %o for cache %o with state %j", actionState, cache, state);
        if (actionState.actionStatus !== ((_a = cache.lastActionState) === null || _a === void 0 ? void 0 : _a.actionStatus)) {
            cache.lastActionState = actionState;
            if (actionState.actionStatus === __1.ActionStatus.Finished || actionState.actionStatus === __1.ActionStatus.Failed) {
                this._removeInstantActionStateCache(cache);
            }
            const error = actionState.actionStatus === __1.ActionStatus.Failed ?
                this._getActionError(state.errors, cache.action.actionId, true) :
                undefined;
            this.debug("onActionStateChanged for instant action state %o with error %o for cache %o with state %j", actionState, error, cache, state);
            cache.eventHandler.onActionStateChanged(actionState, error, cache.action, cache.agvId, state);
        }
    }
    _dispatchInstantActionError(actionError, cache, state) {
        this._removeInstantActionStateCache(cache);
        this.debug("onActionError %o for instant action cache %o with state %j", actionError, cache, state);
        cache.eventHandler.onActionError(actionError, cache.action, cache.agvId, state);
    }
    _removeInstantActionStateCache(cache) {
        const actionStateCaches = this._currentInstantActions.get(cache.agvId);
        actionStateCaches.delete(cache.action.actionId);
        if (actionStateCaches.size === 0) {
            this._currentInstantActions.delete(cache.agvId);
        }
    }
    _getInstantActionsValidationError(instanceActionsRef) {
        const ref = this._currentInstantActionsValidationErrors.find(r => r[0] === instanceActionsRef);
        return ref ? ref[1] : undefined;
    }
    _updateInstantActionsValidationError(errors) {
        if (this._currentInstantActionsRef === undefined) {
            return;
        }
        const validationErrors = errors.filter(error => {
            var _a;
            const refs = (_a = error.errorReferences) !== null && _a !== void 0 ? _a : [];
            return error.errorType === __1.ErrorType.InstantActionValidation &&
                refs.some(r => r.referenceKey === "topic" && r.referenceValue === __1.Topic.InstantActions) &&
                !refs.some(r => r.referenceKey === "orderId") &&
                !refs.some(r => r.referenceKey === "actionId");
        });
        const delta = validationErrors.length - this._currentInstantActionsValidationErrors.length;
        if (delta > 0) {
            this._currentInstantActionsValidationErrors.push(...validationErrors.slice(validationErrors.length - delta)
                .map((e, i) => [this._currentInstantActionsRef - i, e]));
        }
        else if (delta < 0) {
            this._currentInstantActionsValidationErrors.splice(0, -delta);
        }
    }
    _getActionError(errors, actionId, asInstantAction) {
        return errors.find(e => {
            var _a;
            const refs = (_a = e.errorReferences) !== null && _a !== void 0 ? _a : [];
            return refs.some(r => r.referenceKey === "actionId" && r.referenceValue === actionId) &&
                refs.some(r => r.referenceKey === "topic" &&
                    r.referenceValue === (asInstantAction ? __1.Topic.InstantActions : __1.Topic.Order));
        });
    }
}
exports.MasterController = MasterController;
