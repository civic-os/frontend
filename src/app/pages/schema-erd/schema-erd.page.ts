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


import { Component, inject, effect, PLATFORM_ID, ElementRef, viewChild, ChangeDetectionStrategy, signal, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SchemaErdService } from '../../services/schema-erd.service';
import { ThemeService } from '../../services/theme.service';
import { Observable } from 'rxjs';
import mermaid from 'mermaid';

@Component({
  selector: 'app-schema-erd',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './schema-erd.page.html',
  styleUrl: './schema-erd.page.css'
})
export class SchemaErdPage implements OnDestroy {
  private erdService = inject(SchemaErdService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

  // Observable for template to consume via async pipe
  mermaidSyntax$: Observable<string>;

  // Signal to store syntax once loaded
  private syntaxLoaded = signal<string | null>(null);

  // Signal to track current theme for reactivity
  private currentTheme = signal<string>('default');

  // MutationObserver to watch for theme changes
  private themeObserver?: MutationObserver;

  // ViewChild reference to the diagram container
  diagramContainer = viewChild<ElementRef<HTMLDivElement>>('diagramContainer');

  constructor() {
    this.mermaidSyntax$ = this.erdService.generateMermaidSyntax();

    // Store syntax in signal when loaded
    this.mermaidSyntax$.subscribe({
      next: (syntax) => {
        this.syntaxLoaded.set(syntax);
      },
      error: (err) => console.error('[SchemaErdPage] Observable error:', err),
      complete: () => {}
    });

    // Initialize Mermaid and set up theme watching
    if (isPlatformBrowser(this.platformId)) {
      const initialTheme = this.detectTheme();
      this.currentTheme.set(initialTheme);

      // Initialize Mermaid with detected theme
      this.initializeMermaid(initialTheme);

      // Watch for theme changes
      this.setupThemeWatcher();
    }

    // Effect: Render when syntax, theme, or container changes
    effect(async () => {
      const syntax = this.syntaxLoaded();
      const theme = this.currentTheme();
      const container = this.diagramContainer()?.nativeElement;

      if (syntax && container && isPlatformBrowser(this.platformId)) {
        try {
          const { svg } = await mermaid.render('mermaid-diagram', syntax);
          container.innerHTML = svg;
        } catch (renderError) {
          console.error('[SchemaErdPage] Mermaid render error:', renderError);
          console.error('[SchemaErdPage] Failed syntax was:', syntax);
          container.innerHTML = `<div class="alert alert-error"><span>Failed to render diagram. Check console for syntax errors.</span></div>`;
        }
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up theme observer
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }

  /**
   * Initializes Mermaid with the specified theme
   */
  private initializeMermaid(theme: string): void {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme as 'default' | 'base' | 'dark' | 'forest' | 'neutral' | 'null',
      securityLevel: 'loose',
      er: {
        useMaxWidth: true,
        layoutDirection: 'TB'
      }
    });
  }

  /**
   * Sets up MutationObserver to watch for theme changes
   */
  private setupThemeWatcher(): void {
    if (typeof window === 'undefined') return;

    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          // Wait for CSS recalculation before detecting theme
          requestAnimationFrame(() => {
            const newTheme = this.detectTheme();
            this.currentTheme.set(newTheme);
            this.initializeMermaid(newTheme);
          });
        }
      });
    });

    // Observe the html element for data-theme attribute changes
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
      attributeOldValue: true
    });
  }

  /**
   * Maps DaisyUI theme to appropriate Mermaid theme
   * Uses dynamic luminance detection for unknown themes
   */
  private detectTheme(): string {
    if (typeof window === 'undefined') return 'default';

    const html = document.documentElement;
    const daisyTheme = html.getAttribute('data-theme');

    // Special aesthetic mapping: emerald theme → forest (green tones match)
    if (daisyTheme === 'emerald') {
      return 'forest';
    }

    // For all other themes, use dynamic luminance detection
    // Dark themes → 'neutral' (better aesthetics for ERD diagrams), Light themes → 'default'
    const isDark = this.themeService.isDark();
    return isDark ? 'neutral' : 'default';
  }
}
