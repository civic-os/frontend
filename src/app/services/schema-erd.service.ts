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

import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, take } from 'rxjs';
import { SchemaService } from './schema.service';
import { SchemaEntityTable, SchemaEntityProperty, EntityPropertyType } from '../interfaces/entity';

/**
 * Service to convert database schema metadata into Mermaid ERD syntax.
 * Generates Entity Relationship Diagrams from schema_entities and schema_properties.
 */
@Injectable({
  providedIn: 'root'
})
export class SchemaErdService {
  private schemaService = inject(SchemaService);

  /**
   * Generates a Mermaid erDiagram syntax string from the current database schema.
   * @returns Observable of Mermaid ERD syntax string
   */
  generateMermaidSyntax(): Observable<string> {
    return forkJoin({
      entities: this.schemaService.getEntities().pipe(take(1)),
      properties: this.schemaService.getProperties().pipe(take(1)),
      junctionTables: this.schemaService.getDetectedJunctionTables().pipe(take(1))
    }).pipe(
      map(({ entities, properties, junctionTables }) => {
        if (!entities || !properties) {
          console.warn('[SchemaErdService] Missing entities or properties');
          return 'erDiagram\n  %% No schema data available';
        }

        let mermaidSyntax = 'erDiagram\n';

        // Filter out junction tables from entity list
        const visibleEntities = entities.filter(e => !junctionTables.has(e.table_name));

        // Filter out M:M virtual properties from property list (they don't belong on entities)
        const realProperties = properties.filter(p => p.type !== EntityPropertyType.ManyToMany);

        // Generate entity definitions with attributes (excluding junctions)
        visibleEntities.forEach(entity => {
          mermaidSyntax += this.generateEntityBlock(entity, realProperties);
        });

        // Generate relationships (M:M and regular FK)
        mermaidSyntax += this.generateRelationships(visibleEntities, properties, junctionTables);

        return mermaidSyntax;
      })
    );
  }

  /**
   * Generates an entity block with its attributes
   */
  private generateEntityBlock(entity: SchemaEntityTable, allProperties: SchemaEntityProperty[]): string {
    const entityName = this.sanitizeEntityName(entity.table_name);
    const entityProps = allProperties
      .filter(p => p.table_name === entity.table_name)
      .sort((a, b) => a.sort_order - b.sort_order);

    let block = `  ${entityName} {\n`;

    entityProps.forEach(prop => {
      const dataType = this.mapPropertyTypeToString(prop.type);
      const displayName = prop.display_name || prop.column_name;
      // Remove spaces and special chars not allowed in Mermaid attribute names
      // Preserves casing and customization while making it valid Mermaid syntax
      const sanitizedName = displayName.replace(/[\s\-\.]/g, '');
      const isNullable = prop.is_nullable ? '' : ' "NOT NULL"';
      const isPrimaryKey = prop.column_name === 'id' ? ' PK' : '';
      const isForeignKey = prop.type === EntityPropertyType.ForeignKeyName || prop.type === EntityPropertyType.User ? ' FK' : '';

      block += `    ${dataType} ${sanitizedName}${isPrimaryKey}${isForeignKey}${isNullable}\n`;
    });

    block += '  }\n';
    return block;
  }

  /**
   * Generates relationship lines between entities.
   * Renders M:M relationships from virtual properties and regular FK relationships.
   */
  private generateRelationships(
    entities: SchemaEntityTable[],
    properties: SchemaEntityProperty[],
    junctionTables: Set<string>
  ): string {
    let relationships = '';
    const processedRelationships = new Set<string>();

    // First, render M:M relationships (from virtual M:M properties)
    const m2mProperties = properties.filter(p => p.type === EntityPropertyType.ManyToMany);
    m2mProperties.forEach(prop => {
      if (prop.many_to_many_meta) {
        const meta = prop.many_to_many_meta;
        const fromEntity = this.sanitizeEntityName(meta.sourceTable);
        const toEntity = this.sanitizeEntityName(meta.targetTable);

        // Create bidirectional key to avoid rendering same M:M twice
        const key1 = `${fromEntity}-${toEntity}-${meta.junctionTable}`;
        const key2 = `${toEntity}-${fromEntity}-${meta.junctionTable}`;

        // Only render once per junction
        if (!processedRelationships.has(key1) && !processedRelationships.has(key2)) {
          // Many-to-many relationship
          // Syntax: FROM }o--o{ TO : "junction_name"
          relationships += `  ${fromEntity} }o--o{ ${toEntity} : "${meta.junctionTable}"\n`;
          processedRelationships.add(key1);
          processedRelationships.add(key2);
        }
      }
    });

    // Then, render regular FK relationships (but skip those from junction tables)
    properties.forEach(prop => {
      if (prop.join_table && prop.join_schema === 'public') {
        // Skip FK relationships that belong to junction tables
        if (junctionTables.has(prop.table_name)) {
          return;
        }

        const fromEntity = this.sanitizeEntityName(prop.table_name);
        const toEntity = this.sanitizeEntityName(prop.join_table);

        // Create a unique key to avoid duplicate relationships
        const relationshipKey = `${fromEntity}-${toEntity}-${prop.column_name}`;

        // Only add if we haven't processed this relationship yet
        if (!processedRelationships.has(relationshipKey)) {
          // Many-to-one relationship (typical FK)
          // From table has many records, each referencing one record in to table
          // Syntax: FROM }o--|| TO : "relationship"
          const label = prop.column_name.replace(/_id$/, '');
          relationships += `  ${fromEntity} }o--|| ${toEntity} : "${label}"\n`;
          processedRelationships.add(relationshipKey);
        }
      }
    });

    return relationships;
  }

  /**
   * Sanitizes entity names for Mermaid syntax (removes special characters)
   */
  private sanitizeEntityName(name: string): string {
    // Capitalize first letter and remove special characters
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
  }

  /**
   * Maps EntityPropertyType enum to user-friendly type names for ERD display
   */
  private mapPropertyTypeToString(type: EntityPropertyType): string {
    const typeMap: { [key: number]: string } = {
      [EntityPropertyType.Unknown]: 'Unknown',
      [EntityPropertyType.TextShort]: 'Text',
      [EntityPropertyType.TextLong]: 'LongText',
      [EntityPropertyType.Boolean]: 'Boolean',
      [EntityPropertyType.Date]: 'Date',
      [EntityPropertyType.DateTime]: 'DateTime',
      [EntityPropertyType.DateTimeLocal]: 'DateTime',
      [EntityPropertyType.Money]: 'Money',
      [EntityPropertyType.IntegerNumber]: 'Integer',
      [EntityPropertyType.DecimalNumber]: 'Decimal',
      [EntityPropertyType.ForeignKeyName]: 'Reference',
      [EntityPropertyType.User]: 'User',
      [EntityPropertyType.GeoPoint]: 'Location'
    };

    return typeMap[type] || 'Unknown';
  }
}
