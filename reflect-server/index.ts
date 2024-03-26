import { serverMutators} from "../src/datamodel/mutators.js";
import {
  ReflectServerBaseEnv,
  createReflectServer,
  datadogLogging,
  datadogMetrics,
  defaultConsoleLogSink,
  logLevel,
  newOptionsBuilder,
} from '@rocicorp/reflect/server';


type ReflectNetServerEnv = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  NEW_ROOM_SECRET?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  CLEAN_ROOM_UID?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  DATADOG_METRICS_API_KEY?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  DATADOG_LOGS_API_KEY?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  DATADOG_SERVICE_LABEL?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  LOG_LEVEL?: string; // should be 'error', 'debug', or 'info'
} & ReflectServerBaseEnv;

const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_DATADOG_SERVICE_LABEL = 'cesar-load-test';

const {
  worker,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  RoomDO: SuperRoomDO,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AuthDO,
} = createReflectServer(
  newOptionsBuilder((_: ReflectNetServerEnv) => ({
    mutators: serverMutators,
    maxMutationsPerTurn: 100,
  }))
    .add(logLevel(DEFAULT_LOG_LEVEL))
    .add(defaultConsoleLogSink())
    .add(datadogLogging(DEFAULT_DATADOG_SERVICE_LABEL))
    .add(datadogMetrics(DEFAULT_DATADOG_SERVICE_LABEL))
    .build(),
);

class RoomDO extends SuperRoomDO {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(state: any, env: ReflectNetServerEnv) {
    super(state, env);
  }
}

export {AuthDO, RoomDO, worker as default};