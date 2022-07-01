import React from "react";
import { Link } from "react-router-dom";

export default () => (
    <>
        <p>The first phase is the setup phase. Here you can specify:</p>
        <ul>
            <li>
                <b>Voxel side length</b> - This is the side length of the voxel.
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
                <b>voxelSize</b> (number) - This is the side length of the voxel.
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
                number should be non-negative.
            </li>
            <li>
                <b>mapFromDiameterToDeformationFactor</b>* (object) - This map determines how much the axons' ellipsoids
                should deform as opposed to change position when a collision occurs. It maps from the current diameter
                of the ellipsoid (axon + myelin) to the deformation factor, which is a number between 0 and 1. A
                deformation factor of 0 means that the ellipsoid can't be deformed at all and will always be a perfect
                sphere. A deformation factor of 1 means that the ellipsoid will deform as much as possible rather than
                change the position of its center. The values defining the map will be linearly interpolated.
                <ul>
                    <li>
                        <b>from</b> (array of numbers) - The input values of the map, i.e. diameters. This array should
                        be given in increasing order.
                    </li>
                    <li>
                        <b>to</b> (array of numbers) - The output values of the map, i.e. deformation factors.
                    </li>
                </ul>
            </li>
            <li>
                <b>mapFromMaxDiameterToMinDiameter</b>* (object) - This map determines the minimum diameter an ellipsoid
                can have (axon + myelin) given its maximum diameter (axon + myelin). The values defining the map will be
                linearly interpolated.
                <ul>
                    <li>
                        <b>from</b> (array of numbers) - The input values of the map, i.e. maximum diameters. This array
                        should be given in increasing order.
                    </li>
                    <li>
                        <b>to</b> (array of numbers) - The output values of the map, i.e. minimum diameters.
                    </li>
                </ul>
            </li>
            <li>
                <b>axons</b> (array of objects) - The axons to be generated. Initially each axon will consist of a
                straight chain of spheres passing through its <b>position</b> vector and be aligned with its{" "}
                <b>direction</b> vector.
                <ul>
                    <li>
                        <b>position</b> (array of 3 numbers) - When the axon is initialized it will pass through this
                        point.
                    </li>
                    <li>
                        <b>direction</b> (array of 3 numbers) - When the axon is initialized it's direction will be
                        aligned with this vector.
                    </li>
                    <li>
                        <b>maxDiameter</b> (number) - The maximum attainable diameter of the axon. This number is
                        automatically divided by the <b>gRatio</b> to represent the maximum attainable diameter of the
                        axon + myelin.
                    </li>
                    <li>
                        <b>color</b> (string) - Color code of the axon. E.g. "#ffffff" to make it white.
                    </li>
                    <li>
                        <b>gRatio</b> (number) - This number describes the size of the axon relative to the size of the
                        axon + myelin. It should be between 0 and 1.
                    </li>
                </ul>
            </li>
            <li>
                <b>cells</b> (array of objects) - The cells to be generated. Each cell is defined by a position vector
                and a shape matrix (the identity matrix corresponds to a unit sphere). The axons will try to grow around
                them.
                <ul>
                    <li>
                        <b>position</b> (array of 3 numbers) - The center of the cell.
                    </li>
                    <li>
                        <b>shape</b> (array of 9 numbers) - Specifies the 3x3 transformation matrix used when going from
                        a unit sphere to an ellipsoid. This ellipsoid will be the shape of the cell.
                    </li>
                    <li>
                        <b>color</b> (string) - Color code of the cell. E.g. "#ffffff" to make it white.
                    </li>
                </ul>
            </li>
        </ul>
        <p>
            * A map object contains two arrays of numbers: <b>from</b> and <b>to</b>. The lengths of these arrays can be
            any number as long as they are the same. E.g. you can have <b>from</b>=[0,1,2,3] and <b>to</b>=[2,2,4,4].
            Here both <b>from</b> and <b>to</b> have length 4. NB: the array lengths do not have anything to do with the
            number of axons or cells.
        </p>
        <ul>
            <li>
                When a map is used the input is looked up in the <b>from</b> array and the corresponding value in the{" "}
                <b>to</b> array is returned. E.g. if we use the example maps from before with an input of 2, the output
                will be computed like this: [0,1,<b>2</b>,3] -> [2,2,<b>4</b>,4]. Hence the output will be 4.
            </li>
            <li>
                If we provide a value that doesn't exist in the <b>from</b> array, linear interpolation will be used.
                E.g. if we use the input value 1.5, the output will be the average of the two output values: [0,
                <b>1</b>,<b>2</b>,3] -> [2,<b>2</b>,<b>4</b>,4]. Hence the output will be the average of 2 and 4, i.e.
                3.
            </li>
        </ul>
        <Link to="/examples/input">Click here to see an example of an input file.</Link>
    </>
);
