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

import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Highlights search terms in text by wrapping them in <mark> tags.
 * Handles HTML escaping to prevent XSS attacks.
 */
@Pipe({
  name: 'highlight',
  standalone: true
})
export class HighlightPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined, terms: string[] | null | undefined): SafeHtml {
    // Return original value if no value or no terms to highlight
    if (!value || !terms?.length) {
      return value || '';
    }

    // Escape HTML to prevent XSS
    let highlighted = this.escapeHtml(value);

    // Highlight each term (case-insensitive)
    terms.forEach(term => {
      if (term && term.trim()) {
        const escaped = this.escapeRegex(term.trim());
        const regex = new RegExp(`(${escaped})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark class="bg-warning/30">$1</mark>');
      }
    });

    // Sanitize the result to allow only <mark> tags
    return this.sanitizer.sanitize(SecurityContext.HTML, highlighted) || '';
  }

  /**
   * Escapes HTML special characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escapes special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
