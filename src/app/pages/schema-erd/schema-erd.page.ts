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
      console.log('[SchemaErdPage] Initial theme detected:', initialTheme);
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

      console.log('[SchemaErdPage] Effect triggered - theme signal value:', theme);

      if (syntax && container && isPlatformBrowser(this.platformId)) {
        try {
          console.log('[SchemaErdPage] Rendering diagram with theme:', theme);
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
      console.log('[SchemaErdPage] Theme observer disconnected');
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
    console.log('[SchemaErdPage] Mermaid initialized with theme:', theme);
  }

  /**
   * Sets up MutationObserver to watch for theme changes
   */
  private setupThemeWatcher(): void {
    if (typeof window === 'undefined') return;

    console.log('[SchemaErdPage] Setting up theme watcher on:', document.documentElement);

    this.themeObserver = new MutationObserver((mutations) => {
      console.log('[SchemaErdPage] MutationObserver triggered, mutations:', mutations.length);

      mutations.forEach((mutation) => {
        console.log('[SchemaErdPage] Mutation:', {
          type: mutation.type,
          attributeName: mutation.attributeName,
          oldValue: mutation.oldValue,
          newValue: (mutation.target as HTMLElement).getAttribute('data-theme')
        });

        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const newTheme = this.detectTheme();
          const oldTheme = this.currentTheme();
          console.log('[SchemaErdPage] Theme changed from', oldTheme, 'to:', newTheme);
          this.currentTheme.set(newTheme);
          this.initializeMermaid(newTheme);
        }
      });
    });

    // Observe the html element for data-theme attribute changes
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
      attributeOldValue: true
    });
    console.log('[SchemaErdPage] Theme watcher initialized, watching:', document.documentElement.tagName);
    console.log('[SchemaErdPage] Current data-theme value:', document.documentElement.getAttribute('data-theme'));
  }

  /**
   * Maps DaisyUI theme to appropriate Mermaid theme
   */
  private detectTheme(): string {
    if (typeof window === 'undefined') return 'default';

    const html = document.documentElement;
    const daisyTheme = html.getAttribute('data-theme');

    // Map each DaisyUI theme to the most appropriate Mermaid theme
    switch (daisyTheme) {
      case 'dark':
        return 'dark';
      case 'nord':
        return 'neutral';
      case 'corporate':
        return 'neutral';
      case 'emerald':
        return 'forest';
      case 'light':
        return 'default';
      default:
        return 'default';
    }
  }
}
