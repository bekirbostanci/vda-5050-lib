/**
 * AGV connection state reported as a last will message. Has to be sent with retain flag.
 * Once the AGV comes online, it has to send this message on its connect topic, with the
 * connectionState enum set to "ONLINE".
 * The last will message is to be configured with the connection state set to
 * "CONNECTIONBROKEN".
 * Thus, if the AGV disconnects from the broker, master control gets notified via the topic
 * "connection".
 * If the AGV is disconnecting in an orderly fashion (e.g. shutting down, sleeping), the AGV
 * is to publish a message on this topic with the connectionState set to "OFFLINE".
 */
export interface Connection {
    /**
     * headerId of the message. The headerId is defined per topic and incremented by 1 with each
     * sent (but not necessarily received) message.
     */
    headerId: number;
    /**
     * Manufacturer of the AGV
     */
    manufacturer: string;
    /**
     * Serial number of the AGV
     */
    serialNumber: string;
    /**
     * Timestamp (ISO8601, UTC); YYYY-MM-DDTHH:mm:ss.ssZ; e.g. 2017-04-15T11:40:03.12Z
     */
    timestamp: string;
    /**
     * Version of the protocol [Major].[Minor].[Patch], e.g. 1.3.2
     */
    version: string;
    /**
     * Connection state.
     * ONLINE: connection between AGV and broker is active.
     * OFFLINE: connection between AGV and broker has gone offline in a coordinated way.
     * CONNECTIONBROKEN: The connection between AGV and broker has unexpectedly ended.
     */
    connectionState: ConnectionState;
}
/**
 * Connection state.
 * ONLINE: connection between AGV and broker is active.
 * OFFLINE: connection between AGV and broker has gone offline in a coordinated way.
 * CONNECTIONBROKEN: The connection between AGV and broker has unexpectedly ended.
 */
export declare enum ConnectionState {
    Connectionbroken = "CONNECTIONBROKEN",
    Offline = "OFFLINE",
    Online = "ONLINE"
}
/**
 * The factsheet provides basic information about a specific AGV type series. This
 * information allows comparison of different AGV types and can be applied for the planning,
 * dimensioning and simulation of an AGV system. The factsheet also includes information
 * about AGV communication interfaces which are required for the integration of an AGV type
 * series into a VD[M]A-5050-compliant master control.
 */
export interface Factsheet {
    /**
     * headerId of the message. The headerId is defined per topic and incremented by 1 with each
     * sent (but not necessarily received) message.
     */
    headerId: number;
    /**
     * Manufacturer of the AGV
     */
    manufacturer: string;
    /**
     * Serial number of the AGV
     */
    serialNumber: string;
    /**
     * Timestamp (ISO8601, UTC); YYYY-MM-DDTHH:mm:ss.ssZ; e.g. 2017-04-15T11:40:03.12Z
     */
    timestamp: string;
    /**
     * Version of the protocol [Major].[Minor].[Patch], e.g. 1.3.2
     */
    version: string;
    /**
     * Detailed definition of AGV geometry
     */
    agvGeometry?: AgvGeometry;
    /**
     * Abstract specification of load capabilities
     */
    loadSpecification?: LoadSpecification;
    /**
     * Detailed specification of localization
     */
    localizationParameters?: number;
    /**
     * These parameters specify the basic physical properties of the AGV
     */
    physicalParameters?: PhysicalParameters;
    /**
     * Supported features of VDA5050 protocol
     */
    protocolFeatures?: ProtocolFeatures;
    /**
     * This JSON-object describes the protocol limitations of the AGV. If a parameter is not
     * defined or set to zero then there is no explicit limit for this parameter.
     */
    protocolLimits?: ProtocolLimits;
    /**
     * These parameters generally specify the class and the capabilities of the AGV
     */
    typeSpecification?: TypeSpecification;
}
/**
 * Detailed definition of AGV geometry
 */
export interface AgvGeometry {
    envelopes2d?: Envelopes2D[];
    /**
     * list of AGV-envelope curves in 3D (german: „Hüllkurven“)
     */
    envelopes3d?: Envelopes3D[];
    /**
     * list of wheels, containing wheel-arrangement and geometry
     */
    wheelDefinitions?: WheelDefinition[];
}
export interface Envelopes2D {
    /**
     * free text: description of envelope curve set
     */
    description?: string;
    /**
     * envelope curve as a x/y-polygon polygon is assumed as closed and must be
     * non-self-intersecting
     */
    polygonPoints: PolygonPoint[];
    /**
     * name of the envelope curve set
     */
    set: string;
}
export interface PolygonPoint {
    /**
     * x-position of polygon-point
     */
    x: number;
    /**
     * y-position of polygon-point
     */
    y: number;
}
export interface Envelopes3D {
    /**
     * 3D-envelope curve data, format specified in ‚format‘
     */
    data?: {
        [key: string]: any;
    };
    /**
     * free text: description of envelope curve set
     */
    description?: number;
    /**
     * format of data e.g. DXF
     */
    format: string;
    /**
     * name of the envelope curve set
     */
    set: string;
    /**
     * protocol and url-definition for downloading the 3D-envelope curve data e.g.
     * ftp://xxx.yyy.com/ac4dgvhoif5tghji
     */
    url?: string;
}
export interface WheelDefinition {
    /**
     * nominal displacement of the wheel’s center to the rotation point (necessary for caster
     * wheels). If the parameter is not defined, it is assumed to be 0
     */
    centerDisplacement?: number;
    /**
     * free text: can be used by the manufacturer to define constraints
     */
    constraints?: string;
    /**
     * nominal diameter of wheel
     */
    diameter: number;
    /**
     * True: wheel is actively driven (de: angetrieben)
     */
    isActiveDriven: boolean;
    /**
     * True: wheel is actively steered (de: aktiv gelenkt)
     */
    isActiveSteered: boolean;
    position: Position;
    /**
     * wheel type. DRIVE, CASTER, FIXED, MECANUM
     */
    type: Type;
    /**
     * nominal width of wheel
     */
    width: number;
}
export interface Position {
    /**
     * orientation of wheel in AGV-coordinate system Necessary for fixed wheels
     */
    theta?: number;
    /**
     * [m] x-position in AGV-coordinate system
     */
    x: number;
    /**
     * y-position in AGV-coordinate system
     */
    y: number;
}
/**
 * wheel type. DRIVE, CASTER, FIXED, MECANUM
 */
export declare enum Type {
    Caster = "CASTER",
    Drive = "DRIVE",
    Fixed = "FIXED",
    Mecanum = "MECANUM"
}
/**
 * Abstract specification of load capabilities
 */
export interface LoadSpecification {
    /**
     * list of load positions / load handling devices. This lists contains the valid values for
     * the oarameter “state.loads[].loadPosition” and for the action parameter “lhd” of the
     * actions pick and drop. If this list doesn’t exist or is empty, the AGV has no load
     * handling device.
     */
    loadPositions?: string[];
    /**
     * list of load-sets that can be handled by the AGV
     */
    loadSets?: LoadSet[];
}
export interface LoadSet {
    /**
     * maximum allowed acceleration for this load-type and –weight
     */
    agvAccelerationLimit?: number;
    /**
     * maximum allowed deceleration for this load-type and –weight
     */
    agvDecelerationLimit?: number;
    /**
     * maximum allowed speed for this load-type and –weight
     */
    agvSpeedLimit?: number;
    /**
     * bounding box reference as defined in parameter loads[] in state-message
     */
    boundingBoxReference?: LoadSetBoundingBoxReference;
    /**
     * free text description of the load handling set
     */
    description?: number;
    /**
     * approx. time for dropping the load
     */
    dropTime?: number;
    loadDimensions?: LoadSetLoadDimensions;
    /**
     * list of load positions btw. load handling devices, this load-set is valid for. If this
     * parameter does not exist or is empty, this load-set is valid for all load handling
     * devices on this AGV.
     */
    loadPositions?: string[];
    /**
     * type of load e.g. EPAL, XLT1200, ….
     */
    loadType: string;
    /**
     * maximum allowed depth for this load-type and –weight. references to boundingBoxReference
     */
    maxLoadhandlingDepth?: number;
    /**
     * maximum allowed height for handling of this load-type and –weight. references to
     * boundingBoxReference
     */
    maxLoadhandlingHeight?: number;
    /**
     * maximum allowed tilt for this load-type and –weight
     */
    maxLoadhandlingTilt?: number;
    /**
     * maximum weight of loadtype
     */
    maxWeigth?: number;
    /**
     * minimum allowed depth for this load-type and –weight. references to boundingBoxReference
     */
    minLoadhandlingDepth?: number;
    /**
     * minimum allowed height for handling of this load-type and –weight. References to
     * boundingBoxReference
     */
    minLoadhandlingHeight?: number;
    /**
     * minimum allowed tilt for this load-type and –weight
     */
    minLoadhandlingTilt?: number;
    /**
     * approx. time for picking up the load
     */
    pickTime?: number;
    /**
     * Unique name of the load set, e.g. DEFAULT, SET1, ...
     */
    setName: string;
}
/**
 * bounding box reference as defined in parameter loads[] in state-message
 */
export interface LoadSetBoundingBoxReference {
    /**
     * Orientation of the loads bounding box. Important for tugger trains, etc.
     */
    theta?: number;
    /**
     * x-coordinate of the point of reference.
     */
    x: number;
    /**
     * y-coordinate of the point of reference.
     */
    y: number;
    /**
     * z-coordinate of the point of reference.
     */
    z: number;
}
export interface LoadSetLoadDimensions {
    /**
     * Absolute height of the load´s bounding box. Optional: Set value only if known.
     */
    height?: number;
    /**
     * Absolute length of the load´s bounding box.
     */
    length: number;
    /**
     * Absolute width of the load´s bounding bo
     */
    width: number;
}
/**
 * These parameters specify the basic physical properties of the AGV
 */
export interface PhysicalParameters {
    /**
     * maximum acceleration with maximum load
     */
    accelerationMax: number;
    /**
     * maximum deceleration with maximum load
     */
    decelerationMax: number;
    /**
     * maximum height of AGV
     */
    heightMax: number;
    /**
     * minimum height of AGV
     */
    heightMin?: number;
    /**
     * length of AGV
     */
    length: number;
    /**
     * maximum speed of the AGV
     */
    speedMax: number;
    /**
     * minimal controlled continuous speed of the AGV
     */
    speedMin: number;
    /**
     * width of AGV
     */
    width: number;
}
/**
 * Supported features of VDA5050 protocol
 */
export interface ProtocolFeatures {
    /**
     * list of all actions with parameters supported by this AGV. This includes standard actions
     * specified in VDA5050 and manufacturer-specific actions
     */
    agvActions: AgvAction[];
    /**
     * list of supported and/or required optional parameters. Optional parameters, that are not
     * listed here, are assumed to be not supported by the AGV.
     */
    optionalParameters: OptionalParameter[];
}
export interface AgvAction {
    /**
     * free text: description of the action
     */
    actionDescription?: string;
    /**
     * list of parameters. if not defined, the action has no parameters
     */
    actionParameters?: AgvActionActionParameter[];
    /**
     * list of allowed scopes for using this action-type. INSTANT: usable as instantAction,
     * NODE: usable on nodes, EDGE: usable on edges.
     */
    actionScopes: AgvActionActionScope[];
    /**
     * unique actionType corresponding to action.actionType
     */
    actionType: string;
    /**
     * free text: description of the resultDescription
     */
    resultDescription?: string;
}
export interface AgvActionActionParameter {
    /**
     * free text: description of the parameter
     */
    description?: string;
    /**
     * True: optional parameter
     */
    isOptional?: boolean;
    /**
     * key-String for Parameter
     */
    key: string;
    /**
     * data type of Value, possible data types are: BOOL, NUMBER, INTEGER, FLOAT, STRING,
     * OBJECT, ARRAY
     */
    valueDataType: ValueDataType;
}
/**
 * data type of Value, possible data types are: BOOL, NUMBER, INTEGER, FLOAT, STRING,
 * OBJECT, ARRAY
 */
export declare enum ValueDataType {
    Array = "ARRAY",
    Bool = "BOOL",
    Float = "FLOAT",
    Integer = "INTEGER",
    Number = "NUMBER",
    Object = "OBJECT",
    String = "STRING"
}
export declare enum AgvActionActionScope {
    Edge = "EDGE",
    Instant = "INSTANT",
    Node = "NODE"
}
export interface OptionalParameter {
    /**
     * free text. Description of optional parameter. E.g. Reason, why the optional parameter
     * ‚direction‘ is necessary for this AGV-type and which values it can contain. The parameter
     * ‘nodeMarker’ must contain unsigned interger-numbers only. Nurbs-Support is limited to
     * straight lines and circle segments.
     */
    description?: string;
    /**
     * full name of optional parameter, e.g. “order.nodes.nodePosition.allowedDeviationTheta”
     */
    parameter: string;
    /**
     * type of support for the optional parameter, the following values are possible: SUPPORTED:
     * optional parameter is supported like specified. REQUIRED: optional parameter is required
     * for proper AGV-operation.
     */
    support: Support;
}
/**
 * type of support for the optional parameter, the following values are possible: SUPPORTED:
 * optional parameter is supported like specified. REQUIRED: optional parameter is required
 * for proper AGV-operation.
 */
export declare enum Support {
    Required = "REQUIRED",
    Supported = "SUPPORTED"
}
/**
 * This JSON-object describes the protocol limitations of the AGV. If a parameter is not
 * defined or set to zero then there is no explicit limit for this parameter.
 */
export interface ProtocolLimits {
    /**
     * maximum lengths of arrays
     */
    maxArrayLens: {
        [key: string]: any;
    };
    /**
     * maximum lengths of strings
     */
    maxStringLens: MaxStringLens;
    /**
     * timing information
     */
    timing: Timing;
}
/**
 * maximum lengths of strings
 */
export interface MaxStringLens {
    /**
     * maximum length of ENUM- and Key-Strings. Affected parameters: action.actionType,
     * action.blockingType, edge.direction, actionParameter.key, state.operatingMode,
     * load.loadPosition, load.loadType, actionState.actionStatus, error.errorType,
     * error.errorLevel, errorReference.referenceKey, info.infoType, info.infoLevel,
     * safetyState.eStop, connection.connectionState
     */
    enumLen?: number;
    /**
     * maximum length of ID-Strings. Affected parameters: order.orderId, order.zoneSetId,
     * node.nodeId, nodePosition.mapId, action.actionId, edge.edgeId, edge.startNodeId,
     * edge.endNodeId
     */
    idLen?: number;
    /**
     * If true ID-strings need to contain numerical values only
     */
    idNumericalOnly?: boolean;
    /**
     * maximum length of loadId Strings
     */
    loadIdLen?: number;
    /**
     * maximum MQTT Message length
     */
    msgLen?: number;
    /**
     * maximum length of all other parts in MQTT-topics. Affected parameters: order.timestamp,
     * order.version, order.manufacturer, instantActions.timestamp, instantActions.version,
     * instantActions.manufacturer, state.timestamp, state.version, state.manufacturer,
     * visualization.timestamp, visualization.version, visualization.manufacturer,
     * connection.timestamp, connection.version, connection.manufacturer
     */
    topicElemLen?: number;
    /**
     * maximum length of serial-number part in MQTT-topics. Affected Parameters:
     * order.serialNumber, instantActions.serialNumber, state.SerialNumber,
     * visualization.serialNumber, connection.serialNumber
     */
    topicSerialLen?: number;
}
/**
 * timing information
 */
export interface Timing {
    /**
     * default interval for sending state-messages if not defined, the default value from the
     * main document is used
     */
    defaultStateInterval?: number;
    /**
     * minimum interval sending order messages to the AGV
     */
    minOrderInterval: number;
    /**
     * minimum interval for sending state-messages
     */
    minStateInterval: number;
    /**
     * default interval for sending messages on visualization topic
     */
    visualizationInterval?: number;
}
/**
 * These parameters generally specify the class and the capabilities of the AGV
 */
export interface TypeSpecification {
    /**
     * Simplified description of AGV class.
     */
    agvClass: AgvClass;
    /**
     * simplified description of AGV kinematics-type.
     */
    agvKinematic: AgvKinematic;
    /**
     * simplified description of localization type
     */
    localizationTypes: LocalizationType[];
    /**
     * maximum loadable mass
     */
    maxLoadMass: number;
    /**
     * List of path planning types supported by the AGV, sorted by priority
     */
    navigationTypes: NavigationType[];
    /**
     * Free text human readable description of the AGV type series
     */
    seriesDescription?: string;
    /**
     * Free text generalized series name as specified by manufacturer
     */
    seriesName: string;
}
/**
 * Simplified description of AGV class.
 */
export declare enum AgvClass {
    Carrier = "CARRIER",
    Conveyor = "CONVEYOR",
    Forklift = "FORKLIFT",
    Tugger = "TUGGER"
}
/**
 * simplified description of AGV kinematics-type.
 */
export declare enum AgvKinematic {
    Diff = "DIFF",
    Omni = "OMNI",
    Threewheel = "THREEWHEEL"
}
export declare enum LocalizationType {
    Dmc = "DMC",
    Grid = "GRID",
    Natural = "NATURAL",
    RFID = "RFID",
    Reflector = "REFLECTOR",
    Spot = "SPOT"
}
export declare enum NavigationType {
    Autonomous = "AUTONOMOUS",
    PhysicalLindeGuided = "PHYSICAL_LINDE_GUIDED",
    VirtualLineGuided = "VIRTUAL_LINE_GUIDED"
}
/**
 * Includes the protocol header of a VDA 5050 object defining common properties: headerId,
 * manufacturer, serialNumber, timestamp, version.
 */
export interface Header {
    /**
     * headerId of the message. The headerId is defined per topic and incremented by 1 with each
     * sent (but not necessarily received) message.
     */
    headerId: number;
    /**
     * Manufacturer of the AGV
     */
    manufacturer: string;
    /**
     * Serial number of the AGV
     */
    serialNumber: string;
    /**
     * Timestamp (ISO8601, UTC); YYYY-MM-DDTHH:mm:ss.ssZ; e.g. 2017-04-15T11:40:03.12Z
     */
    timestamp: string;
    /**
     * Version of the protocol [Major].[Minor].[Patch], e.g. 1.3.2
     */
    version: string;
}
/**
 * Instant actions that the AGV is to execute as soon as they arrive.
 */
export interface InstantActions {
    /**
     * headerId of the message. The headerId is defined per topic and incremented by 1 with each
     * sent (but not necessarily received) message.
     */
    headerId: number;
    /**
     * Manufacturer of the AGV
     */
    manufacturer: string;
    /**
     * Serial number of the AGV
     */
    serialNumber: string;
    /**
     * Timestamp (ISO8601, UTC); YYYY-MM-DDTHH:mm:ss.ssZ; e.g. 2017-04-15T11:40:03.12Z
     */
    timestamp: string;
    /**
     * Version of the protocol [Major].[Minor].[Patch], e.g. 1.3.2
     */
    version: string;
    /**
     * Array of actions that need to be performed immediately and are not part of the regular
     * order.
     */
    instantActions: Action[];
}
/**
 * Instant Action Object
 *
 * Edge Action Object
 *
 * Node Action Object
 */
export interface Action {
    /**
     * Additional information on the action.
     */
    actionDescription?: string;
    /**
     * ID to distinguish between multiple actions, either instant or with the same type on the
     * same node/edge.
     */
    actionId: string;
    /**
     * Array of actionParameter objects for the indicated action e.g. deviceId, loadId, external
     * triggers.
     */
    actionParameters?: ActionParameter[];
    /**
     * Name of action as described in the first column of "Actions and Parameters"
     * Identifies the function of the action.
     */
    actionType: string;
    /**
     * Regulates if the action is allowed to be executed during movement and/or parallel to
     * other actions.
     * NONE: action can happen in parallel with others, including movement.
     * SOFT: action can happen simultaneously with others, but not while moving.
     * HARD: no other actions can be performed while this action is running.
     */
    blockingType: BlockingType;
}
/**
 * ActionParameter Object
 */
export interface ActionParameter {
    /**
     * The key of the action parameter. For example. duration, direction, signal.
     */
    key: string;
    /**
     * The value of the action parameter. For example: 103.2, "left", true, [ 1, 2, 3].
     */
    value: any[] | boolean | number | string;
}
/**
 * Regulates if the action is allowed to be executed during movement and/or parallel to
 * other actions.
 * NONE: action can happen in parallel with others, including movement.
 * SOFT: action can happen simultaneously with others, but not while moving.
 * HARD: no other actions can be performed while this action is running.
 */
export declare enum BlockingType {
    Hard = "HARD",
    None = "NONE",
    Soft = "SOFT"
}
/**
 * An order to be communicated from master control to the AGV.
 */
export interface Order {
    /**
     * headerId of the message. The headerId is defined per topic and incremented by 1 with each
     * sent (but not necessarily received) message.
     */
    headerId: number;
    /**
     * Manufacturer of the AGV
     */
    manufacturer: string;
    /**
     * Serial number of the AGV
     */
    serialNumber: string;
    /**
     * Timestamp (ISO8601, UTC); YYYY-MM-DDTHH:mm:ss.ssZ; e.g. 2017-04-15T11:40:03.12Z
     */
    timestamp: string;
    /**
     * Version of the protocol [Major].[Minor].[Patch], e.g. 1.3.2
     */
    version: string;
    /**
     * Base and Horizon Edges of the Order Graph.
     */
    edges: Edge[];
    /**
     * This list holds the base and the horizon nodes of the order graph.
     */
    nodes: Node[];
    /**
     * Unique order Identification.
     */
    orderId: string;
    /**
     * orderUpdate identification. Is unique per orderId. If an order update is rejected, this
     * field is to be passed in the rejection message.
     */
    orderUpdateId: number;
    /**
     * Unique identifier of the zone set that the AGV has to use for navigation or that was used
     * by MC for planning.
     * Optional: Some MC systems do not use zones. Some AGVs do not understand zones. Do not add
     * to message if no zones are used.
     */
    zoneSetId?: string;
}
export interface Edge {
    /**
     * Array of action objects with detailed information.
     */
    actions: Action[];
    /**
     * Sets direction at junctions for line-guided vehicles, to be defined initially
     * (vehicle-individual). Can be descriptive (left, right, middle, straight) or a frequency
     * ("433MHz").
     */
    direction?: string;
    /**
     * Distance of the path from startNode to endNode in meters. This value is used by
     * line-guided AGVs to decrease their speed before reaching a stop position.
     */
    distance?: number;
    /**
     * Verbose description of the edge.
     */
    edgeDescription?: string;
    /**
     * Unique edge identification
     */
    edgeId: string;
    /**
     * The nodeId of the end node.
     */
    endNodeId: string;
    /**
     * Distance of the path from startNode to endNode in meters.
     * Optional: This value is used by line-guided AGVs to decrease their speed before reaching
     * a stop position.
     */
    length?: number;
    /**
     * Permitted maximum height of the vehicle, including the load, on edge. In meters.
     */
    maxHeight?: number;
    /**
     * Maximum rotation speed in rad/s
     */
    maxRotationSpeed?: number;
    /**
     * permitted maximum speed of the agv on the edge in m/s. Speed is defined by the fastest
     * point of the vehicle.
     */
    maxSpeed?: number;
    /**
     * Permitted minimal height of the edge measured at the bottom of the load. In meters.
     */
    minHeight?: number;
    /**
     * Orientation of the AGV on the edge relative to the map coordinate origin (for holonomic
     * vehicles with more than one driving direction).
     * Example: orientation Pi/2 rad will lead to a rotation of 90 degrees.
     * If AGV starts in different orientation, rotate the vehicle on the edge to the desired
     * orientation if rotationAllowed is set to "true".
     * If rotationAllowed is "false", rotate before entering the edge.
     * If that is not possible, reject the order.
     * If a trajectory with orientation is defined, follow the trajectories orientation. If a
     * trajectory without orientation and the orientation field here is defined, apply the
     * orientation to the tangent of the trajectory.
     */
    orientation?: number;
    /**
     * Enum GLOBAL, TANGENTIAL
     * "GLOBAL"- relative to the global project specific map coordinate system;
     * "TANGENTIAL"- tangential to the edge.
     * If not defined, the default value is "TANGENTIAL".
     */
    orientationType?: OrientationType;
    /**
     * If true, the edge is part of the base plan. If false, the edge is part of the horizon
     * plan.
     */
    released: boolean;
    /**
     * If true, rotation is allowed on the edge.
     */
    rotationAllowed?: boolean;
    /**
     * Id to track the sequence of nodes and edges in an order and to simplify order updates.
     * The variable sequenceId runs across all nodes and edges of the same order and is reset
     * when a new orderId is issued.
     */
    sequenceId: number;
    /**
     * The nodeId of the start node.
     */
    startNodeId: string;
    /**
     * Trajectory JSON-object for this edge as a NURBS. Defines the curve on which the AGV
     * should move between startNode and endNode.
     * Optional: Can be omitted if AGV cannot process trajectories or if AGV plans its own
     * trajectory.
     */
    trajectory?: Trajectory;
}
/**
 * Enum GLOBAL, TANGENTIAL
 * "GLOBAL"- relative to the global project specific map coordinate system;
 * "TANGENTIAL"- tangential to the edge.
 * If not defined, the default value is "TANGENTIAL".
 */
export declare enum OrientationType {
    Global = "GLOBAL",
    Tangential = "TANGENTIAL"
}
/**
 * Trajectory JSON-object for this edge as a NURBS. Defines the curve on which the AGV
 * should move between startNode and endNode.
 * Optional: Can be omitted if AGV cannot process trajectories or if AGV plans its own
 * trajectory.
 *
 * The trajectory is to be communicated as a NURBS and is defined in chapter 6.4.
 * Trajectory segments are from the point where the AGV starts to enter the edge until the
 * point where it reports that the next node was traversed.
 */
export interface Trajectory {
    /**
     * List of JSON controlPoint objects defining the control points of the NURBS. This includes
     * the start and end point.
     */
    controlPoints: ControlPoint[];
    /**
     * Defines the number of control points that influence any given point on the curve.
     * Increasing the degree increases continuity.
     * If not defined, the default value is 1.
     */
    degree: number;
    /**
     * Sequence of parameter values that determine where and how the control points affect the
     * NURBS curve. knotVector has size of number of control points + degree + 1
     */
    knotVector: number[];
}
export interface ControlPoint {
    /**
     * Range: [-pi .. pi]. Orientation of the AGV on this position of the curve. The orientation
     * is in world coordinates.
     * When not defined the orientation of the AGV will be tangential to the curve.
     */
    orientation?: number;
    /**
     * Range: (0 .. Infinity). The weight with which this control point pulls on the curve.
     * When not defined, the default will be 1.0.
     */
    weight?: number;
    /**
     * X coordinate described in the world coordinate system.
     */
    x: number;
    /**
     * Y coordinate described in the world coordinate system.
     */
    y: number;
}
export interface Node {
    /**
     * Array of actions that are to be executed on the node. Their sequence in the list governs
     * their sequence of execution.
     */
    actions: Action[];
    /**
     * Verbose Node Description.
     */
    nodeDescription?: string;
    /**
     * Unique node identification. For example: pumpenhaus_1, MONTAGE
     */
    nodeId: string;
    /**
     * Defines the position on a map in world coordinates. Each floor has its own map. Precision
     * is up to the specific implementation.
     */
    nodePosition?: NodePosition;
    /**
     * If true, the node is part of the base plan. If false, the node is part of the horizon
     * plan.
     */
    released: boolean;
    /**
     * Id to track the sequence of nodes and edges in an order and to simplify order updates.
     * The main purpose is to distinguish between a node which is passed more than once within
     * one orderId. The variable sequenceId can run across all nodes and edges of the same order
     * and is reset when a new orderId is issued.
     */
    sequenceId: number;
}
/**
 * Defines the position on a map in world coordinates. Each floor has its own map. Precision
 * is up to the specific implementation.
 *
 * Node position. The object is defined in chapter 6.6. Optional: master control has this
 * information. Can be sent additionally, e.g. for debugging purposes.
 */
export interface NodePosition {
    /**
     * Indicates how big the deviation of theta angle can be. The lowest acceptable angle is
     * theta - allowedDeviationTheta and the highest acceptable angle is theta +
     * allowedDeviationTheta.
     * If = 0: no deviation is allowed (no deviation means within the normal tolerance of the
     * AGV manufacturer).
     */
    allowedDeviationTheta?: number;
    /**
     * Indicates how exact an AGV has to drive over a node in order for it to count as
     * traversed.
     * If = 0: no deviation is allowed (no deviation means within the normal tolerance of the
     * AGV manufacturer).
     * If > 0: allowed deviation-radius in meters. If the AGV passes a node within the
     * deviation-radius, the node is considered to have been traversed.
     */
    allowedDeviationXy?: number;
    /**
     * Verbose description of the Map
     */
    mapDescription?: string;
    /**
     * Unique identification of the map in which the position is referenced.
     * Each map has the same origin of coordinates. When an AGV uses an elevator, e. g. leading
     * from a departure floor to a target floor, it will disappear off the map of the departure
     * floor and spawn in the related lift node on the map of the target floor.
     */
    mapId: string;
    /**
     * Range: [-pi .. pi].
     * Orientation of the AGV on the node.
     * Optional: vehicle can plan the path by itself.
     * If defined, the AGV has to assume the theta angle on this node.
     * If previous edge disallows rotation, the AGV is to rotate on the node.
     * If following edge has a differing orientation defined but disallows rotation, the AGV is
     * to rotate on the node to the edges desired rotation before entering the edge.
     */
    theta?: number;
    /**
     * X coordinate described in the world coordinate system.
     */
    x: number;
    /**
     * Y coordinate described in the world coordinate system.
     */
    y: number;
}
/**
 * All encompassing state of the AGV.
 */
export interface State {
    /**
     * headerId of the message. The headerId is defined per topic and incremented by 1 with each
     * sent (but not necessarily received) message.
     */
    headerId: number;
    /**
     * Manufacturer of the AGV
     */
    manufacturer: string;
    /**
     * Serial number of the AGV
     */
    serialNumber: string;
    /**
     * Timestamp (ISO8601, UTC); YYYY-MM-DDTHH:mm:ss.ssZ; e.g. 2017-04-15T11:40:03.12Z
     */
    timestamp: string;
    /**
     * Version of the protocol [Major].[Minor].[Patch], e.g. 1.3.2
     */
    version: string;
    /**
     * Contains a list of the current actions and the actions which are yet to be finished. This
     * may include actions from previous nodes that are still in progress.
     * When an action is completed, an updated state message is published with actionStatus set
     * to finished and if applicable with the corresponding resultDescription. The actionStates
     * are kept until a new order is received.
     */
    actionStates: ActionState[];
    /**
     * Current position of the AGV on the map.
     * Optional: Can only be omitted for AGVs without the capability to localize themselves,
     * e.g. line guided AGVs.
     */
    agvPosition?: AgvPosition;
    /**
     * Contains all battery-related information.
     */
    batteryState: BatteryState;
    /**
     * Used by line guided vehicles to indicate the distance it has been driving past the
     * lastNodeId.
     * Distance is in meters
     */
    distanceSinceLastNode?: number;
    /**
     * True: indicates that the AGV is driving and/or rotating. Other movements of the AGV (e.g.
     * lift movements) are not included here.
     * False: indicates that the AGV is neither driving nor rotating
     */
    driving: boolean;
    /**
     * Information about the edges the AGV still has to drive over. Empty list if the AGV is
     * idle.
     */
    edgeStates: EdgeState[];
    /**
     * Array of error objects. All active errors of the AGV should be in the list. An empty
     * array indicates that the AGV has no active errors.
     */
    errors: Error[];
    /**
     * Array of information objects. An empty array indicates that the AGV has no information.
     * This should only be used for visualization or debugging – it must not be used for logic
     * in master control. Objects are only for visualization/debugging. There's no specification
     * when these objects are deleted.
     */
    information?: Information[];
    /**
     * nodeID of last reached node or, if AGV is currently on a node, current node (e. g.
     * node7). Empty string ("") if no lastNodeId is available.
     */
    lastNodeId: string;
    /**
     * sequenceId of the last reached node or, if the AGV is currently on a node, sequenceId of
     * current node.
     * 0 if no lastNodeSequenceId is available.
     */
    lastNodeSequenceId: number;
    /**
     * Array for information about the loads that an AGV currently carries, if the AGV has any
     * information about them. This array is optional: if an AGV cannot reason about its load
     * state, it shall not send this field. If an empty field is sent, MC is to assume that the
     * AGV can reason about its load state and that the AGV currently does not carry a load.
     */
    loads?: Load[];
    /**
     * True: AGV is almost at the end of the base and will reduce speed if no new base is
     * transmitted. Trigger for MC to send new base
     * False: no base update required
     */
    newBaseRequest?: boolean;
    /**
     * Information about the nodes the AGV still has to drive over. Empty list if idle.
     */
    nodeStates: NodeState[];
    /**
     * Current operating mode of the AGV. For additional information, see the table
     * OperatingModes in chapter 6.10.6.
     */
    operatingMode: OperatingMode;
    /**
     * Unique order identification of the current order or the previous finished order. The
     * orderId is kept until a new order is received. Empty string ("") if no previous orderId
     * is available.
     */
    orderId: string;
    /**
     * Order Update Identification to identify that an order update has been accepted by the
     * AGV. 0 if no previous orderUpdateId is available.
     */
    orderUpdateId: number;
    /**
     * True: AGV is currently in a paused state, either because of the push of a physical button
     * on the AGV or because of an instantAction. The AGV can resume the order.
     * False: The AGV is currently not in a paused state.
     */
    paused?: boolean;
    /**
     * Object that holds information about the safety status
     */
    safetyState: SafetyStatus;
    /**
     * The AGVs velocity in vehicle coordinates.
     */
    velocity?: Velocity;
    /**
     * Unique ID of the zone set that the AGV currently uses for path planning. Must be the same
     * as the one used in the order, otherwise the AGV is to reject the order.
     * Optional: If the AGV does not use zones, this field can be omitted.
     */
    zoneSetId?: string;
}
export interface ActionState {
    /**
     * Additional information on the action.
     */
    actionDescription?: string;
    /**
     * Unique actionId, e.g. blink_123jdaimoim234
     */
    actionId: string;
    /**
     * Action status.
     * WAITING: Action was received by AGV but the node where it triggers was not yet reached or
     * the edge where it is active was not yet entered.
     * INITIALIZING: Action was triggered, preparatory measures are initiated.
     * RUNNING: The action is running.
     * PAUSED: The action is paused because of a pause instantAction or external trigger (pause
     * button on AGV).
     * FINISHED: The action is finished. A result is reported via the resultDescription.
     * FAILED: Action could not be finished for whatever reason.
     */
    actionStatus: ActionStatus;
    /**
     * actionType of the action.
     * Optional: Only for informational or visualization purposes. Order knows the type.
     */
    actionType?: string;
    /**
     * Description of the result, e.g. the result of a rfid-read.
     */
    resultDescription?: string;
}
/**
 * Action status.
 * WAITING: Action was received by AGV but the node where it triggers was not yet reached or
 * the edge where it is active was not yet entered.
 * INITIALIZING: Action was triggered, preparatory measures are initiated.
 * RUNNING: The action is running.
 * PAUSED: The action is paused because of a pause instantAction or external trigger (pause
 * button on AGV).
 * FINISHED: The action is finished. A result is reported via the resultDescription.
 * FAILED: Action could not be finished for whatever reason.
 */
export declare enum ActionStatus {
    Failed = "FAILED",
    Finished = "FINISHED",
    Initializing = "INITIALIZING",
    Paused = "PAUSED",
    Running = "RUNNING",
    Waiting = "WAITING"
}
/**
 * Current position of the AGV on the map.
 * Optional: Can only be omitted for AGVs without the capability to localize themselves,
 * e.g. line guided AGVs.
 */
export interface AgvPosition {
    /**
     * Value for the deviation range of the position in meters.
     * Optional for vehicles that cannot estimate their deviation e.g. grid-based localization.
     * Only for logging and visualization purposes.
     */
    deviationRange?: number;
    /**
     * Describes the quality of the localization and therefore, can be used e.g. by SLAM-AGVs to
     * describe how accurate the current position information is.
     * 0.0: position unknown
     * 1.0: position known
     * Optional for vehicles that cannot estimate their localization score.
     * Only for logging and visualization purposes
     */
    localizationScore?: number;
    /**
     * Additional information on the map.
     */
    mapDescription?: string;
    /**
     * Unique identification of the map in which the position is referenced.
     * Each map has the same origin of coordinates. When an AGV uses an elevator, e.g. leading
     * from a departure floor to a target floor, it will disappear off the map of the departure
     * floor and spawn in the related lift node on the map of the target floor.
     */
    mapId: string;
    /**
     * True if the AGVs position is initialized, false, if position is not initialized.
     */
    positionInitialized: boolean;
    /**
     * Range: [-pi ... pi]
     * Orientation of the AGV.
     */
    theta: number;
    /**
     * X-position on the map in reference to the map coordinate system. Precision is up to the
     * specific implementation.
     */
    x: number;
    /**
     * Y-position on the map in reference to the map coordinate system. Precision is up to the
     * specific implementation.
     */
    y: number;
}
/**
 * Contains all battery-related information.
 */
export interface BatteryState {
    /**
     * State of Charge in percent as a float value:
     * If AGV only provides values for good or bad battery levels, these will be indicated as
     * 20% (bad) and 80% (good).
     */
    batteryCharge: number;
    /**
     * State of health in percent as an integer within range [0..100]
     */
    batteryHealth?: number;
    /**
     * Battery voltage
     */
    batteryVoltage?: number;
    /**
     * If true: Charging in progress. If false: AGV is currently not charging.
     */
    charging: boolean;
    /**
     * Estimated reach with current State of Charge (in meter as uint32)
     */
    reach?: number;
}
export interface EdgeState {
    /**
     * Verbose Edge description
     */
    edgeDescription?: string;
    /**
     * Unique edge identification
     */
    edgeId: string;
    /**
     * True: Edge is part of base. False: Edge is part of horizon.
     */
    released: boolean;
    /**
     * sequenceId of the edge.
     */
    sequenceId: number;
    /**
     * The trajectory is to be communicated as a NURBS and is defined in chapter 6.4.
     * Trajectory segments are from the point where the AGV starts to enter the edge until the
     * point where it reports that the next node was traversed.
     */
    trajectory?: Trajectory;
}
/**
 * An error object.
 */
export interface Error {
    /**
     * Verbose description of error.
     */
    errorDescription?: string;
    /**
     * Error level.
     * WARNING: AGV is ready to start (e.g. maintenance cycle expiration warning).
     * FATAL: AGV is not in running condition, user intervention required (e.g. laser scanner is
     * contaminated).
     */
    errorLevel: ErrorLevel;
    /**
     * Array of references to identify the source of the error (e. g. headerId, orderId,
     * actionId, ...).
     * For additional information see "Best Practice" chapter 7.
     */
    errorReferences?: ErrorReference[];
    /**
     * Type / name of error.
     */
    errorType: string;
}
/**
 * Error level.
 * WARNING: AGV is ready to start (e.g. maintenance cycle expiration warning).
 * FATAL: AGV is not in running condition, user intervention required (e.g. laser scanner is
 * contaminated).
 */
export declare enum ErrorLevel {
    Fatal = "FATAL",
    Warning = "WARNING"
}
/**
 * Object that holds the error reference (e.g. orderId, orderUpdateId, actionId...) as
 * key-value pairs.
 */
export interface ErrorReference {
    /**
     * References the type of reference (e. g. headerId, orderId, actionId, ...).
     */
    referenceKey: string;
    /**
     * References the value, which belongs to the reference key.
     */
    referenceValue: string;
}
/**
 * An information object.
 */
export interface Information {
    /**
     * Info description.
     */
    infoDescription?: string;
    /**
     * Info level.
     * DEBUG: used for debugging.
     * INFO: used for visualization.
     */
    infoLevel: InfoLevel;
    /**
     * Array of references.
     */
    infoReferences?: InfoReference[];
    /**
     * Type / name of information.
     */
    infoType: string;
}
/**
 * Info level.
 * DEBUG: used for debugging.
 * INFO: used for visualization.
 */
export declare enum InfoLevel {
    Debug = "DEBUG",
    Info = "INFO"
}
/**
 * Object that holds the info reference (e.g. orderId, orderUpdateId, actionId...) as
 * key-value pairs.
 */
export interface InfoReference {
    /**
     * References the type of reference (e. g. headerId, orderId, actionId, ...).
     */
    referenceKey: string;
    /**
     * References the value, which belongs to the reference key.
     */
    referenceValue: string;
}
/**
 * Load object that describes the load if the AGV has information about it.
 */
export interface Load {
    /**
     * This point describes the loads position on the AGV in the vehicle coordinates. The
     * boundingBoxReference point is in the middle of the footprint of the load, so length/2 and
     * width/2.
     */
    boundingBoxReference?: BoundingBoxReference;
    /**
     * Dimensions of the load's bounding box in meters.
     */
    loadDimensions?: LoadDimensions;
    /**
     * Unique identification number of the load (e. g. barcode or RFID)
     * Empty field if the AGV can identify the load but didn't identify the load yet.
     * Optional if the AGV has cannot identify the load.
     */
    loadId?: string;
    /**
     * Indicates which load handling/carrying unit of the AGV is used, e. g. in case the AGV has
     * multiple spots/positions to carry loads.
     * For example: front, back, positionC1, etc.
     * Optional for vehicles with only one loadPosition.
     */
    loadPosition?: string;
    /**
     * Type of load.
     */
    loadType?: string;
    /**
     * Weight of load in kg
     */
    weight?: number;
}
/**
 * This point describes the loads position on the AGV in the vehicle coordinates. The
 * boundingBoxReference point is in the middle of the footprint of the load, so length/2 and
 * width/2.
 */
export interface BoundingBoxReference {
    /**
     * Orientation of the loads bounding box. Important for tugger trains etc.
     */
    theta?: number;
    /**
     * x-coordinate of the point of reference.
     */
    x: number;
    /**
     * y-coordinate of the point of reference.
     */
    y: number;
    /**
     * z-coordinate of the point of reference.
     */
    z: number;
}
/**
 * Dimensions of the load's bounding box in meters.
 */
export interface LoadDimensions {
    /**
     * Absolute height of the loads bounding box in meter.
     * Optional:
     * Set value only if known.
     */
    height?: number;
    /**
     * Absolute length of the loads bounding box in meter.
     */
    length: number;
    /**
     * Absolute width of the loads bounding box in meter.
     */
    width: number;
}
export interface NodeState {
    /**
     * Verbose node description
     */
    nodeDescription?: string;
    /**
     * Unique node identification
     */
    nodeId: string;
    /**
     * Node position. The object is defined in chapter 6.6. Optional: master control has this
     * information. Can be sent additionally, e.g. for debugging purposes.
     */
    nodePosition?: NodePosition;
    /**
     * True: indicates that the node is part of the base. False: indicates that the node is part
     * of the horizon.
     */
    released: boolean;
    /**
     * sequenceId of the node.
     */
    sequenceId: number;
}
/**
 * Current operating mode of the AGV. For additional information, see the table
 * OperatingModes in chapter 6.10.6.
 */
export declare enum OperatingMode {
    Automatic = "AUTOMATIC",
    Manual = "MANUAL",
    Semiautomatic = "SEMIAUTOMATIC",
    Service = "SERVICE",
    Teachin = "TEACHIN"
}
/**
 * Object that holds information about the safety status
 */
export interface SafetyStatus {
    /**
     * Acknowledge type of eStop.
     * AUTOACK: auto-acknowledgeable e-stop is activated e.g. by bumper or protective field.
     * MANUAL: e-stop has to be acknowledged manually at the vehicle.
     * REMOTE: facility e-stop has to be acknowledged remotely.
     * NONE: no e-stop activated.
     */
    eStop: EStop;
    /**
     * Protective field violation. true: field is violated. false: field is not violated.
     */
    fieldViolation: boolean;
}
/**
 * Acknowledge type of eStop.
 * AUTOACK: auto-acknowledgeable e-stop is activated e.g. by bumper or protective field.
 * MANUAL: e-stop has to be acknowledged manually at the vehicle.
 * REMOTE: facility e-stop has to be acknowledged remotely.
 * NONE: no e-stop activated.
 */
export declare enum EStop {
    Autoack = "AUTOACK",
    Manual = "MANUAL",
    None = "NONE",
    Remote = "REMOTE"
}
/**
 * The AGVs velocity in vehicle coordinates.
 */
export interface Velocity {
    /**
     * The AGVs turning speed around its z axis.
     */
    omega?: number;
    /**
     * The AGVs velocity in its x direction.
     */
    vx?: number;
    /**
     * The AGVs velocity in its y direction.
     */
    vy?: number;
}
/**
 * AGV position and/or velocity for visualization purposes. Can be published at a higher
 * rate if wanted. Since bandwidth may be expensive depening on the update rate for this
 * topic, all fields are optional.
 */
export interface Visualization {
    /**
     * headerId of the message. The headerId is defined per topic and incremented by 1 with each
     * sent (but not necessarily received) message.
     */
    headerId: number;
    /**
     * Manufacturer of the AGV
     */
    manufacturer: string;
    /**
     * Serial number of the AGV
     */
    serialNumber: string;
    /**
     * Timestamp (ISO8601, UTC); YYYY-MM-DDTHH:mm:ss.ssZ; e.g. 2017-04-15T11:40:03.12Z
     */
    timestamp: string;
    /**
     * Version of the protocol [Major].[Minor].[Patch], e.g. 1.3.2
     */
    version: string;
    /**
     * Current position of the AGV on the map.
     * Optional: Can only be omitted for AGVs without the capability to localize themselves,
     * e.g. line guided AGVs.
     */
    agvPosition?: AgvPosition;
    /**
     * The AGVs velocity in vehicle coordinates.
     */
    velocity?: Velocity;
}
