// js/structures.js

export function buildCastleGate(createVoxel, sMat, wMat) {
    const group = new THREE.Group();
    const tHeight = 65; // Taller towers for an imposing scale
    const aHeight = 42; // Taller arch wall
    const tRadius = 8;  // Larger, wider towers

    // Loop ranges expanded to accommodate the massive scale
    for (let y = 0; y < tHeight; y++) {
        for (let x = -36; x <= 36; x++) {
            for (let z = -9; z <= 9; z++) {
                let isSolid = false;
                let isGate = false;

                // Move towers further out from the center path
                const distL = Math.sqrt((x + 26)**2 + z**2);
                const distR = Math.sqrt((x - 26)**2 + z**2);

                // PERFORMANCE FIX: Hollow cylinders.
                // Math.round() forces the towers to be strictly 1-voxel thick.
                const inLeftTower = Math.round(distL) === tRadius;
                const inRightTower = Math.round(distR) === tRadius;

                if (inLeftTower || inRightTower) {
                    isSolid = true;

                    // Thicker, blockier battlements on tower roofs
                    if (y > 56) {
                        const angle = Math.atan2(z, (x < 0 ? x + 26 : x - 26));
                        // Slice the cylinder roof into 8 alternating notches
                        const notch = Math.floor((angle + Math.PI) / (Math.PI / 4)) % 2 === 0;
                        if (notch) isSolid = false;
                    }
                }
                // Connecting archway and gates (Hollowed to a strictly 1-voxel thick wall at z=0)
                else if (Math.abs(x) < 19 && z === 0) {
                    // Steeper, more dramatic Gothic arch profile
                    const archTop = 18 + (18 - Math.abs(x)) * 1.2;

                    if (y > archTop && y <= aHeight) {
                        isSolid = true;
                    } else if (y <= archTop) {
                        // Sparser Iron diamond lattice (Modulo 4 instead of 3 reduces cube count by 33%)
                        if (Math.abs(x + y) % 4 === 0 || Math.abs(x - y) % 4 === 0) {
                            isGate = true;
                        }
                    }

                    // Wall Crenellations spanning between the towers
                    if (y > aHeight && y <= aHeight + 2) {
                        if (Math.abs(x) % 6 < 3) isSolid = true;
                    }
                }

                if (isSolid) {
                    const v = createVoxel(x, y, z, sMat, wMat);
                    if (v) group.add(v);
                } else if (isGate) {
                    // Force the iron gates to render as wireframes
                    const v = createVoxel(x, y, z, wMat, wMat);
                    if (v) {
                        v.userData.isWireframe = true;
                        group.add(v);
                    }
                }
            }
        }
    }
    return group;
}

// Structure Registry: Define which structures appear on which sectors and at what depth
export const sectorStructures = {
    'home': [
        // zIndex 4 drops the gate exactly in the gap between the 1st and 2nd post
        { zIndex: 4, builder: buildCastleGate }
    ]
};
