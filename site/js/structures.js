// js/structures.js

export function buildCastleGate(createVoxel, sMat, wMat) {
    const group = new THREE.Group();
    const tHeight = 45; // Tower height
    const aHeight = 28; // Arch wall height

    // Voxel coordinates mapping
    for (let y = 0; y < tHeight; y++) {
        for (let x = -26; x <= 26; x++) {
            for (let z = -5; z <= 5; z++) {
                let isSolid = false;
                let isGate = false;

                // Two round towers centered at x = -20 and x = 20[cite: 10]
                const distL = Math.sqrt((x + 20)**2 + z**2);
                const distR = Math.sqrt((x - 20)**2 + z**2);

                if (distL <= 5.5 || distR <= 5.5) {
                    isSolid = true;
                    // Crenellations on the tower roofs[cite: 10]
                    if (y > 38) {
                        const angle = Math.atan2(z, (x < 0 ? x + 20 : x - 20));
                        const notch = Math.floor((angle + Math.PI) / (Math.PI / 4)) % 2 === 0;
                        if ((distL > 3.5 || distR > 3.5) && notch) {
                            isSolid = true;
                        } else {
                            isSolid = false;
                        }
                    }
                }
                // Connecting archway and gates[cite: 10]
                else if (Math.abs(x) <= 15) {
                    if (Math.abs(z) <= 2) {
                        // Pointed Gothic arch profile[cite: 10]
                        const archTop = 12 + (15 - Math.abs(x)) * 0.8;
                        if (y > archTop && y <= aHeight) {
                            isSolid = true;
                        } else if (y <= archTop && z === 0) {
                            // Iron diamond lattice gate pattern[cite: 10]
                            if (Math.abs(x + y) % 3 === 0 || Math.abs(x - y) % 3 === 0) {
                                isGate = true;
                            }
                        }
                    }
                    // Crenellations across the archway wall[cite: 10]
                    if (y === aHeight + 1 && Math.abs(z) <= 2) {
                        if (Math.abs(x) % 4 < 2) isSolid = true;
                    }
                }

                if (isSolid) {
                    const v = createVoxel(x, y, z, sMat, wMat);
                    if (v) group.add(v);
                } else if (isGate) {
                    // Force the iron gates to render as wireframes[cite: 10]
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
        // zIndex 4 corresponds to z = -80 (exactly between the 1st and 2nd post)
        { zIndex: 4, builder: buildCastleGate }
    ]
};
