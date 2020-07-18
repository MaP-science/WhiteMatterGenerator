import React from "react";
import inputExample from "./inputExample";

export default props => (
    <>
        <b>Input file format:</b> The input file should be in JSON format. The following values can be specified:
        <ul>
            <li>
                <b>voxelSizeInner</b> (number)
            </li>
            <li>
                <b>voxelSizeOuter</b> (number)
            </li>
            <li>
                <b>jointsPerAxon</b> (number)
            </li>
            <li>
                <b>mapFromDiameterToDeformationFactor</b> (object)
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
                <b>mapFromMaxDiameterToMinDiameter</b> (object)
                <ul>
                    <li>
                        <b>from</b> (array of numbers)
                    </li>
                    <li>
                        <b>to</b> (array of numbers)
                    </li>
                </ul>
                <li>
                    <b>axons</b> (array of objects)
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
            </li>
            <li>
                <b>cells</b> (array of objects)
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
            <li>
                <b>grow</b> (number)
            </li>
            <li>
                <b>contract</b> (number)
            </li>
        </ul>
        <br />
        <b>Example of input file:</b>
        <pre>{JSON.stringify(inputExample, null, 4)}</pre>
    </>
);
