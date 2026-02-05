// Sample OpenSCAD files for browser mode / demo purposes

export const SAMPLE_SCAD = `// ClawdCAD - Sample OpenSCAD Model
// A parametric phone stand with rounded edges

/* Configuration Parameters */
$fn = 64;  // Resolution for curved surfaces

// Dimensions
stand_width = 80;
stand_depth = 60;
stand_height = 45;
thickness = 3;
phone_angle = 70;  // degrees
corner_radius = 5;

// Colors
stand_color = [0.2, 0.4, 0.8];  // Blue

module rounded_box(size, radius) {
    let (w = size[0], d = size[1], h = size[2])
    hull() {
        for (x = [radius, w - radius])
            for (y = [radius, d - radius])
                translate([x, y, 0])
                    cylinder(h = h, r = radius);
    }
}

module phone_slot(width, depth, angle) {
    rotate([angle, 0, 0])
        cube([width - 10, thickness, depth * 1.5]);
}

module phone_stand() {
    difference() {
        // Main body
        color(stand_color)
            rounded_box([stand_width, stand_depth, stand_height], corner_radius);

        // Hollow interior
        translate([thickness, thickness, thickness])
            rounded_box(
                [stand_width - 2*thickness, stand_depth - 2*thickness, stand_height],
                corner_radius - 1
            );

        // Phone slot
        translate([5, stand_depth/2, stand_height - 5])
            phone_slot(stand_width, stand_depth, phone_angle);
    }

    // Cable routing hole
    translate([stand_width/2, stand_depth/2, 0])
        cylinder(h = thickness, d = 12);

    echo("Phone stand generated successfully!");
    echo(str("Dimensions: ", stand_width, "x", stand_depth, "x", stand_height));
}

// Render the stand
phone_stand();
`

export const SAMPLE_GEAR = `// Parametric Gear Generator
$fn = 64;

// Parameters
teeth = 20;
module_val = 2;  // mm per tooth
pressure_angle = 20;  // degrees
thickness = 5;

pitch_radius = teeth * module_val / 2;
outer_radius = pitch_radius + module_val;
root_radius = pitch_radius - 1.25 * module_val;

module gear_tooth(r_pitch, r_outer, r_root, angle) {
    polygon([
        [r_root * cos(angle - 5), r_root * sin(angle - 5)],
        [r_outer * cos(angle), r_outer * sin(angle)],
        [r_root * cos(angle + 5), r_root * sin(angle + 5)]
    ]);
}

module gear() {
    linear_extrude(height = thickness) {
        difference() {
            circle(r = outer_radius);
            circle(r = root_radius * 0.6);  // center hole
        }
    }
    echo(str("Gear: ", teeth, " teeth, pitch radius = ", pitch_radius));
}

gear();
`

export const SAMPLE_BOX = `// Simple parametric box with lid
$fn = 32;

// Box dimensions
width = 60;
depth = 40;
height = 30;
wall = 2;
lid_height = 8;

module box_base() {
    difference() {
        cube([width, depth, height - lid_height]);
        translate([wall, wall, wall])
            cube([width - 2*wall, depth - 2*wall, height]);
    }
}

module box_lid() {
    translate([0, 0, height - lid_height + 1])
        difference() {
            cube([width, depth, lid_height]);
            translate([wall, wall, -1])
                cube([width - 2*wall, depth - 2*wall, lid_height - wall + 1]);
        }
}

color("SteelBlue") box_base();
color("LightSteelBlue") box_lid();
`

/** Map filename to sample content for browser mode */
export const SAMPLE_FILES: Record<string, string> = {
  'phone_stand.scad': SAMPLE_SCAD,
  'gear.scad': SAMPLE_GEAR,
  'box.scad': SAMPLE_BOX,
}
