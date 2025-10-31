/**
 * TypeScript interfaces for schema diagram visualization.
 * Used by GeometricPortCalculatorService and SchemaEditorPage.
 */

/**
 * A point in 2D space (canvas coordinates)
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Dimensions of an entity box
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * The four sides of an entity box where ports can be placed
 */
export type Side = 'top' | 'right' | 'bottom' | 'left';

/**
 * Data for a single port on an entity, including geometric information
 */
export interface PortData {
  /** Unique identifier for the port (e.g., 'right_out_users_id_author_id') */
  id: string;
  /** Which side of the entity this port is on */
  group: Side;
  /** Angle in degrees to the related entity (-180 to 180) */
  angle: number;
  /** Name of the table this port connects to */
  relatedTable: string;
}

/**
 * Configuration for port placement on an entity
 */
export interface PortConfiguration {
  /** Port group definitions (top, right, bottom, left) */
  groups: Record<Side, PortGroupDefinition>;
  /** Array of individual ports with their positions */
  items: PortItem[];
}

/**
 * Definition of a port group (one of the four sides)
 */
export interface PortGroupDefinition {
  position: { name: Side };
  attrs: {
    portBody: {
      width: number;
      height: number;
      x: number;
      y: number;
      fill: string;
      magnet: boolean;
    };
  };
  markup: Array<{ tagName: string; selector: string }>;
}

/**
 * A single port item to be rendered
 */
export interface PortItem {
  id: string;
  group: Side;
}
