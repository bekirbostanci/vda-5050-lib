/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */
import { Action, ActionContext, ActionScope, ActionStatus, AgvAdapter, AgvAdapterDebugger, AgvAdapterOptions, AgvController, AgvPosition, AttachContext, BatteryState, DetachContext, Edge, ErrorReference, Headerless, Load, Node, OperatingMode, RouteTraversableContext, SafetyStatus, State, StopTraverseContext, TraverseEdgeContext, Velocity } from "..";
/**
 * Represents the internal vehicle state of a virtual AGV.
 *
 * @category AGV Adapter
 */
export interface VirtualAgvState {
    isDriving: boolean;
    isPaused: boolean;
    position: AgvPosition & {
        lastNodeId: string;
    };
    velocity: Velocity;
    batteryState: BatteryState;
    safetyState: SafetyStatus;
    operatingMode: OperatingMode;
    currentLoad: Load;
}
/**
 * Defines all possible states and state transitions of a node, edge, or
 * instant action supported by a virtual AGV.
 *
 * @category AGV Adapter
 */
export interface VirtualActionDefinition {
    /**
     * Type of action.
     */
    actionType: string;
    /**
     * Valid scopes of the action, any combination of `"instant"`, `"node"`, or
     * `"edge"`.
     */
    actionScopes: ActionScope | ActionScope[];
    /**
     * Defines constraint functions for action parameters (optional).
     *
     * To constraint the value of a specific action parameter key-value pair,
     * specify a function that returns `true` if the parameter's actual value is
     * valid; `false` otherwise. If the action parameter key is not specified,
     * `undefined` is passed as action parameter value to the constraint
     * function.
     *
     * An action is only executable if all the specified action parameter
     * constraints are satified.
     */
    actionParameterConstraints?: {
        [actionParameterKey: string]: (actionParameterValue: string | number | boolean | any[], scope: ActionScope, allActionParams: {
            [actionParameterKey: string]: string | number | boolean | any[];
        }) => boolean;
    };
    /**
     * Defines a function that is invoked to check whether a given action /
     * scope is executable in the context of an active order, if any (optional).
     *
     * Returns an error description string if action is not executable;
     * `undefined` or empty string otherwise.
     *
     * @remarks This check is performed immediately before the action is
     * executed by the adapter, so it can take the current vehicle state into
     * account.
     */
    actionExecutable?: (action: Action, scope: ActionScope, activeOrderId: string) => string;
    /**
     * Defines all possible states and transitions of an action.
     */
    transitions: VirtualActionTransitions;
}
/**
 * A specification format to define all possible states of an action, its
 * transitions, and side effects.
 *
 * @remarks The action state PAUSED is not part of the format. State transitions
 * from/to this state are handled internally by the adapter.
 *
 * @category AGV Adapter
 */
export type VirtualActionTransitions = {
    /**
     * Defines the initial state (mandatory for all actions).
     */
    ON_INIT: {
        /**
         * The initial status to transition to when the action is being
         * executed.
         *
         * @remarks This transition must always be present. Value must be
         * INITIALIZING or RUNNING for node and edge actions. Value must be
         * INITIALIZING, RUNNING, or FINISHED for instant actions.
         */
        next: ActionStatus.Initializing | ActionStatus.Running | ActionStatus.Finished;
    };
    /**
     * Define status change information for a node or edge action that can be
     * canceled by interrupting an initializing, running or paused action (for
     * interruptable node and edge actions only).
     *
     * After cancelation the action transitions to status FAILED automatically.
     */
    ON_CANCEL?: {
        /**
         * Specifies a function to return a partial state that must be updated
         * when the action is canceled (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    };
    /**
     * Define status change information for an edge action to be terminated (for
     * edge actions only, mandatory for edge actions).
     */
    ON_TERMINATE?: {
        /**
         * The next status to transition to after an edge action has been
         * terminated.
         */
        next: ActionStatus.Finished | ActionStatus.Failed;
        /**
         * Specifies a function to return a partial state that must be updated
         * when the edge action is terminated (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    };
    /**
     * Defines INITIALIZING action status (optional for node, edge, and instant
     * actions).
     */
    [ActionStatus.Initializing]?: {
        /**
         * Time in seconds to stay in this status.
         *
         * Specify either a number of seconds or a tuple with the name of the
         * action parameter whose numeric value should be taken and a default
         * value to be taken if this action parameter is not existing.
         */
        durationTime: number | [string, number];
        /**
         * The next status to transition to after the duration time elapses.
         */
        next: ActionStatus.Paused | ActionStatus.Running | ActionStatus.Failed;
        /**
         * Specifies a function to return a partial state to be updated when
         * this status is entered (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    };
    /**
     * Defines RUNNING action status (mandatory for node and edge actions,
     * optional for instant actions).
     */
    [ActionStatus.Running]?: {
        /**
         * Time in seconds to stay in this status.
         *
         * Specify either a number of seconds or a tuple with the name of the
         * action parameter whose numeric value should be taken and a default
         * value to be taken if this action parameter is not existing.
         */
        durationTime: number | [string, number];
        /**
         * The next status to transition to after the duration time elapses.
         */
        next: ActionStatus.Paused | ActionStatus.Finished | ActionStatus.Failed;
        /**
         * Specifies a function to return a partial state to be updated when
         * this status is entered (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    };
    /**
     * Defines FINISHED action status.
     */
    [ActionStatus.Finished]: {
        /**
         * A result reported by invoking the given function in FINISHED action
         * status.
         */
        resultDescription: (context: ActionContext) => string;
        /**
         * Specifies a function to return a partial state to be updated when
         * this status is entered (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    };
    /**
     * Defines FAILED action status.
     */
    [ActionStatus.Failed]: {
        /**
         * A FAILED action may report a corresponding error state with an error
         * description reported by invoking the given function (optional).
         *
         * If not specified or if the function returns `undefined` or an empty
         * string, only the action state change is reported, but not an error
         * state.
         */
        errorDescription?: (context: ActionContext) => string;
        /**
         * Specifies a function to return a partial state to be updated when
         * this status is entered (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    };
};
/**
 * Defines configuration options of the `VirtualAgvAdapter`.
 *
 * @category AGV Adapter
 */
export interface VirtualAgvAdapterOptions extends AgvAdapterOptions {
    /**
     * The initial position of the virtual AGV when it is instantiated.
     *
     * Position coordinates are relative to the world coordinate system using a
     * map with the given mapId. Theta defines the initial orientation in the
     * range [-Pi ... Pi].
     *
     * If not specified, the position defaults to `{ mapId: "local", x: 0, y: 0,
     * theta: 0, lastNodeId: "0" }`.
     */
    initialPosition?: {
        mapId: string;
        x: number;
        y: number;
        theta: number;
        lastNodeId: string;
    };
    /**
     * Specifies the AGV's normal deviation x/y tolerance (in meter) if no
     * deviation is allowed, i.e. if `NodePosition.allowedDeviationXy` is 0 or
     * not specified.
     *
     * If not specified, value defaults to 0.5 meter.
     */
    agvNormalDeviationXyTolerance?: number;
    /**
     * Specifies the AGV's normal deviation theta tolerance (in radian) if no
     * deviation is allowed, i.e. if `NodePosition.allowedDeviationTheta` is 0
     * or not specified.
     *
     * If not specified, value defaults to 0,349066 radians (20 degree).
     */
    agvNormalDeviationThetaTolerance?: number;
    /**
     * The target driving speed of the AGV measured in meter per second
     * (optional).
     *
     * If not specified, value defaults to 2 m/s.
     *
     * @remarks
     * A virtual AGV is assumed to have the same forward and cornering speed, as
     * well as infinite acceleration and deceleration. If the specified speed is
     * greater than the maximum speed on a order's edge the speed is adjusted
     * accordingly.
     *
     * The options `vehicleSpeed`, `vehicleSpeedDistribution`, and
     * `vehicleTimeDistribution` are mutually exclusive. Specify at most one of
     * them. If none is specified, the default value of the option
     * `vehicleSpeed` is applied.
     */
    vehicleSpeed?: number;
    /**
     * The driving speed distribution function of the AGV returning a series of
     * independent, identically distributed random speed values (measured in
     * meter per second) from a given distribution (optional).
     *
     * The driving speed can follow a probabilistic distribution such as a
     * Normal (Gaussian) or Poisson distribution. The given function is invoked
     * once per edge to yield the target speed of the AGV while traversing the
     * edge.
     *
     * The first value of the returned tuple is the random target speed; the
     * second one is the constant mean value of the speed distribution.
     *
     * @remarks The options `vehicleSpeed`, `vehicleSpeedDistribution`, and
     * `vehicleTimeDistribution` are mutually exclusive. Specify at most one of
     * them. If none is specified, the default value of the option
     * `vehicleSpeed` is applied.
     */
    vehicleSpeedDistribution?: () => [number, number];
    /**
     * The driving time distribution function of the AGV returning a series of
     * independent, identically distributed random time values (measured in
     * second) from a given distribution (optional).
     *
     * The driving time can follow a probabilistic distribution such as a Normal
     * (Gaussian) or Poisson distribution. The given function is invoked once
     * per edge to yield the target time of the AGV for traversing the edge.
     *
     * The first value of the returned tuple is the random target time for
     * traversing an edge; the second one is the constant mean value of the
     * driving time distribution.
     *
     * @remarks The options `vehicleSpeed`, `vehicleSpeedDistribution`, and
     * `vehicleTimeDistribution` are mutually exclusive. Specify at most one of
     * them. If none is specified, the default value of the option
     * `vehicleSpeed` is applied.
     */
    vehicleTimeDistribution?: () => [number, number];
    /**
     * Maximum reach in meter of an AGV with a fully charged battery (optional).
     *
     * If not specified, value defaults to 28800 meter (i.e. 4 hours travel time
     * at a speed of 2m/s).
     *
     * @remarks This option doesn't take the actual speed of the AGV into
     * account. To keep it simple it is just a rough approximation of the real
     * physics.
     */
    batteryMaxReach?: number;
    /**
     * Initial battery state of charge as a percentage number between 0 and 100
     * (optional).
     *
     * If not specified, value defaults to 100 percent.
     */
    initialBatteryCharge?: number;
    /**
     * Time in hours to charge an empty battery to 100% (optional).
     *
     * If not specified, value defaults to 1 hour.
     */
    fullBatteryChargeTime?: number;
    /**
     * State of charge value in percent below which the AGV stops driving and
     * and reports a corresponding error state with error type
     * `"batteryLowError"` and error level FATAL.
     *
     * If not specified, value defaults to 1 percent.
     *
     * @remarks While charging `"batteryLowError"` is removed from state again
     * as soon as charge advances 10% above this threshold.
     */
    lowBatteryChargeThreshold?: number;
    /**
     * Rate in ticks per second at which periodic motion and state updates are
     * triggered internally (optional).
     *
     * If not specified, value defaults to 5 ticks/sec.
     */
    tickRate?: number;
    /**
     * Factor by which vehicle motion and execution of actions is speeded up
     * (optional).
     *
     * If not specified, the value defaults to 1, i.e. no time lapse mode is
     * active.
     *
     * @remarks Useful to speed up order execution in simulation and test
     * environments.
     */
    timeLapse?: number;
}
/**
 * An AGV adapter that implements a virtual AGV supporting free autonomous
 * navigation along edges, and a basic, yet extensible set of actions.
 *
 * This adapter is meant to be used as a template for realizing your own
 * adapter, for simulation purposes, integration testing, and in other kind of
 * environments where real AGVs are not available or must be mocked.
 *
 * The following actions are supported:
 * - noop [instant, node, edge]
 * - pick/drop [node],
 * - initPosition [instant, node]
 * - startPause/stopPause [instant]
 * - startCharging/stopCharging [instant, node]
 * - cancelOrder [instant, supported by AgvController]
 * - stateRequest [instant, supported by AgvController]
 * - factsheetRequest [instant, supported by AgvController]
 * - orderExecutionTime [instant (custom)]
 *
 * The actions noop, pick, drop, startCharging, and stopCharging accept an
 * optional action parameter named "duration" that specifies the number of
 * seconds to stay in action state RUNNING. If not specified all these actions
 * stay running for 5 seconds. Note that pick and drop actions stay in status
 * INITIALIZING for 1 additional second.
 *
 * @remarks
 * To be executable by the virtual AGV an order must specify `nodePosition` for
 * all nodes except for the first one as VDA 5050 requires the vehicle to be
 * already positioned on the first node (within a given deviation range). The
 * property `nodeId` alone is not usable as a symbolic position.
 *
 * By default, when the virtual AGV is started, it is positioned at `{ x: 0, y:
 * 0, theta: 0, lastNodeId: "0" }` relative to a map with mapId `local`. You can
 * override this pose by supplying the option
 * `VirtualAgvAdapterOptions.initialPosition` when instantiating the virtual
 * AGV. In addition, you can override or reset this pose using the instant or
 * node action `initPosition`, specifying `x`, `y`, `theta`, `mapId`,
 * `lastNodeId`, and `lastNodeSequenceId` (optional, defaults to zero) as action
 * parameters.
 *
 * The virtual AGV provides a constant safety state where no e-stop is activated
 * and where the protective field is never violated. The operating mode of the
 * virtual AGV is always automatic, i.e. it is fully controlled by master
 * control.
 *
 * The virtual AGV can only pick and carry one load at a time. Before picking
 * another load the current load must have been dropped.
 *
 * A charging action is executed on a charging spot while the vehicle is
 * standing, either as an instant action or as a node action. Charging mode is
 * either terminated explicitely by action stopCharging or automatically when
 * the battery is fully charged.
 *
 * The AGV's remaining battery reach is reported in the `State.batteryState`
 * property unless the vehicle time distribution mode is active according to the
 * option `vehicleTimeDistribution`. When the AGV's battery runs low according
 * to the option `lowBatteryChargeThreshold` it stops driving and reports an
 * error of type `"batteryLowError"`. The master control must then initiate
 * further actions, e.g. cancel any active order or start charging. The battery
 * low error is removed from State as soon as battery charge advances 10% above
 * the configured threshold.
 *
 * The custom action `orderExecutionTime` expects an action parameter key
 * `orders` with an array of VDA 5050 headerless Order objects as parameter
 * value. The action finishes immediately reporting the estimated order
 * execution times in seconds as values in a comma-separated string format via
 * the `resultDescription` of the corresponding action state. The calculated
 * estimates include the effective duration of action processing on the order's
 * nodes (taking action blocking types and concurrent actions into account) as
 * well as the travel time on the order's edges, including both base and horizon
 * nodes and edges.
 *
 * To support benchmarking and performance measurement based on statistics the
 * virtual AGV also supports probabilistic distribution of driving speed or
 * driving time by corresponding adapter options.
 *
 * @category AGV Adapter
 */
export declare class VirtualAgvAdapter implements AgvAdapter {
    readonly debug: AgvAdapterDebugger;
    private readonly _controller;
    private readonly _options;
    private readonly _actionStateMachines;
    private _vehicleState;
    private _tick;
    private _tickIntervalId;
    private _traverseContext;
    private _batteryLowError;
    constructor(controller: AgvController, adapterOptions: VirtualAgvAdapterOptions, debug: AgvAdapterDebugger);
    /**
     * Gets the Virtual AGV adapter configuration options as a readonly object
     * with default values filled in for options not specified in the
     * configuration.
     */
    get options(): Readonly<Required<VirtualAgvAdapterOptions>>;
    get controller(): AgvController;
    get name(): string;
    get apiVersion(): number;
    attach(context: AttachContext): void;
    detach(context: DetachContext): void;
    executeAction(context: ActionContext): void;
    finishEdgeAction(context: ActionContext): void;
    cancelAction(context: ActionContext): void;
    isActionExecutable(context: ActionContext): ErrorReference[];
    isNodeWithinDeviationRange(node: Node): ErrorReference[];
    isRouteTraversable(context: RouteTraversableContext): ErrorReference[];
    /**
     * Traverses the given edge using a basic free navigation algorithm where the
     * AGV drives with constant speed on a straight line from the edge's start point
     * to the edge's end point. This algorithm ignores obstacle detection and
     * collision avoidance.
     */
    traverseEdge(context: TraverseEdgeContext): void;
    stopTraverse(context: StopTraverseContext): void;
    /**
     * Gets the vehicle state as a readonly object.
     */
    protected get vehicleState(): Readonly<VirtualAgvState>;
    /**
     * Gets the default set of action definitions supported by the virtual AGV.
     *
     * @remarks Can be overwritten or extended by subclasses.
     */
    protected get actionDefinitions(): VirtualActionDefinition[];
    /**
     * Vehicle starts driving with the given velocity.
     *
     * @param vx velocity in x direction
     * @param vy velocity in y direction
     * @param reportImmediately true if velocity update should be reported
     * immediately; false otherwise
     */
    protected startDriving(vx: number, vy: number, reportImmediately?: boolean): void;
    /**
     * Vehicle stops driving.
     *
     * @param reportImmediately true if velocity update should be reported
     * immediately; false otherwise
     */
    protected stopDriving(reportImmediately?: boolean): void;
    /**
     * Gets duration of given action in seconds.
     *
     * @param action an order action
     * @returns duration of action (in seconds)
     */
    protected getNodeActionDuration(action: Action): number;
    /**
     * Gets target speed of vehicle depending on related adapter options.
     *
     * @param useMean whether to use the constant mean speed or the random speed
     * if a driving speed or time distribution has been specified in the adapter
     * options; otherwise this parameter is ignored
     * @param distance the target distance to travel; only used if driving time
     * distribution has been specified in the adapter options
     * @param maxSpeed a speed limit that must not be exceeded (optional, only
     * used if no driving distribution function has been specified in the
     * adapter options)
     * @returns target speed of vehicle depending on the given parameters and
     * adapter options
     */
    protected getTargetSpeed(useMean: boolean, distance: number, maxSpeed?: number): number;
    /**
     * Determines whether the given order could be executed potentially by
     * checking whether the order route is traversable and all node actions are
     * potentially executable.
     *
     * @param nodes nodes of order
     * @param edges edges of order
     * @returns true if order can be executed potentially; false otherwise
     */
    protected canExecuteOrder(nodes: Node[], edges: Edge[]): boolean;
    /**
     * Updates battery state of vehicle according to the given travel distance.
     *
     * @param dx distance travelled in x direction
     * @param dy distance travelled in y direction
     */
    protected updateBatteryState(dx: number, dy: number): void;
    /**
     * Gets battery reach of vehicle for the given state of charge.
     *
     * @param charge battery state of charge (in percent)
     * @returns battery reach according to given state of charge
     */
    protected getBatteryReach(charge: number): number;
    private _optionsWithDefaults;
    private _getActionDefinition;
    private _finalizeAction;
    private _onTick;
    private _advanceTraverse;
    private _advanceBatteryCharge;
    private _loadAdded;
    private _loadRemoved;
    private _initPosition;
    private _startPause;
    private _stopPause;
    private _startCharging;
    private _stopCharging;
    private _calculateEstimatedOrderExecutionTimes;
    private _calculateEstimatedOrderExecutionTime;
}
