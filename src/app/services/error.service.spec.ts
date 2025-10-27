/**
 * Copyright (C) 2023-2025 Civic OS, L3C
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ErrorService } from './error.service';
import { AnalyticsService } from './analytics.service';
import { ApiError } from '../interfaces/api';

describe('ErrorService', () => {
  let service: ErrorService;
  let mockAnalyticsService: jasmine.SpyObj<AnalyticsService>;

  beforeEach(() => {
    mockAnalyticsService = jasmine.createSpyObj('AnalyticsService', ['trackError']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AnalyticsService, useValue: mockAnalyticsService }
      ]
    });
    service = TestBed.inject(ErrorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('parseToHuman()', () => {
    it('should return permissions error for code 42501', () => {
      const error: ApiError = {
        code: '42501',
        httpCode: 403,
        message: 'insufficient_privilege',
        details: '',
        humanMessage: 'Permissions error'
      };

      const result = ErrorService.parseToHuman(error);
      expect(result).toBe('Permissions error');
    });

    it('should return unique constraint error for code 23505', () => {
      const error: ApiError = {
        code: '23505',
        httpCode: 409,
        message: 'duplicate key value',
        details: '',
        humanMessage: 'Could not update'
      };

      const result = ErrorService.parseToHuman(error);
      expect(result).toBe('Record must be unique');
    });

    it('should return validation error for code 23514', () => {
      const error: ApiError = {
        code: '23514',
        httpCode: 400,
        message: 'check constraint violated',
        details: '',
        humanMessage: 'Could not update'
      };

      const result = ErrorService.parseToHuman(error);
      expect(result).toBe('Validation failed');
    });

    it('should extract constraint name from CHECK violation details', () => {
      const error: ApiError = {
        code: '23514',
        httpCode: 400,
        message: 'new row violates check constraint "price_positive"',
        details: 'Failing row contains (1, "Product", -10.00)',
        humanMessage: 'Could not update'
      };

      const result = ErrorService.parseToHuman(error);
      expect(result).toBe('Validation failed: price_positive');
    });

    it('should return not found error for HTTP 404', () => {
      const error: ApiError = {
        httpCode: 404,
        message: 'Resource not found',
        details: '',
        humanMessage: 'Not found'
      };

      const result = ErrorService.parseToHuman(error);
      expect(result).toBe('Resource not found');
    });

    it('should return session expired error for HTTP 401', () => {
      const error: ApiError = {
        httpCode: 401,
        message: 'Session expired',
        details: '',
        humanMessage: 'Session Expired'
      };

      const result = ErrorService.parseToHuman(error);
      expect(result).toBe('Your session has expired. Please refresh the page to log in again.');
    });

    it('should return generic error for unknown error codes', () => {
      const error: ApiError = {
        httpCode: 500,
        message: 'Internal server error',
        details: '',
        humanMessage: 'System Error'
      };

      const result = ErrorService.parseToHuman(error);
      expect(result).toBe('System Error');
    });
  });
});
