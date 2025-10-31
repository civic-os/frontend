import { Injectable } from '@angular/core';
import { Point, Size, Side, PortData } from '../../interfaces/schema-diagram.interface';

/**
 * Service for geometric calculations related to port positioning in schema diagrams.
 * Contains pure mathematical functions that determine port placement based on spatial relationships.
 *
 * Key Concepts:
 * - Ports are connection points on the four sides of entity boxes (top, right, bottom, left)
 * - Port placement is determined by the geometric angle between entity centers
 * - Dimension-aware algorithms use entity size to calculate correct threshold angles
 * - Screen coordinates: Y increases downward (opposite of mathematical convention)
 */
@Injectable({
  providedIn: 'root'
})
export class GeometricPortCalculatorService {

  /**
   * Calculates the center point of an entity given its position and size.
   *
   * @param position Top-left corner coordinates of the entity
   * @param size Width and height of the entity
   * @returns Center point of the entity
   */
  public getCenter(position: Point, size: Size): Point {
    return {
      x: position.x + size.width / 2,
      y: position.y + size.height / 2
    };
  }

  /**
   * Calculates the angle from one point to another using atan2.
   * Returns angle in degrees in the range -180 to 180.
   *
   * Screen coordinates: Positive Y points downward.
   * - Angle 0° = right
   * - Angle 90° = down
   * - Angle ±180° = left
   * - Angle -90° = up
   *
   * @param from Starting point (center of source entity)
   * @param to Ending point (center of target entity)
   * @returns Angle in degrees (-180 to 180)
   */
  public calculateAngleBetweenPoints(from: Point, to: Point): number {
    return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
  }

  /**
   * Determines which side of an entity a port should be placed on based on the angle
   * to the related entity. Uses geometric principles to create physically intuitive connections.
   *
   * IMPORTANT: Calculates angle thresholds based on entity dimensions (not fixed 45°).
   * For rectangular entities, the thresholds are determined by the diagonal angle to corners.
   *
   * Screen coordinates: Y increases downward, opposite of mathematical convention.
   *
   * Examples:
   * - Square (250×250): corner angle = 45°, classic quadrant division
   * - Rectangle (250×100): corner angle ≈ 21.8°, wider right/left zones
   *
   * @param angle Angle in degrees from atan2 (-180 to 180)
   * @param width Width of the entity in pixels
   * @param height Height of the entity in pixels
   * @returns The side ('top' | 'right' | 'bottom' | 'left') where the port should be placed
   */
  public determineSideFromAngle(angle: number, width: number, height: number): Side {
    // Normalize angle to -180 to 180 range (though atan2 already returns this)
    const normalized = ((angle + 180) % 360) - 180;

    // Calculate the diagonal angle from center to corner based on entity dimensions
    // This determines the threshold angles between adjacent sides
    // For a 250×100 rectangle: atan2(50, 125) ≈ 21.8°
    // For a square (250×250): atan2(125, 125) = 45° (classic quadrant division)
    const cornerAngle = Math.atan2(height / 2, width / 2) * (180 / Math.PI);

    // Divide the circle into 4 sections based on actual entity geometry
    // Screen coordinates: Y increases downward, so positive angles = downward direction
    // Right: -cornerAngle to +cornerAngle
    // Bottom: +cornerAngle to (180 - cornerAngle)
    // Left: (180 - cornerAngle) to 180, and -180 to -(180 - cornerAngle)
    // Top: -(180 - cornerAngle) to -cornerAngle

    if (normalized >= -cornerAngle && normalized < cornerAngle) {
      return 'right';
    } else if (normalized >= cornerAngle && normalized < (180 - cornerAngle)) {
      return 'bottom';  // Positive angle = downward in screen coords
    } else if (normalized >= (180 - cornerAngle) || normalized < -(180 - cornerAngle)) {
      return 'left';
    } else {
      return 'top';  // Negative angle = upward in screen coords
    }
  }

  /**
   * Sorts an array of ports for a specific side based on their angles.
   * This creates natural left-to-right or top-to-bottom ordering of ports.
   *
   * Sorting logic per side:
   * - TOP: Sort ascending (more negative = more left, less negative = more right)
   * - RIGHT: Sort ascending (more negative = more upward, more positive = more downward)
   * - BOTTOM: Sort descending (smaller angle = more right, larger = more left)
   * - LEFT: Normalize to 0-360, then sort descending (handles wraparound at ±180°)
   *
   * @param ports Array of ports to sort
   * @param side Which side these ports are on
   * @returns Sorted array of ports
   */
  public sortPortsBySide(ports: PortData[], side: Side): PortData[] {
    const sorted = [...ports]; // Create copy to avoid mutating input

    switch (side) {
      case 'top':
        // TOP: Angles -135° to -45° (negative Y = upward)
        // More negative = more left, less negative = more right
        // Sort ascending for left-to-right distribution
        sorted.sort((a, b) => a.angle - b.angle);
        break;

      case 'right':
        // RIGHT: Angles -45° to 45°
        // More negative = more upward, more positive = more downward
        // Sort ascending for top-to-bottom distribution
        sorted.sort((a, b) => a.angle - b.angle);
        break;

      case 'bottom':
        // BOTTOM: Angles 45° to 135° (positive Y = downward)
        // Smaller angle = more right, larger angle = more left
        // Sort descending for left-to-right distribution
        sorted.sort((a, b) => b.angle - a.angle);
        break;

      case 'left':
        // LEFT: Angles 135° to -135° (wrapping through ±180°)
        // Need special handling for wraparound at ±180°
        // More negative = more upward, more positive = more downward
        // Sort ascending for top-to-bottom after normalization
        sorted.sort((a, b) => {
          // Normalize to 0-360 range for consistent comparison
          const angleA = a.angle < 0 ? a.angle + 360 : a.angle;
          const angleB = b.angle < 0 ? b.angle + 360 : b.angle;
          // Both now in range 135° to 360° (which includes former negative angles)
          // Sort descending: larger angle (towards 225°) = more upward, smaller (towards 135°) = more downward
          return angleB - angleA;
        });
        break;
    }

    return sorted;
  }

  /**
   * Groups an array of ports by their side.
   *
   * @param ports Array of all ports for an entity
   * @returns Object with ports grouped by side
   */
  public groupPortsBySide(ports: PortData[]): Record<Side, PortData[]> {
    return {
      top: ports.filter(p => p.group === 'top'),
      right: ports.filter(p => p.group === 'right'),
      bottom: ports.filter(p => p.group === 'bottom'),
      left: ports.filter(p => p.group === 'left')
    };
  }

  /**
   * Sorts all ports for an entity, grouped by side.
   * This is the main entry point for port sorting logic.
   *
   * @param ports Array of all ports for an entity
   * @returns Object with ports grouped and sorted by side
   */
  public sortAllPorts(ports: PortData[]): Record<Side, PortData[]> {
    const grouped = this.groupPortsBySide(ports);

    return {
      top: this.sortPortsBySide(grouped.top, 'top'),
      right: this.sortPortsBySide(grouped.right, 'right'),
      bottom: this.sortPortsBySide(grouped.bottom, 'bottom'),
      left: this.sortPortsBySide(grouped.left, 'left')
    };
  }
}
