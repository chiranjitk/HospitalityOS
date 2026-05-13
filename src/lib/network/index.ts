/**
 * Network Library — Barrel Export
 *
 * Re-exports all active network operation wrappers.
 * OS-level network ops use either nmcli (primary) or shell scripts (multiwan, routes, aliases).
 *
 * Architecture:
 *   GUI → API Route → This Library → nmcli / Shell Scripts → OS
 */

// Executor (core utility for shell script wrappers)
export {
  executeScript,
  sanitizeInput,
  sanitizeInterfaceName,
  validateIPv4,
  validateVlanId,
  validateMtu,
  validateNetmask,
  validateBondMode,
  validateRole,
  validateMultiWanMode,
  netmaskToCidr,
  buildScriptCommand,
  type ScriptResult,
  type ExecutorOptions,
} from './executor';

// IP Alias operations (used by wifi/network/aliases API)
export {
  addAlias,
  removeAlias,
  listAliases,
  type AliasAddParams,
  type AliasInfo,
  type AliasListResult,
  type AliasResult,
} from './alias';

// Static Route operations (used by wifi/network/routes API)
export {
  addRoute,
  deleteRoute,
  addDefaultRoute,
  listRoutes,
  type RouteAddParams,
  type RouteInfo,
  type RouteListResult,
  type RouteResult,
} from './route';

// Persistence to /etc/network/interfaces (used by wifi network APIs)
export {
  persistBridge,
  removePersistedBridge,
  persistBond,
  removePersistedBond,
  persistIPConfig,
  persistAliasAdd,
  persistAliasRemove,
  persistRouteAdd,
  persistRouteRemove,
  type PersistBridgeParams,
  type PersistBondParams,
  type PersistIPConfigParams,
  type PersistAliasParams,
  type PersistRouteParams,
  type PersistResult,
} from './persist';

// Multi-WAN / DGD operations (used by network/os/multiwan API)
export {
  applyDgdConfig,
  startDgd,
  stopDgd,
  getDgdStatus,
  resetMultiWan,
  generateDgdConf,
  checkGateway,
  type HealthRuleDef,
  type ExplicitRouteDef,
  type FwmarkDef,
  type GatewayDef,
  type MultiWanDaemonConfig,
  type MultiWanConfig,
  type MultiWanApplyResult,
  type MultiWanResetResult,
} from './multiwan';
