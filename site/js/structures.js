// js/structures.js

export function buildCastleGate(createVoxel, sMat, wMat) {
    const group = new THREE.Group();
    const tHeight = 72; // Monumental tower height
    const aHeight = 46; // High curtain wall
    const tRadius = 9;  // Wide bastion towers

    for (let y = 0; y < tHeight; y++) {
        for (let x = -40; x <= 40; x++) {
            for (let z = -10; z <= 10; z++) {
                let isSolid = false;
                let isGate = false;

                // Flanking towers centered at x = -28 and x = 28
                const distL = Math.sqrt((x + 28)**2 + z**2);
                const distR = Math.sqrt((x - 28)**2 + z**2);

                // Hollow 1-voxel thick cylindrical shells
                const inLeftTower = Math.round(distL) === tRadius;
                const inRightTower = Math.round(distR) === tRadius;

                if (inLeftTower || inRightTower) {
                    isSolid = true;

                    // Stepped stone base plinth
                    if (y < 4 && (Math.round(distL) === tRadius + 1 || Math.round(distR) === tRadius + 1)) {
                        isSolid = true;
                    }

                    // Arrow slits on the front face of both towers
                    if (z > 6 && y >= 32 && y <= 46 && (Math.abs(x + 28) <= 1 || Math.abs(x - 28) <= 1)) {
                        isSolid = false;
                    }

                    // Tower battlements / crenellations
                    if (y > 63) {
                        const angle = Math.atan2(z, (x < 0 ? x + 28 : x - 28));
                        const notch = Math.floor((angle + Math.PI) / (Math.PI / 4)) % 2 === 0;
                        if (notch) isSolid = false;
                    }
                }
                // Connecting curtain wall & Gothic lattice gate
                else if (Math.abs(x) < 20 && z === 0) {
                    const archTop = 22 + (20 - Math.abs(x)) * 1.1;

                    if (y > archTop && y <= aHeight) {
                        isSolid = true;
                    } else if (y <= archTop) {
                        // Diamond iron lattice gate directly behind the #Entry post
                        if (Math.abs(x + y) % 4 === 0 || Math.abs(x - y) % 4 === 0) {
                            isGate = true;
                        }
                    }

                    // Crenellations along the top of the archway wall
                    if (y > aHeight && y <= aHeight + 3) {
                        if (Math.abs(x) % 6 < 3) isSolid = true;
                    }
                }

                // createVoxel now registers the data internally; no need to call group.add()
                if (isSolid) {
                    createVoxel(x, y, z, sMat, wMat);
                } else if (isGate) {
                    const proxy = createVoxel(x, y, z, wMat, wMat);
                    if (proxy) {
                        proxy.userData.isWireframe = true;
                    }
                }
            }
        }
    }
    return group;
}

// Structure Registry:
// - zIndex: 3 places the gate at z = -60 (directly behind the first post at z = -40)
// - scale: 3 multiplies the physical size 3x
// - yOffset: -10 aligns the gate floor exactly with the procedural pillars
export const sectorStructures = {
    'home': [
        {
            zIndex: 3,
            builder: buildCastleGate,
            scale: 3,
            yOffset: -10
        }
    ]
};
