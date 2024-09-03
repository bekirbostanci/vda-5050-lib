/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
import { Action, ActionState, ActionStatus, AgvClient, AgvId, AgvPosition, BatteryState, ClientOptions, Edge, Error, ErrorReference, Factsheet, Headerless, Node, OperatingMode, Order, SafetyStatus, State, Trajectory, Velocity } from "..";
/**
 * Represents context information needed to perform initializations on an AGV
 * adapter when it is attached.
 *
 * @category AGV Controller
 */
export interface AttachContext {
    /**
     * Callback to be invoked by the AGV adapter when initialization has
     * completed and the adapter is ready to process any of the other handler
     * functions defined in the `AgvAdapter` interface.
     *
     * @param initialState initial partial state to be reported on attachment
     */
    attached(initialState: Partial<Headerless<State>>): void;
}
/**
 * Represents context information needed to perform deinitializations on an AGV
 * adapter when it is detached.
 *
 * @category AGV Controller
 */
export interface DetachContext {
    /**
     * Callback to be invoked by the AGV adapter when deinitialization has
     * completed and the adapter has terminated its operations.
     *
     * @param detachState partial state to be reported on detachment
     */
    detached(detachState: Partial<Headerless<State>>): void;
}
/**
 * Represents change information about action status, including result
 * description, error description, and linked state (if applicable).
 *
 * @category AGV Controller
 */
export interface ActionStatusChangeInfo {
    /**
     * The changed action status.
     */
    readonly actionStatus: ActionStatus;
    /**
     * A result reported if action status is FINISHED (optional).
     */
    readonly resultDescription?: string;
    /**
     * An additional error state is reported with the given error description if action
     * fails and status is FAILED (optional).
     */
    readonly errorDescription?: string;
    /**
     * Specifies a partial state that must be updated together with the action
     * status change (optional).
     */
    readonly linkedState?: Partial<Headerless<State>>;
}
/**
 * Defines the scope of an action, either `"instant"`, `"node"`, or `"edge"`.
 *
 * @category AGV Controller
 */
export type ActionScope = "instant" | "node" | "edge";
/**
 * Represents context information of a node, edge, or instant action to be
 * processed by an `executeAction`, `finishEdgeAction`, or `cancelAction`
 * handler.
 *
 * @category AGV Controller
 */
export interface ActionContext {
    /**
     * The context's action.
     */
    readonly action: Action;
    /**
     * Defines whether the context's action is an instant, node, or edge action.
     */
    readonly scope: ActionScope;
    /**
     * Determines whether the AGV must stop driving before executing the action
     * (optional, only specified in the context of an `executeAction` handler).
     *
     * If specified as `true` driving must be stopped; if `false` the AGV must
     * keep its current driving state.
     *
     * @remarks This parameter is not specified for `finishEdgeAction`,
     * `isActionExecutable`, and `cancelAction` handlers.
     */
    readonly stopDriving?: boolean;
    /**
     * Specifies the node if the context's action is a node action; otherwise
     * this property is not defined.
     */
    readonly node?: Node;
    /**
     * Specifies the edge if the context's action is an edge action; otherwise
     * this property is not defined.
     */
    readonly edge?: Edge;
    /**
     * Specifies the start node of the edge if the context's action is an edge
     * action; otherwise this property is not defined.
     */
    readonly edgeStartNode?: Node;
    /**
     * Specifies the end node of the edge if the context's action is an edge
     * action; otherwise this property is not defined.
     */
    readonly edgeEndNode?: Node;
    /**
     * Specifies the `orderId` of an order's node or edge action; the active
     * `orderId` for instant actions if one is currently active; otherwise this
     * property is not defined.
     */
    readonly activeOrderId?: string;
    /**
     * Callback to be invoked by the AGV adapter whenever the action transitions
     * to a new action status.
     *
     * This method should be invoked according to the progress of the action,
     * passing in an updated action status together with the result description,
     * error description, and linked partial state (if applicable).
     *
     * @remarks
     * This parameter is not defined for the `isActionExecutable` handler.
     *
     * When the action transitions into status FAILED an additional error state
     * can be reported by specifying an error description.
     *
     * @param status new action status with optional result description, error
     * description, and linked state
     */
    updateActionStatus(statusChange: ActionStatusChangeInfo): void;
}
/**
 * Represents context information to check whether a route can be traversed by
 * the AGV.
 *
 * @category AGV Controller
 */
export interface RouteTraversableContext {
    /**
     * The nodes to be traversed.
     */
    readonly nodes: Node[];
    /**
     * The edges to be traversed.
     */
    readonly edges: Edge[];
}
/**
 * Represents context information of a `stopTraverse` operation handler.
 *
 * @category AGV Controller
 */
export interface StopTraverseContext {
    /**
     * Callback to be invoked once by the AGV adapter if, due to AGV's
     * capabilities, it couldn't stop immediately on the current node or in
     * between nodes but has to drive to the next node.
     *
     * After reaching the next node, the AGV must stop and the callback
     * `stopped` defined by this interface must be invoked.
     *
     * @remarks When invoked the parameter `nextNode` can be easily retrieved by
     * the AGV adapter from the edge context currently being traversed, as
     * defined by `TraverseContext.endNode`.
     */
    drivingToNextNode(nextNode: Node): void;
    /**
     * Callback to be invoked once by the AGV adapter when the AGV has stopped
     * driving in response to the invocation of the `stopTraverse`
     * operation handler.
     *
     * If the AGV has to drive to the next node upon order cancelation, this
     * handler must be invoked on arrival instead of the
     * `TraverseContext.edgeTraversed` handler.
     */
    stopped(): void;
}
/**
 * Represents context information of an edge traversal.
 *
 * @category AGV Controller
 */
export interface TraverseEdgeContext {
    /**
     * The edge to be traversed.
     */
    readonly edge: Edge;
    /**
     * The start node of the edge to be traversed.
     */
    readonly startNode: Node;
    /**
     * The end node of the edge to be traversed.
     */
    readonly endNode: Node;
    /**
     * Defines the edge trajectory path calculated by the AGV or master control
     * (optional).
     *
     * If not specified or `undefined`, the AGV cannot process trajectories or
     * calculates the route on the fly when the `traverse` handler is invoked.
     */
    readonly trajectory?: Trajectory;
    /**
     * Callback to be invoked once by the AGV adapter when the edge of this
     * context has been completely traversed.
     */
    edgeTraversed(): void;
}
/**
 * Represents context information of a trajectory, including its edge, and its
 * edge's start and end nodes.
 *
 * @category AGV Controller
 */
export interface TrajectoryContext {
    /**
     * The trajectory edge.
     */
    readonly edge: Edge;
    /**
     * The start node of the trajectory edge.
     */
    readonly startNode: Node;
    /**
     * The end node of the trajectory edge.
     */
    readonly endNode: Node;
}
/**
 * Defines a plug-in commanding interface for performing AGV specific operations
 * to be registered with an AGV controller.
 *
 * The adapter's functions provide an abstract interface that maps generic
 * operations to an AGV specific navigation and control interface. These
 * operations include executing or canceling a node action, an edge action, or
 * an instant action, traversing/navigating an edge, and calculating trajectory
 * paths.
 *
 * Concrete implementations of AGV adapters are usually provided by an
 * integrator or by the vendor designing the vehicle control interface.
 *
 * @remarks An AGV adapter and its logic is realized as a class that implements
 * this interface. This class must provide a constructor that conforms to the
 * interface `AgvAdapterConstructor`. Using dependeny injection, this class type
 * is passed as a configuration option to the AGV controller (see
 * `AgvControllerOptions.agvAdapterType`) which creates an instance of the
 * adapter class with appropriate constructor parameters.
 *
 * @category AGV Controller
 */
export interface AgvAdapter {
    /**
     * The AGV controller this adapter is associated with.
     *
     * Used to invoke state update methods defined by the AGV controller.
     */
    readonly controller: AgvController;
    /**
     * Defines the name of this adapter used for identification and display
     * purposes.
     */
    readonly name: string;
    /**
     * Defines the protocol version number of this adapter, a positive integer.
     *
     * Increment this version whenever you make changes to the adapter protocol.
     *
     * @remarks The API version of this adapter must match (i.e. equal) the API
     * version of the associated AGV controller. If both versions differ, an
     * error is thrown when the adapter is instantiated.
     */
    readonly apiVersion: number;
    /**
     * Registers a handler that is invoked once by the associated controller
     * when the adapter should perform initializations and connect to the AGV
     * navigation & control interface.
     *
     * The handler function should compute initial vehicles states and report
     * them back to the controller after initialization is complete through the
     * callback `AttachContext.attached`. Until this callback is invoked, the
     * controller won't invoke any of the other handler functions defined in
     * this interface.
     *
     * @param context context information for attachment
     */
    attach(context: AttachContext): void;
    /**
     * Registers a handler that is invoked once by the associated controller
     * when the adapter should perform deinitializations and disconnect from the
     * AGV navigation & control interface.
     *
     * The handler function may compute final vehicles states and report them
     * back to the controller after deinitialization is complete through the
     * callback `DetachContext.detached`. After this callback is invoked, the
     * controller won't invoke any of the other handler functions defined in
     * this interface.
     *
     * @param context context information for detachment
     */
    detach(context: DetachContext): void;
    /**
     * Registers a handler that is invoked by the associated controller to check
     * synchronously whether a given node, edge, or instant action can be
     * executed principally.
     *
     * The handler function should return a non-empty array of error references
     * if the action cannot be executed and must be rejected. For example, if an
     * action cannot be completed because of external factors (e.g. no load at
     * expected position), or if an action conflicts with the AGV's currently
     * active order (e.g. instant action says to lower fork while order says to
     * raise fork), or if the order contains actions the vehicle cannot perform
     * (e.g. lifting height higher than maximum lifting height, or lifting
     * actions although no stroke is installed).
     *
     * If the action can be executed, the handler should return an empty array
     * or `undefined`.
     *
     * @remarks
     * You should not include the `actionId` and the `actionType` as error
     * references as these are added automatically by the controller. If the
     * error was caused by erroneous action parameters, include a list of
     * parameters in the reference.
     *
     * If an instant action is not executable in principle it will be rejected
     * with an error by the AGV controller. If a node or edge action is not
     * executable in principle, the order will be rejected by the AGV
     * controller. In the latter case all order node and edge actions are
     * checked for executability _before_ the order is carried out.
     *
     * @param context context information of a node, edge, or instant action to
     * be checked for execution
     * @returns an array of error references if action cannot be executed; an
     * empty array or `undefined` if action can be executed
     */
    isActionExecutable(context: ActionContext): ErrorReference[];
    /**
     * Registers a handler that is invoked by the associated controller whenever
     * an instant, node, or edge action is to be executed.
     *
     * While the action is executed, the callback `context.updateActionStatus`
     * must be invoked whenever the action transitions to a new status, passing
     * in the new action status together with result description and linked
     * partial state (if applicable).
     *
     * If the action context of an action specifies `true` on the `stopDriving`
     * property the AGV must stop driving and eventually invoke
     * `controller.updateDrivingState` before executing the action; otherwise
     * the current driving state must be kept.
     *
     * @remarks
     * For a node or edge action, the initial action status WAITING is already
     * preset on the controller's current state. For an instant action, no
     * action status is preset on the current state. In both cases, the action
     * handler must initially transition to the action's initial state, either
     * INITIALIZING or RUNNING (or PAUSED if pause mode is activated), FINISHED,
     * or FAILED.
     *
     * If pause mode is active, the action to be executed should transition to
     * PAUSED state (immediately or after initializing/running, if needed). If
     * pause mode is deactivated, the action should transition to the previous
     * status again.
     *
     * For instant actions 'startPause' and 'stopPause' this handler must
     * pause/resume all other actions, and update their action status and linked
     * state `paused` accordingly. Node processing of an active order is
     * suspended and resumed automatically by the AGV controller. Edge traversal
     * must be suspended and resumed by the AGV adapter.
     *
     * Note that the instant actions 'stateRequest' and 'cancelOrder' are never
     * dispatched to this handler as they are handled by the AGV controller
     * itself.
     *
     * @param context context information of a node, edge, or instant action to
     * be executed
     */
    executeAction(context: ActionContext): void;
    /**
     * Registers a handler that is invoked by the associated controller whenever
     * a not yet finished or failed node or edge action of an active order is to
     * be canceled.
     *
     * If the action cannot be interrupted it should continue running until
     * finished or failed. If the action can be interrupted it should be
     * canceled and action status FAILED should be reported via
     * `context.updateActionStatus`.
     *
     * @remarks This handler function is only invoked for node and edge actions
     * previously scheduled by the `executeAction` handler and not yet finished
     * or failed, i.e. for actions that are either in status INITIALIZING,
     * RUNNING, or PAUSED.
     *
     * @param context context information of a node or edge action to be
     * canceled
     */
    cancelAction(context: ActionContext): void;
    /**
     * Registers a handler that is invoked by the associated controller whenever
     * an active edge action (i.e. one with status unequal FINISHED or FAILED)
     * must be terminated.
     *
     * @remarks The registered handler is invoked whenever a node is traversed
     * and any active actions on the edge leading up to that node must be
     * terminated. The handler should finish or cancel the action and report an
     * updated action status FINISHED or FAILED via
     * `context.updateActionStatus`.
     *
     * @param context context information of an edge action to be finished
     */
    finishEdgeAction(context: ActionContext): void;
    /**
     * Registers a handler that is invoked by the associated controller whenever
     * it needs to check whether a given node's position is within the allowed
     * deviation range of the current AGV position.
     *
     * The handler function should return an array of error references if the
     * node is not within the deviation range by checking the node properties x,
     * y, theta, mapId, allowedDeviationTheta, and allowedDeviationXy against
     * the current AGV position. Otherwise, the handler should return an empty
     * array or `undefined`.
     *
     * @remarks You should not include the `nodeId` as error reference as it is
     * added automatically by the controller. Instead, include all node
     * property-value pairs that fail the check.
     *
     * @param node a Node object
     * @returns an array of error references if node is not within deviation
     * range; an empty array or `undefined` otherwise
     */
    isNodeWithinDeviationRange(node: Node): ErrorReference[];
    /**
     * Registers a handler that is invoked by the associated controller to check
     * synchronously whether AGV can traverse a given route with regard to
     * vehicle-specific constraints on node/edge properties that must be
     * validated by the AGV adapter as the AGV controller is not aware of them.
     *
     * The nodes and edges passed to this handler are guaranteed to be
     * well-formed and valid with respect to the proper sequence of base/horizon
     * nodes and edges.
     *
     * Node and edge actions must not be checked by this handler; they are
     * checked individually by the handler `isActionExecutable`.
     *
     * The handler function should return an array of error references if the
     * route cannot be traversed. For example, if an edge has fields that the
     * vehicle cannot use (e.g. trajectory) or misses fields it requires (e.g.
     * nodePosition with mapId for free navigation) or fields it doesn't support
     * (e.g. rotationAllowed). Otherwise, the handler should return an empty
     * array or `undefined`.
     *
     * @param context context information with the route
     * @returns an array of error references if route cannot be traversed; an
     * empty array or `undefined` otherwise
     */
    isRouteTraversable(context: RouteTraversableContext): ErrorReference[];
    /**
     * Registers a handler that is invoked by the associated controller to
     * traverse a given edge with a given start and end node using an (optional)
     * trajectory.
     *
     * When the handler function is invoked the AGV should drive along the given
     * trajectory (if specified) or by free navigation (if not specified),
     * invoking `controller.updateDrivingState` if needed. However, if pause
     * mode is activated the AGV has to postpone traversal until pause mode is
     * deactivated by instant action 'stopPause'.
     *
     * When the given edge has been traversed completely, the callback
     * `context.edgeTraversed` must be invoked. Until this callback has been
     * called it is guaranteed that no other invocation of this handler occurs.
     *
     * @remarks
     * While traversing an edge the AGV adapter must handle activation and
     * deactivation of pause mode (triggered either by instant actions
     * 'startPause/stopPause' or by a hardware button) that affects driving
     * state and update it accordingly.
     *
     * This handler must take edge and end node orientation changes into account
     * if supported by the AGV. If an edge orientation is required and rotation
     * is disallowed on the edge, rotate the vehicle before entering the edge,
     * otherwise rotate the vehicle on the edge to the desired ortientation.
     * Upon traversal and if required, the vehicle must be rotated on the end
     * node according to node's theta angle.
     *
     * @param context context information of an edge traversal
     */
    traverseEdge(context: TraverseEdgeContext): void;
    /**
     * Registers a handler that is invoked by the associated controller whenever
     * the AGV should stop driving while the active order is being canceled and
     * after all node/edge actions of this order have already been canceled.
     *
     * If the AGV is on a node or can stop if in between nodes, it should stop
     * gracefully; otherwise it should continue driving to the next node, and
     * automatically stop on arrival. In all these cases the `traverse`
     * handler's callback `context.edgeTraversed` should not be invoked any more
     * (even if you do invoke it, it is ignored by the AGV controller).
     *
     * The handler function must invoke the callback `context.stopped` once as
     * soon as the AGV has stopped driving, even if the vehicle is already
     * stopped for another reason. After reporting this state the AGV should be
     * able to receive a new order. Until this callback has been called it is
     * guaranteed that no other invocation of this handler occurs.
     *
     * If the AGV's capabilities require it to drive to the next node before
     * stopping, the adapter must invoke both the callback
     * `context.drivingToNextNode` immediately and the callback
     * `context.stopped` after stopping on arrival.
     *
     * @remarks It is guaranteed that whenever this function is called all
     * scheduled node and edge actions of the order to be canceled have ended,
     * i.e. are either in status FINISHED or FAILED.
     *
     * @param context context information for reporting when AGV has stopped
     * driving.
     */
    stopTraverse(context: StopTraverseContext): void;
    /**
     * Registers a handler that is invoked by the associated controller to
     * synchronously calculate the trajectory for a given edge (optional).
     *
     * @remarks This handler is only required if the AGV should precalculate the
     * trajectory path of all order edges by itself whenever an order arrives.
     * The handler is invoked on all order edges (including horizon edges) in
     * the given edges order in series. Do not specify a handler function if the
     * AGV should determine the route on the fly when an edge is being traversed
     * by invoking the `traverse` handler.
     *
     * @param context context information of a trajectory
     * @returns the calculated trajectory object
     */
    trajectory?(context: TrajectoryContext): Trajectory;
}
/**
 * Defines configuration options common to all AGV adapter implementations.
 *
 * This base interface may be extended by concrete adapter implementations to
 * provide adapter specific options.
 *
 * @category AGV Controller
 */
export interface AgvAdapterOptions {
}
/**
 * A debugger function associated with an AGV adapter.
 *
 * Used to log informational, debug, and error messages. The first argument
 * is a formatter string with printf-style formatting supporting the
 * following directives: `%O` (object multi-line), `%o` (object
 * single-line), `%s` (string), `%d` (number), `%j` (JSON), `%%` (escape).
 *
 * @category AGV Controller
 */
export type AgvAdapterDebugger = (formatter: any, ...args: any[]) => void;
/**
 * Defines the constructor signature for classes that implement the interface
 * `AgvAdapter`.
 *
 * @category AGV Controller
 */
export type AgvAdapterConstructor = new (controller: AgvController, adapterOptions: AgvAdapterOptions, debug: AgvAdapterDebugger) => AgvAdapter;
/**
 * Defines configuration options of an AGV controller.
 *
 * @category AGV Controller
 */
export interface AgvControllerOptions {
    /**
     * Type of the AGV adapter class that should be associated with an AGV
     * controller.
     *
     * @remarks When the AGV controller is created, the given class is
     * automatically instantiated and associated with it.
     */
    agvAdapterType: AgvAdapterConstructor;
    /**
     * Periodic interval in milliseconds the State message should be published
     * at the latest (optional).
     *
     * If not specified, the value defaults to 30000ms.
     */
    publishStateInterval?: number;
    /**
     * Periodic interval in milliseconds the Visualization message should be
     * published (optional).
     *
     * If not specified, the value defaults to 1000ms. If specified as 0 (zero),
     * visualization messages are suppressed, i.e. not published at all.
     */
    publishVisualizationInterval?: number;
    /**
     * Number of `State` messages to be published for an instant action that has
     * ended or errored (optional).
     *
     * This option determines how many times the action state of an instant
     * action that has ended (i.e is either finished or failed) or errored (i.e.
     * is not executable right from the start) should be reported in the
     * `actionStates` array of a published AGV state message.
     *
     * This feature is important to ensure that a published State object is not
     * cluttered with outdated instant action states. The VDA 5050 specification
     * itself doesn't specify when to clean up these action states.
     *
     * If not specified, the value defaults to 5. If value is less than 1
     * exactly one State message is published.
     */
    finalInstantActionStateChangePublishCount?: number;
}
/**
 * Implements the common control logic and interaction flows on the vehicle
 * plane (automated guided vehicle, AGV) as defined by the VDA 5050
 * specification. This includes processing of received orders and instant
 * actions, management of order state and AGV state, as well as providing
 * updated state and visualization data to the master control.
 *
 * Together with its counterpart, the master control controller class
 * `MasterController`, it builds a high-level abstraction layer of the complex
 * business logic defined in the VDA 5050 specification.
 *
 * To keep the VDA 5050 business logic generic and independent of specific types
 * of AGVs, the AGV controller uses plug-ins to adapt to their diverse
 * navigation and control interfaces. A so-called AGV adapter is registered with
 * an AGV controller providing an abstract interface that maps generic
 * controller operations to the concrete control interface of an AGV. These
 * operations include, among others, executing or canceling a node action, an
 * edge action, or an instant action, traversing/navigating an edge, and
 * calculating trajectory paths.
 *
 * This class builds on top of the communication abstraction layer provided by
 * the `AgvClient` class which it extends. This class also provides extension
 * points by protected methods through which behavior can be customized if
 * needed.
 *
 * @remarks
 * Regarding errors reported in state messages, the following conventions are
 * used (see enum `ErrorTypes`):
 * - Order related errors always include the errorReferences "headerId:
 *   order.headerid", "topic: order", "orderId" (and "orderUpdateId" if
 *   applicable) and specify an errorType of "orderError", "orderUpdateError",
 *   "noRouteError", or "validationError".
 * - Order/instant action related errors always include the error reference
 *   "actionId" along with optional references such as "actionParameters".
 * - Order action errors (on failure) always include an errorReference "topic:
 *   order" and the generic errorType "orderActionError".
 * - Instant action errors always include an errorReference "topic:
 *   instantAction" and either an action-specify errorType such as
 *   "noOrderToCancel" or the generic errorType "instantActionError".
 *
 * The AGV controller always overrides the value of the client option
 * `topicObjectValidation.inbound` to `false` so that it can respond with an
 * error state to invalid incoming messages. This means that subclasses of
 * `AgvController` must also validate extension topics explicitely using method
 * `validateTopicObject`.
 *
 * If the AGV controller receives a topic with an invalid object payload, it
 * reports an error state with `errorType: "validationError"` containing the
 * error reference key `topic` (value is `"order"` for orders,
 * `"instantActions"` for instant actions, etc.). If a property `headerId` is
 * present on the received object, it is also included in the error references.
 * Additionally, if present for an order validation error, `"orderId"` is added
 * as error reference.
 *
 * @category AGV Controller
 */
export declare class AgvController extends AgvClient {
    agvId: AgvId;
    /**
     * Special error reference key used to append detail information to an
     * `Error.errorDescription`.
     */
    static readonly REF_KEY_ERROR_DESCRIPTION_DETAIL = "errorDescriptionDetail";
    /**
     * The currently active order (update), the latest completed order, or
     * undefined if no order has been received yet.
     *
     * @remarks
     * Use `hasActiveOrder` to determine whether any current order is active.
     *
     * Use `hasCancelingOrder` to determine whether any current order is being
     * canceled.
     */
    protected currentOrder: Order;
    private _currentState;
    private _currentPausedNode;
    private _currentInstantActions;
    private _instantActionsEndedPublishCount;
    private _instantActionsErroredPublishCount;
    private _cancelOrderContext;
    private _publishStateTimerId;
    private _publishVisualizationIntervalId;
    private readonly _agvAdapter;
    private readonly _controllerOptions;
    private _currentFactsheet;
    /**
     * Creates an instance of `AgvController`, a subclass of `AgvClient`.
     *
     * @param agvId the identity of the AGV this controller represents
     * @param clientOptions configuration options for the `AgvClient`
     * @param controllerOptions configuration options for the `AgvController`
     * @param adapterOptions configurations options for the `AgvAdapter`
     */
    constructor(agvId: AgvId, clientOptions: ClientOptions, controllerOptions: AgvControllerOptions, adapterOptions: AgvAdapterOptions);
    /**
     * Gets the AGV controller configuration options as a readonly object with
     * default values filled in for options not specified.
     */
    get controllerOptions(): Readonly<Required<AgvControllerOptions>>;
    /**
     * Gets the protocol version of the AGV adapter API used by this controller,
     * a positive integer.
     *
     * @remarks The API version of this controller must match (i.e. equal) the
     * API version of the associated adapter. If both versions differ, an error
     * is thrown when the adapter is instantiated.
     */
    get adapterApiVersion(): number;
    /**
     * Gets current state of AGV controller as an immutable object.
     *
     * @remarks
     * The returned state object is immutable, i.e. it is guaranteed to not be
     * changed by this controller. To modify the state maintained by this
     * controller, adapters and subclasses must invoke one of the provided state
     * update functions.
     *
     * The returned state object always includes a timestamp property that
     * corresponds to its latest update time.
     *
     * @returns the current state as an immutable object with latest update
     * timestamp
     */
    get currentState(): Headerless<State>;
    /**
     * Indicates whether the AGV controller has an active order.
     *
     * @remarks An order is considered active if at least one base/horizon node
     * or edge has not yet been traversed or if at least one node/edge action
     * has not yet terminated, i.e. not finished or failed.
     *
     * @returns true if the `currentOrder` is defined and active; false if the
     * latest order has been completed or no order has been received yet.
     */
    get hasActiveOrder(): boolean;
    /**
     * Indicates whether the AGV controller is currently canceling the active
     * order.
     */
    get hasCancelingOrder(): boolean;
    /**
     * Determines whether the given action state represents an instant action.
     *
     * @param state an action state
     * @returns `true` if action state represents an instant action; `false`
     * otherwise
     */
    isInstantActionState(state: ActionState): boolean;
    /**
     * To be invoked by the AGV adapter whenever a new AGV position and/or
     * velocity is available.
     *
     * @remarks The update rate should correspond with the option
     * `publishVisualizationInterval` configured for this AGV controller.
     *
     * @param agvPosition new AGV position (optional)
     * @param velocity new velocity (optional)
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updateAgvPositionVelocity(agvPosition?: AgvPosition, velocity?: Velocity, reportImmediately?: boolean): void;
    /**
     * To be invoked by the AGV adapter whenever a new battery state is
     * available.
     *
     * @param batteryState new battery state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updateBatteryState(batteryState: BatteryState, reportImmediately?: boolean): void;
    /**
     * To be invoked by the AGV adapter whenever the driving/rotating state of
     * the AGV changes.
     *
     * @remarks Other movements of the AGV (e.g. lift movements) are not
     * included here.
     *
     * @param driving new driving state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updateDrivingState(driving: boolean, reportImmediately?: boolean): void;
    /**
     * To be invoked by the AGV adapter whenever the paused state changes,
     * either because of the push of a physical button on the AGV or because of
     * an instant action ('startPause' or 'stopPause').
     *
     * @param paused new paused state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updatePausedState(paused: boolean, reportImmediately?: boolean): void;
    /**
     * To be invoked by the AGV adapter whenever a new base request should be
     * published.
     *
     * This is useful if the AGV is almost at the end of the base and needs to
     * reduce speed if no new base is transmitted. It acts as a trigger for
     * master control to send a new base to prevent unnecessary braking.
     *
     * @param newBaseRequest new newBaseRequest state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to true)
     */
    updateNewBaseRequest(newBaseRequest: boolean, reportImmediately?: boolean): void;
    /**
     * To be invoked by the AGV adapter whenever a new safety status is
     * available.
     *
     * @param safetyStatus new safety status
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to true)
     */
    updateSafetyStatus(safetyStatus: SafetyStatus, reportImmediately?: boolean): void;
    /**
     * To be invoked by the AGV adapter whenever a new operation mode is
     * available.
     *
     * @param operatingMode new operating mode
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to true)
     */
    updateOperatingMode(operatingMode: OperatingMode, reportImmediately?: boolean): void;
    /**
     * To be invoked by the AGV adapter whenever a new factsheet  is
     * available.
     *
     * @param factsheet new factsheet
     */
    updateFactsheet(factsheet: Headerless<Factsheet>): void;
    /**
     * To be invoked by the AGV adapter whenever an error should be added to
     * or removed from state.
     *
     * @param error an Error object
     * @param mode whether to add or remove the given error from state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updateErrors(error: Error, mode: "add" | "remove", reportImmediately?: boolean): void;
    /**
     * To be invoked by the AGV adapter whenever a new partial state is
     * available.
     *
     * @remarks
     * This function should only be used in case none of the other more specific
     * state update functions is applicable; e.g. to update an optional state
     * property such as `loads`, `distanceSinceLastNode`, `information`, etc.
     *
     * If the optional parameter `reportImmediately` is passed as `true`, a new
     * State message is published immediately after updating the state;
     * otherwise the message is published on the next periodic or immediate
     * state update.
     *
     * @param newState new partial state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updatePartialState(newState: Partial<Headerless<State>>, reportImmediately?: boolean): void;
    protected onStarted(): Promise<void>;
    protected onStopping(): Promise<void>;
    /**
     * Invoked whenever the current state of the AGV changes.
     *
     * @remarks To be extended by AgvController subclasses, for example to log
     * state changes. The base method does nothing. A deep copy of the changed
     * state can be retrieved within this method using the `currentState`
     * getter.
     *
     * @param changes partial state properties that have changed
     */
    protected onStateChanged(changes: Partial<Headerless<State>>): void;
    /**
     * Invoked by this AGV controller to trigger execution of the given instant
     * action.
     *
     * The default implementation of this method just invokes the
     * `executeAction` handler function of the registered AGV adapter passing in
     * the given instant action context.
     *
     * @remarks This method provides an extension point for AGV controller
     * subclasses that want to perform additional side effects on the controller
     * side before executing the given instant action.
     *
     * @param context the action context of the instant action
     */
    protected executeInstantAction(context: ActionContext): void;
    private _controllerOptionsWithDefaults;
    private _attachAdapter;
    private _detachAdapter;
    private _subscribeOnStarted;
    private _resetPublishStateTimer;
    private _setupPublishVisualizationInterval;
    private _publishVisualization;
    private _publishCurrentState;
    private _publishFactsheet;
    private _updateState;
    private _mergeState;
    private _cloneState;
    private _findErrorIndex;
    private _areErrorReferencesEqual;
    /**
     * Process order according to VDA 5050 specification.
     *
     * @param order an incoming order
     */
    private _processOrder;
    private _validateOrderConstraints;
    /**
     * Determines whether the start of the given order's new base is the end of
     * the current order's base.
     *
     * @param order a stitching order
     * @returns true, if the stitching order is valid; false otherwise
     */
    private _isOrderBaseStitching;
    /**
     * Determines whether the start of the given order update base is matching
     * the lastNode and lastNodeSequenceId of the current state.
     *
     * @param order an order update
     * @returns true, if the order update is valid; false otherwise
     */
    private _isOrderUpdateBaseStitching;
    private _acceptOrder;
    private _rejectOrder;
    /**
     * Cancel the currently active order.
     *
     * Used in the event of an unplanned change in the base nodes, the order
     * must be canceled by the master control using the instant action
     * 'cancelOrder'.
     *
     * AGV stops as soon as possible. This could be immediately or on the next
     * node depending on the AGV's capabilities. Then the order is deleted. All
     * scheduled actions are canceled.
     *
     * @param context context information of the instant action 'cancelOrder'
     */
    private _cancelOrder;
    private _areAllOrderActionsCanceled;
    /**
     * As soon as all cancelable and non-cancelable actions have been ended,
     * continue order cancelation process by stopping AGV immediately or on next
     * node, depending on its capabilities.
     */
    private _onOrderActionsCanceled;
    private _checkRouteTraversable;
    private _checkOrderActionsExecutable;
    private _checkNodeWithinDeviationRange;
    private _getNodeStates;
    private _getEdgeStates;
    private _getActionStates;
    private _getInstantActionStates;
    private _getNonOrderRejectionErrors;
    private _cleanupInstantActionStates;
    private _getEdgeStartNode;
    private _getEdgeEndNode;
    private _getTrailingEdge;
    private _processNode;
    private _processEdge;
    private _traverseEdge;
    private _updateEdgeTraversed;
    private _isActionEnded;
    /**
     * Returns the next HARD blocking action after the given action or
     * `undefined` if such a one doesn't exist.
     *
     * @param actions an array of Action objects
     * @param action a NONE or SOFT blocking action
     */
    private _getHardBlockingActionAfterParallelActions;
    /**
     * Determines whether all NONE and/or SOFT blocking actions which have been
     * executed in parallel with the given ended action have also been
     * ended, i.e. are in action status FINISHED or FAILED.
     */
    private _areParallelActionsEnded;
    private _updateActionStatus;
    /**
     * Execute remaining NONE or SOFT blocking actions up to next HARD blocking
     * action in parallel.
     *
     * Actions that are triggered on nodes can run as long as they need to run.
     * Actions on nodes should be self-terminating (e.g. an audio signal that
     * lasts for five seconds, or a pick action that is finished after picking
     * up a load) or should be formulated pairwise (e.g. activateWarningLights
     * and deactivateWarningLights), although there may be exceptions.
     *
     * Node actions are processed as follows: if at least one action with
     * blocking type SOFT or HARD exists the AGV stops driving, otherwise it
     * continues driving if not currently being stopped by other means. Then,
     * all NONE or SOFT blocking actions are executed in parallel, up to the
     * next HARD blocking action in the list. Once all the actions have
     * transitioned into status FINISHED or FAILED the following HARD blocking
     * action is executed. Once it has transitioned into status FINISHED or
     * FAILED iteration on node actions continues up to the next HARD blocking
     * action. If no (more) HARD blocking action exist all executing SOFT
     * blocking actions must have transitioned into status FINISHED or FAILED
     * before order processing can continue.
     *
     * @param node a Node
     * @param afterAction only process actions after this one (optional)
     */
    private _processNodeActions;
    private _processNodeAction;
    private _processEdgeActions;
    private _processEdgeAction;
    /**
     * Edge actions that are not in status FINISHED or FAILED must be
     * explicitely terminated when the edge end node is traversed.
     *
     * @remarks An action triggered by an edge will only be active for the time
     * that the AGV is traversing the edge which triggered the action. When the
     * AGV leaves the edge, the action will stop and the state before entering
     * the edge will be restored.
     *
     * @param edge an edge to be left when end node is traversed
     */
    private _finishEdgeActions;
    private _processInstantActions;
    private _processInstantActionChunk;
    private _processInstantAction;
    /**
     * Check whether the given instant action is executable.
     *
     * @remarks An instant action that is not executable (e.g. no load at
     * expected position) must be rejected with an error; the action must not be
     * reported as failed.
     *
     * @param action an instant action
     * @returns `true` if action is executable; `false` otherwise
     */
    private _checkInstantActionExecutable;
    private _createOrderError;
    private _createActionError;
    private _createInstantActionsValidationError;
}
