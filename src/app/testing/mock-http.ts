import { HttpTestingController } from '@angular/common/http/testing';

/**
 * Helper to expect a PostgREST request and flush a response.
 *
 * @param httpMock - The HttpTestingController from Angular's testing module
 * @param path - The path segment to match in the request URL (e.g., 'schema_entities' or 'Issue')
 * @param responseData - The data to return in the response
 * @returns The matched HttpRequest for further assertions
 */
export function expectPostgrestRequest(
  httpMock: HttpTestingController,
  path: string,
  responseData: any
) {
  const req = httpMock.expectOne(req => req.url.includes(path));
  req.flush(responseData);
  return req;
}

/**
 * Helper to expect a PostgREST request with specific query parameters.
 *
 * @param httpMock - The HttpTestingController
 * @param path - The base path (e.g., 'Issue')
 * @param params - Object of query parameters to match (e.g., { select: 'id,name', order: 'id.asc' })
 * @param responseData - The data to return
 */
export function expectPostgrestRequestWithParams(
  httpMock: HttpTestingController,
  path: string,
  params: Record<string, string>,
  responseData: any
) {
  const req = httpMock.expectOne(req => {
    if (!req.url.includes(path)) return false;

    // Check all expected params are present
    return Object.entries(params).every(([key, value]) => {
      return req.url.includes(`${key}=${value}`);
    });
  });

  req.flush(responseData);
  return req;
}

/**
 * Verifies no outstanding HTTP requests remain.
 * Call this in afterEach() to ensure clean test state.
 */
export function verifyNoOutstandingRequests(httpMock: HttpTestingController) {
  httpMock.verify();
}
