"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EStop = exports.OperatingMode = exports.InfoLevel = exports.ErrorLevel = exports.ActionStatus = exports.OrientationType = exports.BlockingType = exports.NavigationType = exports.LocalizationType = exports.AgvKinematic = exports.AgvClass = exports.Support = exports.AgvActionActionScope = exports.ValueDataType = exports.Type = exports.ConnectionState = void 0;
var ConnectionState;
(function (ConnectionState) {
    ConnectionState["Connectionbroken"] = "CONNECTIONBROKEN";
    ConnectionState["Offline"] = "OFFLINE";
    ConnectionState["Online"] = "ONLINE";
})(ConnectionState = exports.ConnectionState || (exports.ConnectionState = {}));
var Type;
(function (Type) {
    Type["Caster"] = "CASTER";
    Type["Drive"] = "DRIVE";
    Type["Fixed"] = "FIXED";
    Type["Mecanum"] = "MECANUM";
})(Type = exports.Type || (exports.Type = {}));
var ValueDataType;
(function (ValueDataType) {
    ValueDataType["Array"] = "ARRAY";
    ValueDataType["Bool"] = "BOOL";
    ValueDataType["Float"] = "FLOAT";
    ValueDataType["Integer"] = "INTEGER";
    ValueDataType["Number"] = "NUMBER";
    ValueDataType["Object"] = "OBJECT";
    ValueDataType["String"] = "STRING";
})(ValueDataType = exports.ValueDataType || (exports.ValueDataType = {}));
var AgvActionActionScope;
(function (AgvActionActionScope) {
    AgvActionActionScope["Edge"] = "EDGE";
    AgvActionActionScope["Instant"] = "INSTANT";
    AgvActionActionScope["Node"] = "NODE";
})(AgvActionActionScope = exports.AgvActionActionScope || (exports.AgvActionActionScope = {}));
var Support;
(function (Support) {
    Support["Required"] = "REQUIRED";
    Support["Supported"] = "SUPPORTED";
})(Support = exports.Support || (exports.Support = {}));
var AgvClass;
(function (AgvClass) {
    AgvClass["Carrier"] = "CARRIER";
    AgvClass["Conveyor"] = "CONVEYOR";
    AgvClass["Forklift"] = "FORKLIFT";
    AgvClass["Tugger"] = "TUGGER";
})(AgvClass = exports.AgvClass || (exports.AgvClass = {}));
var AgvKinematic;
(function (AgvKinematic) {
    AgvKinematic["Diff"] = "DIFF";
    AgvKinematic["Omni"] = "OMNI";
    AgvKinematic["Threewheel"] = "THREEWHEEL";
})(AgvKinematic = exports.AgvKinematic || (exports.AgvKinematic = {}));
var LocalizationType;
(function (LocalizationType) {
    LocalizationType["Dmc"] = "DMC";
    LocalizationType["Grid"] = "GRID";
    LocalizationType["Natural"] = "NATURAL";
    LocalizationType["RFID"] = "RFID";
    LocalizationType["Reflector"] = "REFLECTOR";
    LocalizationType["Spot"] = "SPOT";
})(LocalizationType = exports.LocalizationType || (exports.LocalizationType = {}));
var NavigationType;
(function (NavigationType) {
    NavigationType["Autonomous"] = "AUTONOMOUS";
    NavigationType["PhysicalLindeGuided"] = "PHYSICAL_LINDE_GUIDED";
    NavigationType["VirtualLineGuided"] = "VIRTUAL_LINE_GUIDED";
})(NavigationType = exports.NavigationType || (exports.NavigationType = {}));
var BlockingType;
(function (BlockingType) {
    BlockingType["Hard"] = "HARD";
    BlockingType["None"] = "NONE";
    BlockingType["Soft"] = "SOFT";
})(BlockingType = exports.BlockingType || (exports.BlockingType = {}));
var OrientationType;
(function (OrientationType) {
    OrientationType["Global"] = "GLOBAL";
    OrientationType["Tangential"] = "TANGENTIAL";
})(OrientationType = exports.OrientationType || (exports.OrientationType = {}));
var ActionStatus;
(function (ActionStatus) {
    ActionStatus["Failed"] = "FAILED";
    ActionStatus["Finished"] = "FINISHED";
    ActionStatus["Initializing"] = "INITIALIZING";
    ActionStatus["Paused"] = "PAUSED";
    ActionStatus["Running"] = "RUNNING";
    ActionStatus["Waiting"] = "WAITING";
})(ActionStatus = exports.ActionStatus || (exports.ActionStatus = {}));
var ErrorLevel;
(function (ErrorLevel) {
    ErrorLevel["Fatal"] = "FATAL";
    ErrorLevel["Warning"] = "WARNING";
})(ErrorLevel = exports.ErrorLevel || (exports.ErrorLevel = {}));
var InfoLevel;
(function (InfoLevel) {
    InfoLevel["Debug"] = "DEBUG";
    InfoLevel["Info"] = "INFO";
})(InfoLevel = exports.InfoLevel || (exports.InfoLevel = {}));
var OperatingMode;
(function (OperatingMode) {
    OperatingMode["Automatic"] = "AUTOMATIC";
    OperatingMode["Manual"] = "MANUAL";
    OperatingMode["Semiautomatic"] = "SEMIAUTOMATIC";
    OperatingMode["Service"] = "SERVICE";
    OperatingMode["Teachin"] = "TEACHIN";
})(OperatingMode = exports.OperatingMode || (exports.OperatingMode = {}));
var EStop;
(function (EStop) {
    EStop["Autoack"] = "AUTOACK";
    EStop["Manual"] = "MANUAL";
    EStop["None"] = "NONE";
    EStop["Remote"] = "REMOTE";
})(EStop = exports.EStop || (exports.EStop = {}));
