/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
import { Action, ActionState, AgvId, ClientOptions, Edge, Error, Headerless, InstantActions, MasterControlClient, Node, Order, State } from "..";
/**
 * Represents context information of an order event.
 *
 * @category Master Controller
 */
export interface OrderContext {
    /**
     * The originally assigned order (without header information).
     */
    readonly order: Headerless<Order>;
    /**
     * Identifies the AGV this state originates from.
     */
    readonly agvId: AgvId;
    /**
     * The associated raw State object as published by the AGV.
     */
    readonly state: State;
}
/**
 * A subset of `State` properties for which changes are reported while an edge
 * is being traversed (used by callback `OrderEventHandler.edgeTraversing`).
 */
export type EdgeStateChanges = Partial<Pick<State, "distanceSinceLastNode" | "driving" | "newBaseRequest" | "operatingMode" | "paused" | "safetyState">>;
/**
 * Defines distinct callback functions invoked by the master controller whenever
 * the state of an assigned order changes.
 *
 * @category Master Controller
 */
export interface OrderEventHandler {
    /**
     * Invoked once when the assigned order has been processed successfully,
     * canceled successfully (by instant action "cancelOrder"), or rejected with
     * an error in the first place because the order is not executable by the
     * AGV.
     *
     * @remarks
     * An order is processed if all the order's base nodes/edges have been
     * traversed and all base node/edge actions have been finished or failed.
     * Yet, the order may still be active if it contains horizon nodes/edges. In
     * such a case, you can then assign an order update or cancel the order.
     *
     * After this callback has been invoked, no more callbacks related to the
     * assigned order are invoked afterwards. Events on a subsequent order
     * update are emitted on the event handlers of the newly assigned order
     * update.
     *
     * @param withError an Error object if order has been rejected in the first
     * place because it is not executable; otherwise `undefined`
     * @param byCancelation `true` if executing order has been canceled before
     * this callback is invoked; otherwise `false`
     * @param active `true` if order is still active after processing, otherwise
     * `false`
     * @param context context information of the order event
     */
    onOrderProcessed(withError: Error, byCancelation: boolean, active: boolean, context: OrderContext): void;
    /**
     * Invoked whenever an order's node has been traversed (optional).
     *
     * An order (base) node is traversed when the AGV has reached the node's
     * target position and the node's actions are being triggered.
     *
     * @remarks This callback is only triggered for base nodes, not for horizon
     * nodes.
     *
     * @param node the target node
     * @param nextEdge the released or unreleased edge following the traversed
     * node or `undefined` if no such edge exists.
     * @param nextNode the released or unreleased end node of the edge following
     * the traversed node or `undefined` if no such node exists.
     * @param context context information of the order event
     */
    onNodeTraversed?(node: Node, nextEdge: Edge, nextNode: Node, context: OrderContext): void;
    /**
     * Invoked to report changes in certain State properties while an order's
     * edge is being traversed (optional).
     *
     * Changes are being reported for the following State properties:
     * - `distanceSinceLastNode`
     * - `driving`
     * - `newBaseRequest`
     * - `operatingMode`
     * - `paused`
     * - `safetyState`
     *
     * Note that only the delta changes are reported relative to the previous
     * edgeTraversing event. On the first event, the current values of all State
     * properties as defined above are reported.
     *
     * @remarks The first invocation of this event handler is triggered as soon
     * as the AGV is ready to traverse the edge. In this case, the driving state
     * can still be false.
     *
     * @param edge the traversing edge
     * @param startNode the start node of the traversing edge
     * @param endNode the end node of the traversing edge
     * @param stateChanges edge-related State properties that have changed
     * @param invocationCount the one-based number of invocations of this
     * callback for the current traversing edge (starts with 1 for the first
     * invocation)
     * @param context context information of the order event
     */
    onEdgeTraversing?(edge: Edge, startNode: Node, endNode: Node, stateChanges: EdgeStateChanges, invocationCount: number, context: OrderContext): void;
    /**
     * Invoked whenever an order's edge has been traversed (optional).
     *
     * An order (base) edge is traversed when the AGV has reached the edge's end
     * node target position and all the edge's active actions are being
     * terminated.
     *
     * @remarks This callback is only triggered for base edges, not for horizon
     * edges.
     *
     * @param edge the traversed edge
     * @param startNode the start node of the traversed edge
     * @param endNode the end node of the traversed edge
     * @param context context information of the order event
     */
    onEdgeTraversed?(edge: Edge, startNode: Node, endNode: Node, context: OrderContext): void;
    /**
     * Invoked whenever an order's node or edge action state has changed
     * (optional).
     *
     * @remarks
     * If action state changes to FAILED, an accompanying error object may be
     * reported by the AGV. However, if an order is rejected because an order
     * action is not executable in the first place, this error is reported by
     * the `onOrderProcessed` callback.
     *
     * To check whether the action is on a node or on an edge and to use the
     * `target` parameter in a type-safe way, discriminate by `("nodeId" in
     * target)` or `("edgeId" in target)`, respectively.
     *
     * @param actionState the new action state
     * @param withError an Error object in case a failed action reports an
     * error; otherwise undefined
     * @param action the related action
     * @param target the node or edge related to the action
     * @param context context information of the order event
     */
    onActionStateChanged?(actionState: ActionState, withError: Error, action: Action, target: Node | Edge, context: OrderContext): void;
}
/**
 * Defines distinct callback functions invoked by the master controller whenever
 * the state of an initiated instant action changes.
 *
 * @category Master Controller
 */
export interface InstantActionEventHandler {
    /**
     * Invoked whenever an instant action state has changed.
     *
     * If action state changes to FAILED, an accompanying error object may be
     * reported by the AGV.
     *
     * @param actionState the new action state
     * @param withError an Error object in case a failed action reports an
     * error; otherwise undefined
     * @param action the related instant action
     * @param agvId identifies the AGV this state change originates from
     * @param state the associated raw State object as published by the AGV
     */
    onActionStateChanged(actionState: ActionState, withError: Error, action: Action, agvId: AgvId, state: State): void;
    /**
     * Invoked whenever an error is reported for an instant action that is
     * rejected because it cannot be executed by the AGV in the first place.
     *
     * @remarks If the action starts executing and eventually fails with an
     * error, such an error is reported by the handler `onActionStateChanged`.
     *
     * @param error the Error object
     * @param action the related instant action
     * @param agvId identifies the AGV this error originates from
     * @param state the associated raw State object as published by the AGV
     */
    onActionError(error: Error, action: Action, agvId: AgvId, state: State): void;
}
/**
 * Defines configuration options of a master controller.
 *
 * @category Master Controller
 */
export interface MasterControllerOptions {
    /**
     * Identity of the AGV(s) which should be controlled by this master
     * controller (optional).
     *
     * If not specified, the value defaults to `{}`, i.e. to all AGVs within the
     * common communication namespace as defined by
     * `ClientOptions.interfaceName`.
     */
    targetAgvs?: Partial<AgvId>;
}
/**
 * Implements the common control logic and interaction flows on the coordination
 * plane (master control) as defined by the VDA 5050 specification. This
 * includes assigning orders and initiating instant actions, as well as
 * reporting back their execution state.
 *
 * Together with its counterpart on the vehicle plane, it builds a high-level
 * abstraction layer of the complex control logic defined in the VDA 5050
 * specification.
 *
 * @remarks
 * This VDA 5050 implementation requires Node, Edge, and Action objects to
 * specify unique IDs. You should always use the `createUuid` function to create
 * such an ID as it generates globally unique IDs.
 *
 * This VDA 5050 implementation requires order rejection errors related to
 * non-supported or non-executable node or edge actions to report an error with
 * `errorType: "orderError"`, whereas order action errors reported for failed
 * actions must specify a different error type (e.g. `errorType:
 * "orderActionError"`) to make them distinguishable.
 *
 * @category Master Controller
 */
export declare class MasterController extends MasterControlClient {
    private readonly _currentOrders;
    private readonly _currentInstantActions;
    private _currentInstantActionsRef;
    private _currentInstantActionsValidationErrors;
    private readonly _controllerOptions;
    /**
     * Creates an instance of `MasterController`, a subclass of
     * `MasterControlClient`.
     *
     * @param clientOptions configuration options for the `MasterControlClient`
     * @param controllerOptions configuration options for the `MasterController`
     */
    constructor(clientOptions: ClientOptions, controllerOptions: MasterControllerOptions);
    /**
     * Gets the master controller configuration options as a readonly object
     * with default values filled in for options not specified.
     */
    get controllerOptions(): Readonly<Required<MasterControllerOptions>>;
    /**
     * Assign an order (including an order update or a stitching order) to be
     * executed by an AGV and report back changes in the order's execution
     * state.
     *
     * An assigned order must fulfil the following characteristics to be
     * executable by an AGV:
     * - New order: Previously assigned order (if any) has terminated and new
     *   order has different orderId.
     * - Order update: Previously assigned order has terminated and order update
     *   has same orderId, a greater orderUpdateId, and a first base node
     *   matching lastNodeId/lastNodeSequenceId of current State followed by
     *   other base/horizon nodes.
     * - Stitching order: Previously assigned order has not yet terminated and
     *   the stitching order extends the base of it thereby specifying either a
     *   new orderId or reusing the previous orderId with a greater
     *   orderUpdateId.
     *
     * @remarks
     * If a stitching order is assigned, the event handler callbacks of the
     * previously assigned order are just triggered for State events still
     * emitted on the previous order. Any State events triggered on the new
     * order are emitted on the event handler callbacks of the newly assigned
     * stitching order. Note that Node, Edge, and Action objects passed by these
     * event handlers may refer to the order context of the previous order.
     *
     * Any order that has the same AGV target and the same orderId and
     * orderUpdateId as a currently active order will be discarded, resolving
     * `undefined`. The given event handler callbacks will never be invoked.
     * Instead, the previously registered callbacks continue to be invoked.
     *
     * Any Node, Edge, Action, and Order object passed to order event handler
     * callbacks is guaranteed to be reference equal to the original object
     * passed to this method. However, AgvId objects passed are never reference
     * equal, but value equal.
     *
     * @param agvId identifies the target AGV
     * @param order the headerless order to be executed
     * @param eventHandler callbacks that report order-related events
     * @returns a promise that resolves the order object with header when
     * published successfully or `undefined` when order has been discarded, and
     * rejects if order is not valid or controller has not been started
     */
    assignOrder(agvId: AgvId, order: Headerless<Order>, eventHandler: OrderEventHandler): Promise<Order>;
    /**
     * Initiate instant actions to be executed by an AGV and report back changes
     * on the execution state of the actions.
     *
     * @remarks Any Action and AgvId object passed to instant action event
     * handler callbacks is guaranteed to be reference equal to the original
     * object passed to this method.
     *
     * @param agvId identifies the target AGV
     * @param instantActions a headerless instant actions object
     * @param eventHandler callback that reports instant action related events
     * @returns a promise that resolves an instant actions object with header
     * when published successfully and rejects if given instant actions object
     * is not valid or controller has not been started
     */
    initiateInstantActions(agvId: AgvId, instantActions: Headerless<InstantActions>, eventHandler: InstantActionEventHandler): Promise<InstantActions>;
    /**
     * Whenever master controller starts up it subscribes to State topics of the
     * target AGVs configured in controller options.
     */
    protected onStarted(): Promise<void>;
    private _controllerOptionsWithDefaults;
    private _dispatchState;
    private _dispatchOrderState;
    private _addOrderStateCache;
    private _removeOrderStateCache;
    private _getOrderStateCache;
    private _getLastAssignedOrderStateCache;
    private _getLastActiveOrderStateCache;
    private _initCachedActions;
    private _isOrderProcessed;
    private _isOrderCanceling;
    private _getNode;
    private _getNextEdge;
    private _getNextReleasedEdge;
    private _getEdgeStartNode;
    private _getEdgeEndNode;
    private _areAllBlockingActionsEnded;
    private _updateEdgeStateChanges;
    private _dispatchInstantActionState;
    private _dispatchInstantActionError;
    private _removeInstantActionStateCache;
    private _getInstantActionsValidationError;
    private _updateInstantActionsValidationError;
    private _getActionError;
}
