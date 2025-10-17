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

import { Component, inject, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';

import { Observable, map } from 'rxjs';
import { DataService } from '../../services/data.service';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { NgxCurrencyDirective } from 'ngx-currency';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GeoPointMapComponent } from '../geo-point-map/geo-point-map.component';

@Component({
    selector: 'app-edit-property',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './edit-property.component.html',
    styleUrl: './edit-property.component.css',
    imports: [
    CommonModule,
    NgxMaskDirective,
    NgxCurrencyDirective,
    ReactiveFormsModule,
    GeoPointMapComponent
],
    providers: [
        provideNgxMask(),
    ]
})
export class EditPropertyComponent {
  private data = inject(DataService);

  prop = input.required<SchemaEntityProperty>({ alias: 'property' });
  form = input.required<FormGroup>({ alias: 'formGroup' });
  public selectOptions$?: Observable<{id: number, text: string}[]>;

  propType = computed(() => this.prop().type);

  public EntityPropertyType = EntityPropertyType;

  ngOnInit() {
    const prop = this.prop();

    // Load FK options
    if(this.propType() == EntityPropertyType.ForeignKeyName) {
      this.selectOptions$ = this.data.getData({
        key: prop.join_table,
        fields: ['id:' + prop.join_column, 'display_name'],
        orderField: 'id',
      })
      .pipe(map(data => {
        return data.map(d => {
          return {
            id: d.id,
            text: d.display_name,
          }
        });
      }));
    }

    // Load User options
    // Fetch both public and private display names (private only visible if user has permission)
    if(this.propType() == EntityPropertyType.User) {
      this.selectOptions$ = this.data.getData({
        key: 'civic_os_users',
        fields: ['id', 'display_name', 'private:civic_os_users_private(display_name,phone,email)'],
        orderField: 'display_name',
        orderDirection: 'asc'
      })
      .pipe(map(data => {
        return data.map(d => {
          // Prefer private display name (full name) if available, otherwise use public (shortened)
          // Using bracket notation because 'private' is a dynamic property not in EntityData interface
          const displayName = (d as any)['private']?.display_name || d.display_name;
          return {
            id: d.id,
            text: displayName,
          }
        });
      }));
    }

    // Note: Value transformation for datetime-local and money inputs
    // is now handled in edit.page.ts when creating FormControls.
    // This ensures transformation happens when data arrives, not when component initializes.
  }

  public onMapValueChange(ewkt: string) {
    // FormControl setValue automatically triggers change detection in OnPush
    // No setTimeout needed with Angular's reactive forms
    const prop = this.prop();
    const form = this.form();
    form.get(prop.column_name)?.setValue(ewkt);
    form.get(prop.column_name)?.markAsDirty();
  }

  // Format phone number for display: 5551234567 → (555) 123-4567
  public getFormattedPhone(controlName: string): string {
    const rawValue = this.form().get(controlName)?.value;
    if (!rawValue) return '';

    // Remove all non-digits
    const digits = rawValue.replace(/\D/g, '');

    // Format based on length
    if (digits.length <= 3) {
      return digits ? `(${digits}` : '';
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  }

  // Handle phone input: format display, store raw digits
  public onPhoneInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const cursorPos = input.selectionStart || 0;

    // Extract only digits
    const digits = input.value.replace(/\D/g, '').slice(0, 10);

    // Store raw digits in form control
    this.form().get(controlName)?.setValue(digits, { emitEvent: false });

    // Format for display
    const formatted = this.getFormattedPhone(controlName);
    input.value = formatted;

    // Restore cursor position (adjust for formatting characters)
    const digitsBeforeCursor = input.value.slice(0, cursorPos).replace(/\D/g, '').length;
    let newCursorPos = 0;
    let digitCount = 0;

    for (let i = 0; i < formatted.length && digitCount < digitsBeforeCursor; i++) {
      if (/\d/.test(formatted[i])) digitCount++;
      newCursorPos = i + 1;
    }

    input.setSelectionRange(newCursorPos, newCursorPos);
  }
}
