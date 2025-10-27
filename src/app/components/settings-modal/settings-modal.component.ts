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

import { Component, ChangeDetectionStrategy, input, output, signal, inject, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../services/analytics.service';
import { getMatomoConfig } from '../../config/runtime';

/**
 * Settings modal component for user preferences.
 *
 * Currently contains:
 * - Analytics opt-out preference (localStorage-based)
 *
 * Future enhancements could include:
 * - Default list page size
 * - Table column visibility defaults
 * - Notification preferences
 * - Display preferences
 */
@Component({
  selector: 'app-settings-modal',
  imports: [FormsModule],
  templateUrl: './settings-modal.component.html',
  styleUrl: './settings-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsModalComponent {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly matomoConfig = getMatomoConfig();

  // Input: Control visibility of modal
  showModal = input.required<boolean>();

  // Output: Notify parent to close modal
  closeModal = output<void>();

  // State: Analytics enabled/disabled preference
  analyticsEnabled = signal<boolean>(true);

  // Check if analytics is configured at all
  analyticsConfigured = this.matomoConfig.url && this.matomoConfig.siteId;

  constructor() {
    // Load initial preference from localStorage
    this.analyticsEnabled.set(this.analyticsService.getUserPreference());
  }

  /**
   * Handle analytics checkbox change.
   * Updates localStorage and notifies AnalyticsService.
   */
  onAnalyticsToggle(): void {
    const enabled = this.analyticsEnabled();
    this.analyticsService.setEnabled(enabled);
  }

  /**
   * Close the modal.
   * Emits closeModal event to parent component.
   */
  close(): void {
    this.closeModal.emit();
  }
}
