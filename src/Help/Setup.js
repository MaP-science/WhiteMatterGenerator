import React from "react";
import { Link } from "react-router-dom";

export default props => (
    <>
        <p>The first phase is the setup phase. Here you can specify:</p>
        <ul>
            <li>
                <b>Inner voxel side length</b> - This is the side length of the inner voxel which is used when computing
                the volume fraction.
            </li>
            <li>
                <b>Outer voxel side length</b> - This is the side length of the outer voxel which is used when
                generating the axons and cells.
            </li>
            <li>
                <b>Number of axons</b> - This is the number of axons to be generated. Each axon is made up of ellipsoids
                (here called ellipsoids).
            </li>
            <li>
                <b>Ellipsoid density of axons</b> - This is the number of ellipsoids per µm along axons. A higher number
                results in higher precision of the model but is also more computation heavy.
            </li>
            <li>
                <b>Number of cells</b> - This is the number of cells to be generated. Each cell has the shape of an
                ellipsoid.
            </li>
        </ul>
        <p>
            When you are ready click the "Initialize" button. If you want more control of exactly how the axons and
            cells are generated, you can instead provide a JSON file by clicking the "upload config file" button. The
            file can specify the following values (the unit of length is µm):
        </p>
        <ul>
            <li>
                <b>voxelSizeInner</b> (number) - This is the side length of the inner voxel which is used when computing
                the volume fraction.
            </li>
            <li>
                <b>voxelSizeOuter</b> (number) - This is the side length of the outer voxel which is used when
                generating the axons.
            </li>
            <li>
                <b>ellipsoidDensity</b> (number) - This is the number of ellipsoids per µm along axons.
            </li>
            <li>
                <b>growSpeed</b> (number) - How much the axons grow per step. 0 means no growth, 1 means that the axon
                will grow to 100% of its target size in 1 step.
            </li>
            <li>
                <b>contractSpeed</b> (number) - How much the axons contract per step, i.e. how stiff the axons are. This
                number should be between 0 and 1.
            </li>
            <li>
                <b>mapFromDiameterToDeformationFactor</b> (object) - This map determines how much ellipsoids should
                deform as opposed to change position when a collision occurs. It maps from the current diameter of the
                ellipsoid to the deformation factor, which is a number between 0 and 1.
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
                <b>mapFromMaxDiameterToMinDiameter</b> (object) - This map determines the minimum diameter a ellipsoid
                can have given its target size (max diameter).
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
        <Link to="/examples/input">Click here to see an example of an input file.</Link>
    </>
);
