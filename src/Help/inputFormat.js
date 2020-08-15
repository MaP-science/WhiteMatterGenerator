import React from "react";

export default props => (
    <>
        <b>Input file format:</b> The input file should be in JSON format. The following values can be specified:
        <ul>
            <li>
                <b>voxelSizeInner</b> (number) - This is the size of the inner voxel which is used when computing the
                volume fraction.
            </li>
            <li>
                <b>voxelSizeOuter</b> (number) - This is the size of the outer voxel which is used when generating the
                axons.
            </li>
            <li>
                <b>jointDensity</b> (number) - This is the number of joints per unit length along axons.
            </li>
            <li>
                <b>grow</b> (number) - How much the axons grow per step. 0 means no growth, 1 means that the axon will
                grow to 100% of its target size in 1 step.
            </li>
            <li>
                <b>contract</b> (number) - How much the axons contract per step, i.e. how stiff the axons are. This
                number should be between 0 and 1.
            </li>
            <li>
                <b>mapFromDiameterToDeformationFactor</b> (object) - This map determines how much joints should deform
                as opposed to change position when a collision occurs. It maps from the current diameter of the joint to
                the deformation factor, which is a number between 0 and 1.
                <ul>
                    <li>
                        <b>from</b> (array of numbers)
                    </li>
                    <li>
                        <b>to</b> (array of numbers)
                    </li>
                </ul>
            </li>
            <li>
                <b>mapFromMaxDiameterToMinDiameter</b> (object) - This map determines the minimum diameter a joint can
                have given its target size (max diameter).
                <ul>
                    <li>
                        <b>from</b> (array of numbers)
                    </li>
                    <li>
                        <b>to</b> (array of numbers)
                    </li>
                </ul>
            </li>
            <li>
                <b>axons</b> (array of objects) - The axons to be generated. Initially each axon will pass through its
                position vector and be aligned with its direction vector.
                <ul>
                    <li>
                        <b>position</b> (array of 3 numbers)
                    </li>
                    <li>
                        <b>direction</b> (array of 3 numbers)
                    </li>
                    <li>
                        <b>maxDiameter</b> (number)
                    </li>
                </ul>
            </li>
            <li>
                <b>cells</b> (array of objects) - The cells to be generated. Each cell is defined by a position vector
                and a shape matrix (the identity matrix corresponds to a unit sphere). The axons will try to grow around
                them.
                <ul>
                    <li>
                        <b>position</b> (array of 3 numbers)
                    </li>
                    <li>
                        <b>shape</b> (array of 9 numbers specifying the 3x3 transformation matrix of a sphere into an
                        ellipsoid)
                    </li>
                </ul>
            </li>
        </ul>
    </>
);
