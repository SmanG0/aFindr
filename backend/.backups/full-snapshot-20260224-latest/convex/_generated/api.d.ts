/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alertChecker from "../alertChecker.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as backtests from "../backtests.js";
import type * as charts from "../charts.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as holdings from "../holdings.js";
import type * as http from "../http.js";
import type * as journal from "../journal.js";
import type * as lib_auth from "../lib/auth.js";
import type * as memory from "../memory.js";
import type * as notifications from "../notifications.js";
import type * as settings from "../settings.js";
import type * as theses from "../theses.js";
import type * as tokenUsage from "../tokenUsage.js";
import type * as trading from "../trading.js";
import type * as users from "../users.js";
import type * as watchlists from "../watchlists.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alertChecker: typeof alertChecker;
  alerts: typeof alerts;
  auth: typeof auth;
  backtests: typeof backtests;
  charts: typeof charts;
  chat: typeof chat;
  crons: typeof crons;
  holdings: typeof holdings;
  http: typeof http;
  journal: typeof journal;
  "lib/auth": typeof lib_auth;
  memory: typeof memory;
  notifications: typeof notifications;
  settings: typeof settings;
  theses: typeof theses;
  tokenUsage: typeof tokenUsage;
  trading: typeof trading;
  users: typeof users;
  watchlists: typeof watchlists;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
