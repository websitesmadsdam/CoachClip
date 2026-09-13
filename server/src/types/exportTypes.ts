/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExportJobResponse } from "../../../shared/exportJob";

export type { ExportRequestMetadata } from "../../../shared/exportSchema";

// Server-internal job record: the public response shape plus file paths that must never reach the client
export type ExportJob = ExportJobResponse & {
  inputFilePath?: string;
  outputFilePath?: string;
};
