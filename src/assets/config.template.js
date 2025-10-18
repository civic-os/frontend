/**
 * Copyright (C) 2023-2025 Civic OS, L3C
 * AGPL-3.0-or-later
 *
 * Runtime Configuration Template
 *
 * This file is processed by the Docker entrypoint script at container startup.
 * Environment variables are substituted using envsubst to create /assets/config.js
 * which is then loaded by the Angular application before bootstrap.
 */

window.civicOsConfig = {
  postgrestUrl: '${POSTGREST_URL}',
  map: {
    tileUrl: '${MAP_TILE_URL}',
    attribution: "${MAP_ATTRIBUTION}",
    defaultCenter: [parseFloat('${MAP_DEFAULT_LAT}'), parseFloat('${MAP_DEFAULT_LNG}')],
    defaultZoom: parseInt('${MAP_DEFAULT_ZOOM}')
  },
  keycloak: {
    url: '${KEYCLOAK_URL}',
    realm: '${KEYCLOAK_REALM}',
    clientId: '${KEYCLOAK_CLIENT_ID}'
  }
};
