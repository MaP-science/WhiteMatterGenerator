export default {
    voxelSizeInner: 9,
    voxelSizeOuter: 10,
    jointsPerAxon: 100,
    mapFromDiameterToDeformationFactor: {
        from: [0, 0.8, 2],
        to: [0, 0.5, 1]
    },
    mapFromMaxDiameterToMinDiameter: {
        from: [0, 1],
        to: [0, 0.2]
    },
    axons: [
        {
            position: [0, 0, 0],
            direction: [1, 0, 0],
            maxDiameter: 1
        },
        {
            position: [1, 0.1, 0],
            direction: [1, 1, 1],
            maxDiameter: 0.5
        }
    ],
    cells: [
        {
            position: [2, 1, 0],
            shape: [1.5, 0, 0, 0, 1, 0, 0, 0, 1]
        }
    ],
    grow: 0.05,
    contract: 0.05
};
