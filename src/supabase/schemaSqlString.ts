/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fullSchemaSql from './migrations/00_complete_flowtym_schema.sql?raw';
import ratePlanningSql from './migrations/01_bidirectional_rate_planning.sql?raw';
import rateConfigCenterSql from './migrations/03_rate_configuration_center.sql?raw';
import fullInterconnectionSql from './migrations/04_full_rms_interconnection_and_rls.sql?raw';

export const FULL_SUPABASE_SQL = `${fullSchemaSql}\n\n${ratePlanningSql}\n\n${rateConfigCenterSql}\n\n${fullInterconnectionSql}`;
